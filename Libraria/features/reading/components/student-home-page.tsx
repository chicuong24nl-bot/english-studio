"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
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

function relativeLuminance(hex: string) {
  const value = hex.slice(1);
  const expanded = value.length === 3 ? [...value].map((channel) => channel + channel).join("") : value;
  const [red, green, blue] = [0, 2, 4].map((index) => {
    const channel = Number.parseInt(expanded.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

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
  const loginMenuId = useId();
  const loginMenuRef = useRef<HTMLDivElement>(null);
  const loginTriggerRef = useRef<HTMLButtonElement>(null);
  const focusLastMenuItem = useRef(false);
  const labelColor = contrastRatio(theme.accent, theme.surface) >= 4.5 ? theme.accent : theme.ink;
  const controlBorderColor = contrastRatio(theme.border, theme.page) >= 3 ? theme.border : theme.muted;
  const surfaceBorderColor = contrastRatio(theme.border, theme.surface) >= 3 ? theme.border : theme.muted;
  const focusColor = contrastRatio(theme.accent, theme.page) >= 3 ? theme.accent : theme.ink;
  const primaryTextColor = contrastRatio(theme.onAccent, theme.accent) >= 4.5
    ? theme.onAccent
    : contrastRatio("#171717", theme.accent) >= 4.5 ? "#171717" : "#fff";

  useEffect(() => {
    if (!loginChoicesOpen) return;
    const items = loginMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    const itemIndex = focusLastMenuItem.current ? (items?.length ?? 1) - 1 : 0;
    items?.[itemIndex]?.focus();
    focusLastMenuItem.current = false;
  }, [loginChoicesOpen]);

  useEffect(() => {
    if (!loginChoicesOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!loginMenuRef.current?.contains(target) && !loginTriggerRef.current?.contains(target)) {
        setLoginChoicesOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [loginChoicesOpen]);

  function openLoginChoices(fromLastItem = false) {
    focusLastMenuItem.current = fromLastItem;
    setLoginChoicesOpen(true);
  }

  function handleLoginMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex: number | undefined;

    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % items.length;
    if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;

    if (nextIndex !== undefined) {
      event.preventDefault();
      items[nextIndex]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setLoginChoicesOpen(false);
      loginTriggerRef.current?.focus();
    }
  }

  return (
    <main className="mx-auto grid min-h-[calc(100dvh-120px)] w-full max-w-5xl content-center py-8 sm:py-12">
      <section
        aria-labelledby="student-sign-in-title"
        className="mx-auto w-full max-w-2xl rounded-[1.75rem] border p-6 sm:p-9 lg:p-10"
        style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }}
      >
        <div className="max-w-xl">
          <p className="flex items-center gap-2 text-sm font-medium" style={{ color: labelColor }}>
            <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: theme.accent }} />
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
                style={{ borderColor: controlBorderColor, background: theme.page, color: theme.ink, outlineColor: focusColor }}
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
              aria-busy={openingProfile}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-[filter,opacity] hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
              style={{ background: theme.accent, color: primaryTextColor, outlineColor: focusColor }}
            >
              <span aria-live="polite">{openingProfile ? "Opening profile…" : "Open my profile"}</span>
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
                style={{ borderColor: surfaceBorderColor, color: theme.ink, outlineColor: focusColor }}
              >
                <span className="min-w-0 break-words">
                  Continue as <span className="font-semibold">{rememberedName}</span>
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
              aria-controls={loginMenuId}
              ref={loginTriggerRef}
              onClick={() => loginChoicesOpen ? setLoginChoicesOpen(false) : openLoginChoices()}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  openLoginChoices(event.key === "ArrowUp");
                }
              }}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ borderColor: controlBorderColor, background: theme.page, color: theme.ink, outlineColor: focusColor }}
            >
              <LockKeyhole size={16} strokeWidth={1.75} aria-hidden="true" />
              Login as…
              <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
            {loginChoicesOpen && (
              <div
                role="menu"
                id={loginMenuId}
                ref={loginMenuRef}
                onKeyDown={handleLoginMenuKeyDown}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setLoginChoicesOpen(false);
                }}
                className="absolute left-0 top-full z-10 mt-2 w-full rounded-xl border p-2 shadow-lg"
                style={{ borderColor: surfaceBorderColor, background: theme.surface, color: theme.ink }}
              >
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setLoginChoicesOpen(false);
                    document.getElementById("home-student-code")?.focus();
                  }}
                  tabIndex={0}
                  className="block min-h-11 w-full rounded-lg px-3 text-left text-sm font-semibold hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
                  style={{ outlineColor: focusColor }}
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
                  tabIndex={-1}
                  className="block min-h-11 w-full rounded-lg px-3 text-left text-sm font-semibold hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
                  style={{ outlineColor: focusColor }}
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
