"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, BookOpen, LockKeyhole } from "lucide-react";

type Theme = { surface: string; page: string; ink: string; muted: string; border: string; accent: string; onAccent: string };

export function TeacherLoginGate({ theme, onCancel, onAuthenticated }: { theme: Theme; onCancel: () => void; onAuthenticated: () => void }) {
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/teacher-session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("status");
        const result = await response.json() as { configured?: boolean };
        setConfigured(result.configured === true);
      })
      .catch(() => {
        setConfigured(false);
        setNotice("Could not check sign-in setup. Refresh the page and try again.");
      });
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/teacher-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json() as { error?: string; authenticated?: boolean };
      if (!response.ok) {
        setConfigured(response.status !== 503);
        setNotice(result.error ?? "Sign-in could not be completed.");
        return;
      }
      setPassword("");
      onAuthenticated();
    } catch {
      setNotice("Could not connect. Check your internet connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center justify-center py-10">
      <section className="w-full rounded-3xl border p-6 shadow-sm sm:p-9" style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }}>
        <button type="button" onClick={onCancel} className="mb-8 inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold" style={{ color: theme.muted }}><ArrowLeft size={16} />Back to student view</button>
        <div className="mb-6 grid h-12 w-12 place-items-center rounded-2xl" style={{ background: theme.accent, color: theme.onAccent }}><BookOpen size={22} /></div>
        <p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}>Teacher workspace</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold">Sign in to manage materials</h1>
        <p className="mt-2 text-sm leading-6" style={{ color: theme.muted }}>Draft and unpublished materials stay out of the student reading list. Publish them from the teacher Materials tab when they’re ready.</p>

        <form onSubmit={signIn} className="mt-7 space-y-4">
          {configured === null ? (
            <p role="status" className="rounded-2xl border p-4 text-sm" style={{ borderColor: theme.border, background: theme.page, color: theme.muted }}>Checking teacher sign-in…</p>
          ) : configured === false ? (
            <div role="status" className="rounded-2xl border p-4 text-sm leading-6" style={{ borderColor: theme.border, background: theme.page, color: theme.muted }}>
              {notice.startsWith("Could not check") ? notice : <>Teacher sign-in needs to be configured in Vercel. Add <code className="font-mono font-bold">LIBRARIA_TEACHER_PASSWORD</code> and <code className="font-mono font-bold">LIBRARIA_TEACHER_SESSION_SECRET</code> to the project’s Environment Variables, then redeploy.</>}
            </div>
          ) : (
            <label className="block text-sm font-semibold">Teacher password
              <span className="relative mt-2 block"><LockKeyhole size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: theme.muted }} /><input autoComplete="current-password" autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={256} className="h-12 w-full rounded-xl border bg-transparent pl-11 pr-4 outline-none focus:ring-2 focus:ring-emerald-600/30" style={{ borderColor: theme.border, color: theme.ink }} placeholder="Enter your teacher password" /></span>
            </label>
          )}
          {notice && configured !== false && <p role="alert" className="text-sm text-red-700">{notice}</p>}
          {configured === true && <button disabled={busy || !password} type="submit" className="inline-flex min-h-12 w-full items-center justify-center rounded-full px-5 text-sm font-bold disabled:opacity-50" style={{ background: theme.accent, color: theme.onAccent }}>{busy ? "Signing in…" : "Sign in"}</button>}
          {configured === false && notice && <p role="alert" className="text-sm text-amber-800">{notice}</p>}
        </form>
        {configured !== false && <p className="mt-5 text-xs" style={{ color: theme.muted }}>For privacy, this teacher session expires after 12 hours.</p>}
      </section>
    </main>
  );
}
