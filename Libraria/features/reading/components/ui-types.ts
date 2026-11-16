import type { ExamAssignment } from "@/features/classroom/data-model";
import type { ReadingTest } from "@/features/reading/data/reading-tests";

export type DesignStyle = "brutalism" | "claymorphism" | "editorial" | "fiction" | "neobrutalism" | "vintage";
export type ShadowMode = "hard-offset" | "soft-elevation" | "pillowed-clay";
export type Preferences = { theme: "light" | "dark"; designStyle: DesignStyle; shadowMode: ShadowMode; font: "serif" | "sans" | "mono"; fontSize: number; lineHeight: "relaxed" | "spacious" | "compact"; width: "narrow" | "wide"; focus: boolean };
export type ReaderTheme = { name: string; page: string; surface: string; ink: string; muted: string; border: string; accent: string; onAccent: string; dark: boolean };
export type PracticeCard = { questionNumber: number; prompt: string; options: string[]; optionLabels: "letters" | "plain"; answer: string; explanation: string };
export type StudentExamRow = { assignment: ExamAssignment; test: ReadingTest; expired: boolean; startsAt: number; endsAt: number };
