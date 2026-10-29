import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_NAME = "libraria_teacher_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 12;

function sessionSecret() {
  return process.env.LIBRARIA_TEACHER_SESSION_SECRET;
}

function isConfigured() {
  return Boolean(process.env.LIBRARIA_TEACHER_PASSWORD && sessionSecret());
}

function signExpiry(expiry: number, secret: string) {
  return createHmac("sha256", secret).update(`teacher:${expiry}`).digest("hex");
}

function validSession(value: string | undefined) {
  const secret = sessionSecret();
  if (!secret || !value) return false;

  const [expiryText, signature] = value.split(".");
  const expiry = Number(expiryText);
  if (!Number.isSafeInteger(expiry) || expiry <= Math.floor(Date.now() / 1000) || expiry > Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS + 60 || !signature) return false;

  const expected = signExpiry(expiry, secret);
  const actualBytes = Buffer.from(signature, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function GET() {
  const jar = await cookies();
  return NextResponse.json({ configured: isConfigured(), authenticated: validSession(jar.get(COOKIE_NAME)?.value) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
  if (!isConfigured()) return NextResponse.json({ error: "Teacher sign-in is not configured yet." }, { status: 503 });
  if (!request.headers.get("content-type")?.includes("application/json")) return NextResponse.json({ error: "Invalid request." }, { status: 415 });

  let password = "";
  try {
    const body = await request.json() as { password?: unknown };
    if (typeof body.password === "string" && body.password.length <= 256) password = body.password;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const expectedPassword = process.env.LIBRARIA_TEACHER_PASSWORD ?? "";
  const suppliedHash = createHash("sha256").update(password).digest();
  const expectedHash = createHash("sha256").update(expectedPassword).digest();
  if (!password || !timingSafeEqual(suppliedHash, expectedHash)) return NextResponse.json({ error: "That password doesn’t match." }, { status: 401 });

  const expiry = Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS;
  const jar = await cookies();
  jar.delete("libraria_student_session");
  jar.set(COOKIE_NAME, `${expiry}.${signExpiry(expiry, sessionSecret()!)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_LIFETIME_SECONDS,
  });
  return NextResponse.json({ authenticated: true });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
  return NextResponse.json({ authenticated: false });
}
