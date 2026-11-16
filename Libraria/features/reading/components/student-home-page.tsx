"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, ChevronDown, LockKeyhole } from "lucide-react";
import type { ReaderTheme } from "@/features/reading/components/ui-types";

type StudentHomePageProps = {
  rememberMe: boolean;
  rememberedName: string;
  hasRememberedStudent: boolean;
  openingProfile: boolean;
  theme: ReaderTheme;
  code: string;
  error: string;
  onCodeChange: (value: string) => void;
  onRememberChange: (value: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onResumeRemembered: () => void;
  onTeacherLogin: () => void;
};

export function StudentHomePage({
  rememberMe,
  rememberedName,
  hasRememberedStudent,
  openingProfile,
  theme,
  code,
  error,
  onCodeChange,
  onRememberChange,
  onSubmit,
  onResumeRemembered,
  onTeacherLogin,
}: StudentHomePageProps) {
  const [loginChoicesOpen, setLoginChoicesOpen] = useState(false);

  return (
    <main className="mx-auto grid min-h-[calc(100dvh-120px)] w-full max-w-5xl content-center py-8 sm:py-12">
      <section
        aria-labelledby="student-sign-in-title"
        className="mx-auto w-full max-w-2xl rounded-[1.75rem] border p-6 sm:p-9 lg:p-10"
        style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }}
      >
        <div className="max-w-xl">
          <p className="text-sm font-medium" style={{ color: theme.accent }}>
            Student sign in
          </p>
          <h1
            id="student-sign-in-title"
            className="mt-3 font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl"
          >
            Read what your teacher assigns
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-6" style={{ color: theme.muted }}>
            Enter your 9-digit student code to open your reading library and assigned exams.
          </p>

          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            <label htmlFor="home-student-code" className="block text-sm font-medium">
              Student code
              <input
                id="home-student-code"
                value={code}
                onChange={(event) => onCodeChange(event.target.value.replace(/\D/g, "").slice(0, 9))}
                maxLength={9}
                inputMode="numeric"
                autoComplete="off"
                placeholder="123456789"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "student-code-error" : undefined}
                className="mt-2 h-14 w-full rounded-xl border px-4 font-mono text-lg font-semibold tracking-[.2em] outline-none transition-colors focus:ring-2"
                style={{ borderColor: theme.border, background: theme.page, color: theme.ink }}
              />
            </label>

            <label className="inline-flex min-h-8 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => onRememberChange(event.target.checked)}
                className="h-4 w-4 accent-current"
              />
              Remember me on this device
            </label>

            {error && (
              <p id="student-code-error" role="alert" className="text-sm" style={{ color: theme.dark ? "#f0a0a5" : "#ad424c" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={code.length !== 9 || openingProfile}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-[filter,opacity] hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
              style={{ background: theme.accent, color: theme.onAccent, outlineColor: theme.accent }}
            >
              {openingProfile ? "Opening profile…" : "Open my profile"}
              <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </form>

          <p className="mt-3 text-xs leading-5" style={{ color: theme.muted }}>
            No code yet? Ask your teacher to create your student profile.
          </p>

          {hasRememberedStudent && (
            <div className="mt-6 border-t pt-5" style={{ borderColor: theme.border }}>
              <p className="text-sm" style={{ color: theme.muted }}>
                Already using this device?
              </p>
              <button
                type="button"
                onClick={onResumeRemembered}
                disabled={openingProfile}
                className="mt-2 inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-4 text-left text-sm font-semibold transition-[background-color,opacity] hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60"
                style={{ borderColor: theme.border, color: theme.ink, outlineColor: theme.accent }}
              >
                <span className="min-w-0 break-words">
                  Continue as <span className="font-semibold" style={{ color: theme.accent }}>{rememberedName}</span>
                </span>
                <ArrowRight className="shrink-0" size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          )}

          <div className="relative mt-5">
            <button
              type="button"
              aria-expanded={loginChoicesOpen}
              aria-haspopup="menu"
              onClick={() => setLoginChoicesOpen((open) => !open)}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ borderColor: theme.border, background: theme.page, color: theme.ink, outlineColor: theme.accent }}
            >
              <LockKeyhole size={16} strokeWidth={1.75} aria-hidden="true" />
              Login as…
              <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
            {loginChoicesOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full z-10 mt-2 w-full rounded-xl border p-2 shadow-lg"
                style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }}
              >
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setLoginChoicesOpen(false);
                    document.getElementById("home-student-code")?.focus();
                  }}
                  className="block min-h-11 w-full rounded-lg px-3 text-left text-sm font-semibold hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
                >
                  Student <span className="ml-1 text-xs font-normal" style={{ color: theme.muted }}>Use student code</span>
                </button>
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setLoginChoicesOpen(false);
                    onTeacherLogin();
                  }}
                  className="block min-h-11 w-full rounded-lg px-3 text-left text-sm font-semibold hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
                >
                  Teacher <span className="ml-1 text-xs font-normal" style={{ color: theme.muted }}>Sign in to classroom</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
