import type { ExamAssignment } from "@/features/classroom/data-model";
import type { ReadingTest } from "@/features/reading/data/reading-tests";

export type DesignStyle = "brutalism" | "claymorphism" | "editorial" | "fiction" | "neobrutalism" | "vintage";
export type ShadowMode = "hard-offset" | "soft-elevation" | "pillowed-clay";
export type Preferences = { theme: "light" | "dark"; designStyle: DesignStyle; shadowMode: ShadowMode; font: "serif" | "sans" | "mono"; fontSize: number; lineHeight: "relaxed" | "spacious" | "compact"; width: "narrow" | "wide"; focus: boolean };
export type ReaderTheme = { name: string; page: string; surface: string; ink: string; muted: string; border: string; accent: string; onAccent: string; dark: boolean };
export type PracticeCard = { questionNumber: number; prompt: string; options: string[]; optionLabels: "letters" | "plain"; answer: string; explanation: string };
export type StudentExamRow = { assignment: ExamAssignment; test: ReadingTest; expired: boolean; startsAt: number; endsAt: number };

function luminance(hex: string) {
  const value = hex.slice(1);
  const expanded = value.length === 3 ? [...value].map((channel) => channel + channel).join("") : value;
  const [red, green, blue] = [0, 2, 4].map((index) => {
    const channel = Number.parseInt(expanded.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: string, second: string) {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

export function accessibleAccentText(theme: Pick<ReaderTheme, "accent" | "ink" | "page" | "surface">) {
  return contrastRatio(theme.accent, theme.page) >= 4.5 && contrastRatio(theme.accent, theme.surface) >= 4.5
    ? theme.accent
    : theme.ink;
}

export function accessibleAccentForeground(theme: Pick<ReaderTheme, "accent" | "ink" | "onAccent">) {
  if (contrastRatio(theme.onAccent, theme.accent) >= 4.5) return theme.onAccent;
  return contrastRatio(theme.ink, theme.accent) >= 4.5 ? theme.ink : "#fff";
}
