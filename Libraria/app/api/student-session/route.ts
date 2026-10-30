import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createStudentSession, getSharedClassroomState, parseStateValue, sameOriginRequest, STUDENT_COOKIE, STUDENT_SESSION_SECONDS, type SharedClassroomState } from "@/features/classroom/server-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const attempts = new Map<string, { count: number; resetAt: number }>();

function requestKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: Request) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json")) return NextResponse.json({ error: "Invalid request." }, { status: 415 });
  const key = createHash("sha256").update(requestKey(request)).digest("hex");
  const now = Date.now();
  const attempt = attempts.get(key);
  if (attempt && attempt.resetAt > now && attempt.count >= 8) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  attempts.set(key, !attempt || attempt.resetAt <= now ? { count: 1, resetAt: now + 10 * 60_000 } : { ...attempt, count: attempt.count + 1 });
  if (attempts.size > 2_000) for (const [id, value] of attempts) if (value.resetAt <= now) attempts.delete(id);

  let code = "";
  try {
    const body = await request.json() as { code?: unknown };
    if (typeof body.code === "string" && body.code.length <= 16) code = body.code.replace(/\D/g, "");
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!/^\d{9}$/.test(code)) return NextResponse.json({ error: "Enter your 9-digit student code." }, { status: 400 });

  try {
    const state = await getSharedClassroomState();
    const students = parseStateValue<Array<{ id?: unknown; name?: unknown; joinCode?: unknown }>>(state as SharedClassroomState, "libaria-students", []);
    const student = students.find((profile) => profile.joinCode === code && typeof profile.id === "string");
    if (!student || typeof student.id !== "string") return NextResponse.json({ error: "That code was not found. Check it with your teacher and try again." }, { status: 401 });
    const token = createStudentSession(student.id);
    const jar = await cookies();
    jar.delete("libraria_teacher_session");
    jar.set(STUDENT_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: STUDENT_SESSION_SECONDS });
    return NextResponse.json({ authenticated: true, student: { id: student.id, name: student.name } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Student sign-in failed.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
  const jar = await cookies();
  jar.delete(STUDENT_COOKIE);
  return NextResponse.json({ authenticated: false });
}
