import { createHmac, timingSafeEqual } from "node:crypto";

export const TEACHER_COOKIE = "libraria_teacher_session";
export const STUDENT_COOKIE = "libraria_student_session";
export const STUDENT_SESSION_SECONDS = 60 * 60 * 24 * 30;

export type SharedClassroomState = Record<string, string>;

function sessionSecret() {
  return process.env.LIBRARIA_TEACHER_SESSION_SECRET;
}

function signature(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function verifySignature(value: string, expected: string) {
  const actualBytes = Buffer.from(value, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export function hasValidTeacherSession(value: string | undefined) {
  const secret = sessionSecret();
  if (!secret || !value) return false;
  const [expiryText, suppliedSignature] = value.split(".");
  const expiry = Number(expiryText);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(expiry) || expiry <= now || expiry > now + 60 * 60 * 13 || !suppliedSignature) return false;
  return verifySignature(suppliedSignature, signature(`teacher:${expiry}`, secret));
}

export function createStudentSession(studentId: string) {
  const secret = sessionSecret();
  if (!secret) throw new Error("Student sessions are not configured.");
  const expiry = Math.floor(Date.now() / 1000) + STUDENT_SESSION_SECONDS;
  const payload = Buffer.from(JSON.stringify({ studentId, expiry })).toString("base64url");
  return `${payload}.${signature(`student:${payload}`, secret)}`;
}

export function readStudentSession(value: string | undefined) {
  const secret = sessionSecret();
  if (!secret || !value) return null;
  const [payload, suppliedSignature] = value.split(".");
  if (!payload || !suppliedSignature || !verifySignature(suppliedSignature, signature(`student:${payload}`, secret))) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { studentId?: unknown; expiry?: unknown };
    if (typeof decoded.studentId !== "string" || !decoded.studentId || typeof decoded.expiry !== "number" || decoded.expiry <= Math.floor(Date.now() / 1000)) return null;
    return decoded.studentId;
  } catch {
    return null;
  }
}

export function supabaseServerConfigured() {
  return Boolean((process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) && process.env.SUPABASE_SECRET_KEY);
}

export function getSupabaseUrl() {
  return (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
}

export async function getSharedClassroomState() {
  if (!supabaseServerConfigured()) throw new Error("Supabase server environment variables are missing.");
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SECRET_KEY!;
  const response = await fetch(`${url}/rest/v1/libraria_classroom_state?id=eq.main&select=data`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase read failed (${response.status}).`);
  const rows = await response.json() as Array<{ data?: unknown }>;
  const data = rows[0]?.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  return data as SharedClassroomState;
}

export async function applySharedClassroomPatch(patch: SharedClassroomState) {
  if (!supabaseServerConfigured()) throw new Error("Supabase server environment variables are missing.");
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SECRET_KEY!;
  const response = await fetch(`${url}/rest/v1/rpc/libraria_apply_state_patch`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_patch: patch }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase write failed (${response.status}).`);
}

export async function saveStudentAssignments(studentId: string, assignments: string) {
  if (!supabaseServerConfigured()) throw new Error("Supabase server environment variables are missing.");
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SECRET_KEY!;
  let updates: unknown;
  try { updates = JSON.parse(assignments); } catch { throw new Error("Invalid assignment data."); }
  if (!Array.isArray(updates)) throw new Error("Invalid assignment data.");
  const response = await fetch(`${url}/rest/v1/rpc/libraria_merge_student_assignments`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_student_id: studentId, p_updates: updates }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase assignment save failed (${response.status}).`);
}

export function sameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

export function parseStateValue<T>(state: SharedClassroomState, key: string, fallback: T): T {
  const value = state[key];
  if (typeof value !== "string") return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export function isSharedStateKey(key: string) {
  return key === "libaria-students" || key === "libaria-exam-assignments" || key === "libaria-custom-reading-tests" || key === "libaria-teaching-pointer" || /^libaria-progress-[\w-]+$/.test(key) || /^libaria-reading-notes-[\w-]+$/.test(key) || /^libaria-flashcards-[\w-]+$/.test(key);
}

export function studentState(state: SharedClassroomState, studentId: string): SharedClassroomState {
  const roster = parseStateValue<Array<Record<string, unknown>>>(state, "libaria-students", []);
  const profile = roster.find((student) => student.id === studentId);
  if (!profile) return {};
  const assignments = parseStateValue<Array<Record<string, unknown>>>(state, "libaria-exam-assignments", []).filter((item) => item.studentId === studentId);
  const assignedTests = new Set(assignments.map((item) => item.testId));
  const tests = parseStateValue<Array<Record<string, unknown>>>(state, "libaria-custom-reading-tests", []).filter((test) => {
    if (test.status !== "published") return false;
    if (test.visibility === "all") return true;
    if (test.visibility === "groups") return Boolean(profile.groupName && Array.isArray(test.groupNames) && test.groupNames.includes(profile.groupName));
    if (test.visibility === "students") return Array.isArray(test.studentIds) && test.studentIds.includes(studentId);
    if (test.studentId) return test.studentId === studentId || assignedTests.has(test.id as string);
    return assignedTests.has(test.id as string) || test.visibility == null;
  });
  const out: SharedClassroomState = {
    "libaria-students": JSON.stringify([profile]),
    "libaria-exam-assignments": JSON.stringify(assignments),
    "libaria-custom-reading-tests": JSON.stringify(tests),
    [`libaria-progress-${studentId}`]: state[`libaria-progress-${studentId}`] ?? "{}",
  };
  const notesKey = `libaria-reading-notes-${studentId}`;
  if (state[notesKey]) out[notesKey] = state[notesKey];
  for (const [key, value] of Object.entries(state)) {
    if (key.startsWith(`libaria-flashcards-${studentId}-`)) out[key] = value;
  }
  if (state["libaria-teaching-pointer"]) out["libaria-teaching-pointer"] = state["libaria-teaching-pointer"];
  return out;
}

