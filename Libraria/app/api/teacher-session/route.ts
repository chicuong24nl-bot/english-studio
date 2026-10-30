import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createTeacherSession, hasValidTeacherSession, sameOriginRequest, signInSupabaseTeacher, supabaseAuthConfigured, TEACHER_COOKIE, TEACHER_SESSION_SECONDS } from "@/features/classroom/server-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  const session = jar.get(TEACHER_COOKIE)?.value;
  return NextResponse.json({ configured: supabaseAuthConfigured(), authenticated: hasValidTeacherSession(session) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
  if (!supabaseAuthConfigured()) return NextResponse.json({ error: "Teacher sign-in is not configured yet." }, { status: 503 });
  if (!request.headers.get("content-type")?.includes("application/json")) return NextResponse.json({ error: "Invalid request." }, { status: 415 });

  let email = "";
  let password = "";
  try {
    const body = await request.json() as { email?: unknown; password?: unknown };
    if (typeof body.email === "string" && body.email.length <= 320) email = body.email.trim().toLowerCase();
    if (typeof body.password === "string" && body.password.length <= 256) password = body.password;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!email || !password) return NextResponse.json({ error: "Enter your teacher email and password." }, { status: 400 });

  try {
    const teacher = await signInSupabaseTeacher(email, password);
    if ("error" in teacher) return NextResponse.json({ error: teacher.error }, { status: 401 });
    const jar = await cookies();
    jar.delete("libraria_student_session");
    jar.set(TEACHER_COOKIE, createTeacherSession(teacher.userId), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: TEACHER_SESSION_SECONDS,
    });
    return NextResponse.json({ authenticated: true, teacher: { email: teacher.email } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Teacher sign-in failed.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
  const jar = await cookies();
  jar.delete(TEACHER_COOKIE);
  return NextResponse.json({ authenticated: false });
}
