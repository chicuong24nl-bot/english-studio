import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  applySharedClassroomPatch,
  getSharedClassroomState,
  isSharedStateKey,
  readStudentSession,
  saveStudentAssignments,
  sameOriginRequest,
  studentState,
  supabaseServerConfigured,
  STUDENT_COOKIE,
  TEACHER_COOKIE,
  hasValidTeacherSession,
  type SharedClassroomState,
} from "@/features/classroom/server-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "The shared classroom database is unavailable.";
  return NextResponse.json({ error: message }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  if (!supabaseServerConfigured()) return NextResponse.json({ configured: false }, { headers: { "Cache-Control": "no-store" } });
  try {
    const jar = await cookies();
    const teacher = hasValidTeacherSession(jar.get(TEACHER_COOKIE)?.value);
    const studentId = teacher ? null : readStudentSession(jar.get(STUDENT_COOKIE)?.value);
    if (!teacher && !studentId) return NextResponse.json({ error: "Sign in as a teacher or student first." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    const state = await getSharedClassroomState();
    const scoped = studentId ? studentState(state, studentId) : state;
    return NextResponse.json({ role: teacher ? "teacher" : "student", initialized: Boolean(state["libaria-students"]), data: scoped }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
  const jar = await cookies();
  const teacher = hasValidTeacherSession(jar.get(TEACHER_COOKIE)?.value);
  const studentId = teacher ? null : readStudentSession(jar.get(STUDENT_COOKIE)?.value);
  if (!teacher && !studentId) return NextResponse.json({ error: "Sign in as a teacher or student first." }, { status: 401 });
  if (!request.headers.get("content-type")?.includes("application/json")) return NextResponse.json({ error: "Invalid request." }, { status: 415 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 1_500_000) return NextResponse.json({ error: "Classroom update is too large." }, { status: 413 });

  let body: { action?: unknown; data?: unknown };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) return NextResponse.json({ error: "Invalid classroom update." }, { status: 400 });
  const data = body.data as Record<string, unknown>;
  const patch: SharedClassroomState = {};
  for (const [key, value] of Object.entries(data)) {
    if (!isSharedStateKey(key) || typeof value !== "string" || value.length > 1_000_000) return NextResponse.json({ error: "Invalid classroom data." }, { status: 400 });
    patch[key] = value;
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "No classroom data to save." }, { status: 400 });

  try {
    if (teacher) {
      if (body.action === "bootstrap") {
        const current = await getSharedClassroomState();
        if (current["libaria-students"]) return NextResponse.json({ error: "The online classroom already has data." }, { status: 409 });
      } else if (body.action !== "save") {
        return NextResponse.json({ error: "Unknown save action." }, { status: 400 });
      }
      await applySharedClassroomPatch(patch);
      return NextResponse.json({ saved: true });
    }

    const allowedProgressKey = `libaria-progress-${studentId}`;
    const allowedNotesKey = `libaria-reading-notes-${studentId}`;
    const safePatch: SharedClassroomState = {};
    for (const [key, value] of Object.entries(patch)) {
      if (key === allowedProgressKey || key === allowedNotesKey || key.startsWith(`libaria-flashcards-${studentId}-`)) {
        safePatch[key] = value;
      } else if (key === "libaria-exam-assignments") {
        await saveStudentAssignments(studentId!, value);
      } else {
        return NextResponse.json({ error: "Students can only save their own learning progress." }, { status: 403 });
      }
    }
    await applySharedClassroomPatch(safePatch);
    return NextResponse.json({ saved: true });
  } catch (error) {
    return failure(error);
  }
}
