"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Bookmark, BookOpen, CalendarClock, Check, CheckCircle2, ChevronDown, Clock3, Layers3, LockKeyhole, Minus, Plus, RotateCcw, Search, Settings2, Sparkles, StickyNote, Type, UserRound, X, XCircle } from "lucide-react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { englishCurriculum } from "@/content/english-curriculum";
import { readingVocabularyDecks } from "@/features/reading/data/vocabulary-decks";
import { getReadingParagraphs, readingTests, type IELTSQuestionType, type ReadingFlashcard, type ReadingPassage, type ReadingQuestion, type ReadingTest } from "@/features/reading/data/reading-tests";
import { CUSTOM_TESTS_STORAGE_KEY, createLocalId, createStudentJoinCode, DEFAULT_STUDENT_ID, EXAMS_STORAGE_KEY, SELECTED_STUDENT_STORAGE_KEY, STUDENTS_STORAGE_KEY, TEACHING_POINTER_STORAGE_KEY, emptyStudentProgress, studentNotesKey, studentProgressKey, type ExamAssignment, type ReadingNote, type ReadingTestDraft, type StudentProfile, type StudentProgress, type TeachingPointer } from "@/features/classroom/data-model";
import { TeacherDashboard } from "@/features/classroom/components/teacher-dashboard";
import { TeacherLoginGate } from "@/features/classroom/components/teacher-login-gate";
import { collectLocalClassroomState, persistSharedClassroomValue } from "@/features/classroom/client-sync";

const LEGACY_STORAGE_KEY = "english-reader-progress";
const SETTINGS_KEY = "english-reader-settings";
const NOTES_ENABLED = false;
type Progress = StudentProgress;
type PracticeStep = "home" | "test" | "section" | "setup";
type DesignStyle = "brutalism" | "claymorphism" | "editorial" | "fiction" | "neobrutalism" | "vintage";
type ShadowMode = "hard-offset" | "soft-elevation" | "pillowed-clay";
type Preferences = { theme: "light" | "dark"; designStyle: DesignStyle; shadowMode: ShadowMode; font: "serif" | "sans" | "mono"; fontSize: number; lineHeight: "relaxed" | "spacious" | "compact"; width: "narrow" | "wide"; focus: boolean };
type ReaderTheme = { name: string; page: string; surface: string; ink: string; muted: string; border: string; accent: string; onAccent: string; dark: boolean };
type PracticeCard = { questionNumber: number; prompt: string; options: string[]; optionLabels: "letters" | "plain"; answer: string; explanation: string };
type StudentExamRow = { assignment: ExamAssignment; test: ReadingTest; expired: boolean; startsAt: number; endsAt: number };
const emptyProgress: Progress = emptyStudentProgress;
const defaults: Preferences = { theme: "light", designStyle: "editorial", shadowMode: "soft-elevation", font: "serif", fontSize: 21, lineHeight: "relaxed", width: "narrow", focus: false };
const designStyles: Record<DesignStyle, { name: string; description: string; light: ReaderTheme; dark: ReaderTheme }> = {
  brutalism: { name: "Brutalism", description: "Raw grid, hard edges, ink-heavy hierarchy", light: { name: "Light", page: "#efeee9", surface: "#fbfaf6", ink: "#171717", muted: "#505050", border: "#171717", accent: "#c94e39", onAccent: "#fff", dark: false }, dark: { name: "Dark", page: "#171717", surface: "#222222", ink: "#f4f0e8", muted: "#c3bdb2", border: "#e5ded2", accent: "#ff8066", onAccent: "#171717", dark: true } },
  claymorphism: { name: "Claymorphism", description: "Soft molded cards with pillowy depth", light: { name: "Light", page: "#e8f0ff", surface: "#f8fbff", ink: "#1c398e", muted: "#566b9d", border: "#c7d8f5", accent: "#3b82f6", onAccent: "#fff", dark: false }, dark: { name: "Dark", page: "#17213b", surface: "#243354", ink: "#eff4ff", muted: "#b8c9ee", border: "#3a527c", accent: "#85b2ff", onAccent: "#17213b", dark: true } },
  editorial: { name: "Editorial", description: "A magazine-like reading desk with serif rhythm", light: { name: "Light", page: "#f5f1e8", surface: "#fffdf8", ink: "#22201d", muted: "#71695e", border: "#d9d1c4", accent: "#9b593c", onAccent: "#fff", dark: false }, dark: { name: "Dark", page: "#1a1b1a", surface: "#242624", ink: "#f2eee6", muted: "#b9b2a7", border: "#454640", accent: "#d99a73", onAccent: "#1a1b1a", dark: true } },
  fiction: { name: "Fiction", description: "Storybook panels, warm color, friendly shape", light: { name: "Light", page: "#ffe9ce", surface: "#fffdf8", ink: "#222222", muted: "#574735", border: "#222222", accent: "#df684d", onAccent: "#222", dark: false }, dark: { name: "Dark", page: "#241e1b", surface: "#332a25", ink: "#fff2df", muted: "#d3bea6", border: "#f0d9bd", accent: "#ff9675", onAccent: "#241e1b", dark: true } },
  neobrutalism: { name: "Neobrutalism", description: "Loud blocks, bold outlines, offset depth", light: { name: "Light", page: "#fff8de", surface: "#fffefa", ink: "#1c293c", muted: "#4d5360", border: "#202020", accent: "#e5b900", onAccent: "#1c293c", dark: false }, dark: { name: "Dark", page: "#1c202d", surface: "#292f40", ink: "#f7f4ea", muted: "#c4c6ce", border: "#f3efe3", accent: "#ffd633", onAccent: "#1c293c", dark: true } },
  vintage: { name: "Vintage", description: "Retro paper, tactile controls, old print cues", light: { name: "Light", page: "#e9e5d8", surface: "#f6f3e9", ink: "#202525", muted: "#59635f", border: "#a7aaa0", accent: "#006b65", onAccent: "#fff", dark: false }, dark: { name: "Dark", page: "#202523", surface: "#2a312e", ink: "#e6e3d8", muted: "#b6b9ad", border: "#66746d", accent: "#56c7b3", onAccent: "#17211e", dark: true } },
};

function readStudentProgress(studentId: string): Progress {
  try {
    const raw = localStorage.getItem(studentProgressKey(studentId)) ?? (studentId === DEFAULT_STUDENT_ID ? localStorage.getItem(LEGACY_STORAGE_KEY) ?? localStorage.getItem("lingo-english-local-progress") : null);
    if (!raw) return emptyProgress;
    const stored = JSON.parse(raw);
    return {
      read: Array.isArray(stored.read) ? stored.read : Array.isArray(stored.completed) ? stored.completed : [],
      readsStarted: Array.isArray(stored.readsStarted) ? stored.readsStarted : [],
      saved: Array.isArray(stored.saved) ? stored.saved : [],
      testsDone: Array.isArray(stored.testsDone) ? stored.testsDone : [],
      testsCompletedAt: stored.testsCompletedAt && typeof stored.testsCompletedAt === "object" ? stored.testsCompletedAt : {},
      testsStarted: Array.isArray(stored.testsStarted) ? stored.testsStarted : [],
      testScores: stored.testScores && typeof stored.testScores === "object" ? stored.testScores : {},
      testDrafts: stored.testDrafts && typeof stored.testDrafts === "object" ? stored.testDrafts : {},
    };
  } catch {
    return emptyProgress;
  }
}

function answerIsCorrect(question: ReadingQuestion, answer: number | string | undefined) {
  if (answer === undefined) return false;
  if (typeof question.answer === "number") return answer === question.answer;
  if (typeof answer === "number") return question.options[answer]?.trim().toLocaleLowerCase() === question.answer.trim().toLocaleLowerCase();
  return String(answer).trim().toLocaleLowerCase() === question.answer.trim().toLocaleLowerCase();
}

function timeAgo(timestamp: string | undefined, now: number) {
  if (!timestamp) return "Just started";
  const minutes = Math.max(0, Math.floor((now - new Date(timestamp).getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

function readPracticeLocation() {
  const params = new URLSearchParams(window.location.search);
  const route = params.get("practice");
  const steps: Record<string, PracticeStep> = {
    "choose-test": "test",
    "choose-section": "section",
    "deck-setup": "setup",
  };
  const step = steps[route ?? ""] ?? "home";
  const rawSections = params.get("sections");
  const sectionValues = rawSections === null ? [1] : rawSections.split(",").map(Number).filter((section) => Number.isInteger(section) && section > 0);
  const count = Number(params.get("count"));
  return {
    step,
    testId: params.get("test") ?? "",
    sections: [...new Set(sectionValues)],
    count: Number.isInteger(count) && count > 0 ? count : 12,
  };
}

function questionGroupInstructions(test: ReadingTest, questionIndex: number) {
  const questionNumber = (test.questionNumberStart ?? (test.id === "ielts-hiv-pandemic" ? 13 : 1)) + questionIndex;
  const customGroup = test.questionGroups?.find((group) => group.startQuestion === questionNumber);
  if (customGroup) return { title: `Questions ${customGroup.startQuestion}–${customGroup.endQuestion}`, text: customGroup.instructions };
  const testId = test.id;
  if (testId === "ielts-reading-test-1" && questionIndex === 0) return {
    title: "Questions 1–8",
    text: "Reading Passage 1 has eight paragraphs, A–H. What paragraph has the following information? Write the correct letter, A–H, in boxes 1–8 on your answer sheet.",
  };
  if (testId === "ielts-reading-test-1" && questionIndex === 8) return {
    title: "Questions 9–12",
    text: "Complete the sentences using NO MORE THAN TWO WORDS from the passage. Write your answers in boxes 9–12 on your answer sheet.",
  };
  if (testId === "ielts-reading-test-1" && questionIndex === 12) return {
    title: "Questions 13–20",
    text: "Do the following statements agree with the information in the passage? Write TRUE if a statement agrees, FALSE if it contradicts the passage, or NOT GIVEN if the passage does not provide that information.",
  };
  if (testId === "ielts-reading-test-1" && questionIndex === 20) return {
    title: "Questions 21–28",
    text: "Complete the sentences below. Write NO MORE THAN TWO WORDS from the passage for each answer. Write your answers in boxes 21–28 on your answer sheet.",
  };
  if (testId === "ielts-reading-test-1" && questionIndex === 28) return {
    title: "Section 3 · Questions 29–33",
    text: "Choose the correct letter, A, B, C or D. Write the correct letter in boxes 29–33 on your answer sheet.",
  };
  if (testId === "ielts-reading-test-1" && questionIndex === 33) return {
    title: "Questions 34–40",
    text: "Complete the sentences below. Write ONLY ONE WORD from the passage for each answer. Write your answers in boxes 34–40 on your answer sheet.",
  };
  return null;
}

function MatchingHeadingPicker({ question, selectedIndex, disabled, revealResult, earnedPoint, onSelect, theme }: {
  question: ReadingQuestion;
  selectedIndex: number | undefined;
  disabled: boolean;
  revealResult: boolean;
  earnedPoint: boolean;
  onSelect: (index: number) => void;
  theme: ReaderTheme;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const answerIndex = typeof question.answer === "number" ? question.answer : question.options.findIndex((option) => option.trim().toLocaleLowerCase() === String(question.answer).trim().toLocaleLowerCase());
  const isParagraph = question.type === "matching-headings";
  const isTruthStatement = question.type === "true-false-not-given" || question.type === "yes-no-not-given";
  const selectedOption = selectedIndex === undefined ? null : question.options[selectedIndex];
  const selectedLetter = selectedOption?.match(/^([A-H])(?:\s*[–-]\s*(.*))?$/i);
  const selectedLabel = isParagraph ? `${selectedLetter?.[1]?.toUpperCase() ?? selectedOption}${selectedLetter?.[2] ? ` — ${selectedLetter[2]}` : selectedLetter ? ` — Paragraph ${selectedLetter[1].toUpperCase()}` : ""}` : selectedOption;
  useEffect(() => {
    if (!dropdownOpen) return;
    const closeOnOutside = (event: PointerEvent) => { if (event.target instanceof Node && !dropdownRef.current?.contains(event.target)) setDropdownOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setDropdownOpen(false); };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeOnOutside); document.removeEventListener("keydown", closeOnEscape); };
  }, [dropdownOpen]);
  if (isParagraph || isTruthStatement) return <div ref={dropdownRef} className="relative mt-3 max-w-md">
    <motion.button type="button" disabled={disabled} aria-label={selectedIndex === undefined ? isParagraph ? "Select a paragraph" : "Select an answer" : isParagraph ? `Selected paragraph ${selectedLetter?.[1]?.toUpperCase() ?? selectedOption}. Change answer` : `Selected ${selectedOption}. Change answer`} aria-haspopup="listbox" aria-expanded={dropdownOpen} onClick={() => setDropdownOpen((open) => !open)} whileTap={disabled ? undefined : { scale: 0.99 }} className="flex h-12 w-full items-center justify-between rounded-xl border px-4 text-left text-sm font-semibold transition-colors disabled:cursor-default" style={{ borderColor: dropdownOpen || selectedIndex !== undefined ? theme.accent : theme.border, background: theme.surface, color: selectedIndex === undefined ? theme.muted : theme.ink }}>
      <span>{selectedIndex === undefined ? isParagraph ? "Select a paragraph" : "Select an answer" : isParagraph ? selectedLetter?.[1]?.toUpperCase() ?? selectedOption : selectedOption}</span>
      <motion.span animate={{ rotate: dropdownOpen ? 180 : 0 }} transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 30 }}><ChevronDown size={17} /></motion.span>
    </motion.button>
    <AnimatePresence initial={false}>{dropdownOpen && <motion.div role="listbox" aria-label="Paragraph choices" initial={reduceMotion ? false : { opacity: 0, y: -7, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -5, scale: 0.99 }} transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 34 }} className="absolute inset-x-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-2xl border p-1.5 shadow-xl" style={{ borderColor: theme.border, background: theme.surface, transformOrigin: "top" }}>
      {question.options.map((option, index) => { const letter = option.match(/^([A-H])/i)?.[1]?.toUpperCase() ?? option; const selected = selectedIndex === index; const correctOption = answerIndex === index; const wrongSelected = revealResult && selected && !earnedPoint; return <button key={option + index} type="button" role="option" aria-selected={selected} disabled={disabled} onClick={() => { onSelect(index); setDropdownOpen(false); }} className="flex h-10 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-semibold transition-colors" style={{ background: wrongSelected ? (theme.dark ? "#472a30" : "#fff0f0") : revealResult && correctOption ? (theme.dark ? "#233a2d" : "#e9f5ed") : selected ? theme.accent + "16" : "transparent", color: wrongSelected ? "#ad424c" : revealResult && correctOption ? "#286b43" : selected ? theme.accent : theme.ink }}><span>{isParagraph ? letter : option}</span>{wrongSelected ? <XCircle size={15} /> : revealResult && correctOption || selected ? <Check size={15} /> : null}</button>; })}
    </motion.div>}</AnimatePresence>
  </div>;
  return <div className="mt-5" aria-label="Choose a paragraph">
    <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-sm font-bold">{isParagraph ? "Choose a paragraph" : "Choose your answer"}</p><p className="mt-1 text-xs" style={{ color: theme.muted }}>Swipe the cards, then tap one to select.</p></div><span className="shrink-0 text-xs font-semibold" style={{ color: theme.muted }}>{selectedIndex === undefined ? "0" : selectedIndex + 1} / {question.options.length}</span></div>
    <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-3 [scrollbar-width:thin]" role="group" aria-label="Paragraph choices">
      {question.options.map((option, index) => {
        const selected = selectedIndex === index;
        const correctOption = answerIndex === index;
        const wrongSelected = revealResult && selected && !earnedPoint;
        const cardBorder = wrongSelected ? "#d56b73" : revealResult && correctOption ? "#5b9b70" : selected ? theme.accent : theme.border;
        const cardBackground = wrongSelected ? (theme.dark ? "#472a30" : "#fff0f0") : revealResult && correctOption ? (theme.dark ? "#233a2d" : "#e9f5ed") : selected ? theme.accent + "12" : theme.page;
        const letter = option.match(/^([A-H])(?:\s*[–-]\s*(.*))?$/i);
        const statementHint = option.toLocaleLowerCase() === "true" ? "The passage supports this" : option.toLocaleLowerCase() === "false" ? "The passage contradicts this" : option.toLocaleLowerCase() === "not given" ? "The passage doesn’t say" : "Choose this answer";
        return <motion.button key={option + index} type="button" disabled={disabled} aria-pressed={selected} onClick={() => onSelect(index)} whileTap={disabled ? undefined : { scale: 0.97 }} className="relative flex min-h-32 w-32 shrink-0 snap-start flex-col items-start justify-between rounded-2xl border p-4 text-left transition-colors disabled:cursor-default sm:w-36" style={{ borderColor: cardBorder, background: cardBackground, color: theme.ink, boxShadow: selected ? `0 5px 18px ${theme.accent}18` : undefined }}>
          <span className="flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-base font-bold" style={{ background: selected ? theme.accent : theme.surface, color: selected ? theme.surface : theme.ink }}>{isParagraph ? letter?.[1]?.toUpperCase() ?? option : option}</span>
          <span className="text-xs font-semibold leading-5" style={{ color: theme.muted }}>{isParagraph ? letter?.[2] || `Paragraph ${letter?.[1]?.toUpperCase() ?? option}` : isTruthStatement ? statementHint : "Choose this answer"}</span>
          {wrongSelected && <XCircle size={17} className="absolute right-3 top-3 text-rose-600" aria-label="Incorrect answer" />}
          {revealResult && correctOption && <CheckCircle2 size={17} className="absolute right-3 top-3 text-emerald-600" aria-label="Correct answer" />}
        </motion.button>;
      })}
    </div>
    <div className="mt-1 flex items-center justify-center gap-2" aria-label="Choose an answer">
      {question.options.map((option, index) => <button key={option + index} type="button" disabled={disabled} aria-label={isParagraph ? `Select paragraph ${option.match(/^([A-H])/i)?.[1]?.toUpperCase() ?? option}` : `Select ${option}`} aria-pressed={selectedIndex === index} onClick={() => onSelect(index)} className="h-2.5 w-2.5 rounded-full transition-all disabled:cursor-default" style={{ background: selectedIndex === index ? theme.accent : theme.border, transform: selectedIndex === index ? "scale(1.25)" : undefined }} />)}
    </div>
    <p aria-live="polite" className="mt-4 min-h-6 text-sm font-semibold" style={{ color: revealResult ? earnedPoint ? theme.accent : "#b4434d" : selectedIndex === undefined ? theme.muted : theme.accent }}>
      {selectedIndex === undefined ? isParagraph ? "Select a paragraph" : "Select an answer" : `Selected: ${selectedLabel}`}
    </p>
  </div>;
}

function FlashcardPracticeView({ cards, theme, onClose }: { cards: PracticeCard[]; theme: ReaderTheme; onClose: () => void }) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [complete, setComplete] = useState(false);
  const [knownCount, setKnownCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [dragDirection, setDragDirection] = useState<"know" | "review" | null>(null);
  const [slideDirection, setSlideDirection] = useState<"next" | "previous" | "know" | "review">("next");
  const [keyPulse, setKeyPulse] = useState(false);
  const dragX = useMotionValue(0);
  const dragRotation = useTransform(dragX, [-240, 240], [-18, 18]);
  const card = cards[index];
  useEffect(() => {
    if (!complete || cards.length < 10 || reduceMotion) return;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([30, 50, 30]);
  }, [cards.length, complete, reduceMotion]);
  if (!card) return null;
  const advance = (result: "know" | "review", direction: "next" | "know" | "review" = "next") => {
    if (result === "know") setKnownCount((count) => count + 1);
    if (result === "review") setReviewCount((count) => count + 1);
    if (index >= cards.length - 1) { setComplete(true); return; }
    setSlideDirection(direction);
    setIndex((current) => current + 1);
    setShowAnswer(false);
    setDragDirection(null);
    dragX.set(0);
  };
  const previous = () => { setSlideDirection("previous"); setIndex((current) => Math.max(0, current - 1)); setShowAnswer(false); setDragDirection(null); dragX.set(0); };
  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number }; velocity: { x: number } }) => {
    const direction = info.offset.x > 0 || info.velocity.x > 500 ? "know" : "review";
    const committed = Math.abs(info.offset.x) >= 120 || Math.abs(info.velocity.x) > 500;
    if (showAnswer && committed) advance(direction, direction);
    else setDragDirection(null);
  };
  const cardVariants = {
    enter: (direction: "next" | "previous" | "know" | "review") => reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction === "next" || direction === "review" ? 64 : -64, scale: .92 },
    center: { opacity: 1, x: 0, scale: 1 },
    exit: (direction: "next" | "previous" | "know" | "review") => reduceMotion ? { opacity: 0 } : { opacity: .35, x: direction === "next" || direction === "review" ? -64 : 64, scale: .88 },
  };
  return <motion.main initial={reduceMotion ? false : { opacity: 0, y: 16, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduceMotion ? undefined : { opacity: 0, y: -12, scale: .99 }} transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 28, mass: .8 }} className="mx-auto max-w-3xl pb-16 pt-8">
    {complete ? <section className="relative overflow-hidden rounded-[2rem] border p-7 text-center shadow-sm sm:p-12" style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }}><span className="pointer-events-none absolute left-1/2 top-1/3" aria-hidden="true">{cards.length >= 10 && !reduceMotion && Array.from({ length: 16 }, (_, particle) => { const angle = particle / 16 * Math.PI * 2; const distance = 78 + (particle % 3) * 24; return <motion.i key={particle} className="absolute h-2 w-2 rounded-sm" style={{ background: [theme.accent, "#10b981", "#f59e0b", "#14b8a6"][particle % 4] }} initial={{ x: 0, y: 0, opacity: 1, scale: 0 }} animate={{ x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, opacity: 0, scale: [0, 1, 0], rotate: particle * 47 }} transition={{ duration: .9, ease: "easeOut" }} />; })}</span><span className="relative mx-auto grid h-16 w-16 place-items-center rounded-full" style={{ background: theme.accent + "18", color: theme.accent }}><Check size={30} /></span><p className="mt-6 text-xs font-bold uppercase tracking-[.2em]" style={{ color: theme.accent }}>Practice complete</p><h1 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">Nice work.</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6" style={{ color: theme.muted }}>You reviewed {cards.length} words and phrases.</p><div className="mx-auto mt-5 flex max-w-sm justify-center gap-3 text-sm"><span className="rounded-full px-3 py-1.5 font-semibold" style={{ background: "#10b98118", color: "#07834f" }}>{knownCount} known</span><span className="rounded-full px-3 py-1.5 font-semibold" style={{ background: "#f59e0b18", color: "#a56600" }}>{reviewCount} to review</span></div><div className="mt-7 flex flex-wrap justify-center gap-3"><button type="button" onClick={() => { setIndex(0); setShowAnswer(false); setKnownCount(0); setReviewCount(0); setComplete(false); }} className="min-h-12 rounded-full border px-5 py-3 text-sm font-semibold" style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }}>Review again</button><button type="button" onClick={onClose} className="inline-flex min-h-12 items-center gap-2 rounded-full px-6 py-3 text-sm font-bold" style={{ background: theme.accent, color: theme.onAccent }}>Back to practice <ArrowRight size={16} /></button></div></section> : <>
      <div className="mb-5 flex items-center justify-between gap-3"><button type="button" onClick={onClose} className="inline-flex min-h-10 items-center gap-2 rounded-full px-2 text-sm font-semibold" style={{ color: theme.muted }}><ArrowLeft size={16} />Exit practice</button><span className="text-sm font-semibold tabular-nums" style={{ color: theme.ink }}>{index + 1}<span style={{ color: theme.muted }}> / {cards.length}</span></span></div>
      <div className="mb-7"><div className="mb-2 flex items-center justify-between text-[11px] font-semibold" style={{ color: theme.muted }}><span>Vocabulary review</span><span>{Math.round(((index + 1) / cards.length) * 100)}%</span></div><div className="h-1.5 overflow-hidden rounded-full" style={{ background: theme.border }}><motion.div className="h-full rounded-full" animate={{ width: `${((index + 1) / cards.length) * 100}%` }} transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 180, damping: 24 }} style={{ background: theme.accent }} /></div></div>
      <div className="relative isolate h-[22rem] sm:h-[26rem]" style={{ perspective: 1200 }}>
        <AnimatePresence mode="sync" initial={false} custom={slideDirection}><motion.div key={index} custom={slideDirection} variants={cardVariants} initial="enter" role="button" tabIndex={0} aria-pressed={showAnswer} aria-label={showAnswer ? `Meaning: ${card.answer}. Tap to see the term.` : `Flashcard term: ${card.prompt}. Tap to reveal the meaning.`} onClick={() => setShowAnswer((value) => !value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setKeyPulse(true); window.setTimeout(() => { setKeyPulse(false); setShowAnswer((value) => !value); }, reduceMotion ? 0 : 80); } }} drag={showAnswer ? "x" : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={.12} dragMomentum={false} onDrag={(_, info) => setDragDirection(info.offset.x > 35 ? "know" : info.offset.x < -35 ? "review" : null)} onDragEnd={handleDragEnd} whileHover={reduceMotion ? undefined : { y: -3, scale: 1.015 }} whileTap={reduceMotion ? undefined : { scale: .995 }} animate={keyPulse ? { x: 0, y: 0, opacity: 1, scale: .97 } : "center"} exit="exit" transition={reduceMotion ? { duration: .18, ease: "easeOut" } : { duration: .34, ease: [.22, 1, .36, 1] }} className="absolute inset-0 z-10 cursor-grab rounded-[2rem] outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-offset-4" style={{ touchAction: "pan-y", rotate: dragRotation }}>
          <motion.div initial={false} animate={reduceMotion ? { rotateY: 0, scale: 1 } : { rotateY: showAnswer ? 180 : 0, scale: [1, .985, 1] }} transition={reduceMotion ? { duration: .18, ease: "easeOut" } : { duration: .46, ease: [.22, 1, .36, 1] }} className="relative min-h-[22rem] w-full sm:min-h-[26rem]" style={{ transformStyle: "preserve-3d" }}>
            <div className="absolute inset-0 flex min-h-[22rem] flex-col items-center justify-center overflow-hidden rounded-[2rem] border p-7 text-center shadow-[0_18px_50px_rgba(20,35,31,.08)] sm:min-h-[26rem] sm:p-12" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", opacity: reduceMotion && showAnswer ? 0 : 1, visibility: reduceMotion && showAnswer ? "hidden" : "visible", zIndex: reduceMotion && showAnswer ? 0 : 1, borderColor: dragDirection === "know" ? "#10b981" : dragDirection === "review" ? "#f59e0b" : theme.border, background: theme.surface, color: theme.ink, boxShadow: dragDirection ? `0 0 0 3px ${dragDirection === "know" ? "#10b981" : "#f59e0b"}33, 0 18px 50px rgba(20,35,31,.12)` : undefined }}><span aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full blur-3xl" style={{ background: theme.accent + "12" }} /><AnimatePresence>{dragDirection && showAnswer && <motion.span initial={{ opacity: 0, scale: .7 }} animate={{ opacity: 1, scale: 1.2 }} exit={{ opacity: 0 }} className="absolute right-6 top-6 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: dragDirection === "know" ? "#07834f" : "#a56600", background: dragDirection === "know" ? "#10b98120" : "#f59e0b20" }}>{dragDirection === "know" ? "Know it" : "Review"}</motion.span>}</AnimatePresence><span className="relative rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.15em]" style={{ color: theme.accent, background: theme.accent + "14" }}>Think of the meaning</span><h1 className="relative mt-8 max-w-xl font-serif text-3xl font-semibold leading-tight sm:text-4xl">{card.prompt}</h1>{card.options.length > 0 && <ol className="relative mt-6 w-full max-w-lg space-y-2 text-left">{card.options.map((option, optionIndex) => <li key={optionIndex} className="rounded-xl border px-4 py-3 text-sm leading-6" style={{ borderColor: theme.border, background: theme.page }}>{card.optionLabels === "letters" && <span className="mr-2 font-bold" style={{ color: theme.accent }}>{String.fromCharCode(65 + optionIndex)}.</span>}{option}</li>)}</ol>}<span className="relative mt-8 text-xs" style={{ color: theme.muted }}>Tap card to reveal answer</span></div>
            <div className="absolute inset-0 flex min-h-[22rem] flex-col items-center justify-center overflow-hidden rounded-[2rem] border p-7 text-center shadow-[0_18px_50px_rgba(20,35,31,.08)] sm:min-h-[26rem] sm:p-12 transition-colors duration-200" style={{ transform: reduceMotion ? "none" : "rotateY(180deg)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", opacity: reduceMotion && !showAnswer ? 0 : 1, visibility: reduceMotion && !showAnswer ? "hidden" : "visible", zIndex: reduceMotion && showAnswer ? 1 : 0, borderColor: theme.accent + "55", background: theme.page, color: theme.ink }}><span className="rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.18em]" style={{ color: theme.accent, background: theme.accent + "14" }}>Meaning</span><h1 className="mt-4 max-w-xl font-serif text-2xl font-semibold leading-relaxed sm:text-3xl">{card.answer}</h1>{card.explanation && <p className="mt-5 max-w-xl text-sm font-medium leading-6" style={{ color: theme.muted }}>{card.explanation}</p>}<span className="mt-6 text-xs" style={{ color: theme.muted }}>Tap card to see the term</span></div>
          </motion.div>
        </motion.div></AnimatePresence>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={previous} disabled={index === 0} className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold disabled:opacity-35" style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }}><ArrowLeft size={15} />Previous</button><div className="flex flex-wrap items-center justify-end gap-2">{!showAnswer ? <button type="button" onClick={() => setShowAnswer(true)} className="min-h-12 rounded-full px-6 py-3 text-sm font-bold shadow-sm transition hover:shadow-md" style={{ background: theme.accent, color: theme.onAccent }}>Show answer</button> : <><button type="button" onClick={() => advance("review", "next")} className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition hover:shadow-sm" style={{ borderColor: "#f59e0b66", background: "#f59e0b12", color: theme.dark ? "#f4c66b" : "#946000" }}><RotateCcw size={15} />Review</button><button type="button" onClick={() => advance("know", "next")} className="inline-flex min-h-12 items-center gap-2 rounded-full px-6 py-3 text-sm font-bold shadow-sm transition hover:shadow-md" style={{ background: theme.accent, color: theme.onAccent }}>{index === cards.length - 1 ? "Finish deck" : "Next card"}<ArrowRight size={16} /></button></>}</div></div>
    </>}
  </motion.main>;
}

function ReadingSticker({ theme, reduceMotion }: { theme: ReaderTheme; reduceMotion: boolean | null }) {
  return <div aria-hidden="true" className="flex shrink-0 items-center justify-center">
    <motion.div animate={reduceMotion ? undefined : { y: [0, -5, 0], rotate: [-3, 1, -3] }} transition={reduceMotion ? undefined : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }} className="relative grid h-[4.5rem] w-[4.5rem] place-items-center rounded-[1.35rem] border-[3px] border-white/90 shadow-[0_8px_22px_rgba(34,29,20,.2)]" style={{ background: `linear-gradient(145deg, ${theme.accent}, ${theme.accent}cc)` }}>
      <BookOpen size={31} strokeWidth={1.8} color={theme.surface} />
      <motion.span animate={reduceMotion ? undefined : { scale: [1, 1.18, 1], opacity: [.75, 1, .75] }} transition={reduceMotion ? undefined : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }} className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full border-2 border-white shadow-sm" style={{ background: "#f6c86f", color: "#5c3e1f" }}><Sparkles size={13} strokeWidth={2.4} /></motion.span>
      <span className="absolute -bottom-1 -left-1 h-3 w-3 rounded-full border-2 border-white" style={{ background: theme.accent }} />
    </motion.div>
  </div>;
}

function ReadingTestView({ test, theme, preferences, exam, studentId, draft, notes, teacherPointer, onDraftChange, onAddNote, onUpdateNote, onBack, onComplete }: { test: ReadingTest; theme: ReaderTheme; preferences: Preferences; exam?: ExamAssignment | null; studentId: string; draft?: ReadingTestDraft; notes: ReadingNote[]; teacherPointer: TeachingPointer | null; onDraftChange: (testId: string, draft: ReadingTestDraft) => void; onAddNote: (note: ReadingNote) => void; onUpdateNote: (noteId: string, text: string) => void; onBack: () => void; onComplete: (score: number, answers: Record<number, number | string>) => void }) {
  const reduceMotion = useReducedMotion();
  const [answers, setAnswers] = useState<Record<number, number | string>>(() => exam?.answers ?? draft?.answers ?? {});
  const [submitted, setSubmitted] = useState(() => Boolean(exam?.completedAt));
  const [activeSection, setActiveSection] = useState<number | null>(() => draft?.activeSection ?? null);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [knownFlashcards, setKnownFlashcards] = useState<string[]>([]);
  const [notePanelOpen, setNotePanelOpen] = useState(false);
  const [noteContext, setNoteContext] = useState("Reading test");
  const [noteQuote, setNoteQuote] = useState("");
  const [noteText, setNoteText] = useState("");
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState("");
  const score = test.questions.reduce((total, question, index) => total + (answerIsCorrect(question, answers[index]) ? 1 : 0), 0);
  const deadline = exam ? Math.min(new Date(exam.startsAt).getTime() + exam.durationMinutes * 60_000, exam.closesAt ? new Date(exam.closesAt).getTime() : Number.POSITIVE_INFINITY) : null;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() => deadline === null ? null : Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
  const submitTimerRef = useRef<() => void>(() => undefined);
  const fontFamily = preferences.font === "serif" ? "Georgia, 'Times New Roman', serif" : preferences.font === "mono" ? "ui-monospace, SFMono-Regular, monospace" : "Arial, Helvetica, sans-serif";
  const passages: ReadingPassage[] = test.passages?.length ? test.passages : [{ title: "Reading passage", text: test.passage }];
  const legacySectionedTest = test.id === "ielts-reading-test-1" && passages.length === 3;
  const isSectionedTest = passages.length > 1 && (legacySectionedTest || test.questions.some((question) => question.passageIndex !== undefined));
  const questionRanges = [[0, 12], [12, 28], [28, 40]] as const;
  const sectionPages = passages.map((passage, index) => ({
    passageIndex: index,
    section: passage.section ?? index + 1,
    title: passage.title,
    range: legacySectionedTest ? questionRanges[index] ?? [0, test.questions.length] as const : (() => {
      const indexes = test.questions.flatMap((question, questionIndex) => (question.passageIndex ?? 0) === index ? [questionIndex] : []);
      return indexes.length ? [indexes[0], indexes[indexes.length - 1] + 1] as const : [0, 0] as const;
    })(),
  }));
  const activeSectionPage = sectionPages.find((section) => section.section === activeSection) ?? null;
  const shownPassages = activeSectionPage ? passages.filter((passage) => (passage.section ?? 1) === activeSection) : passages;
  const lastFollowedTeacherPosition = useRef("");
  useEffect(() => {
    if (!teacherPointer || teacherPointer.testId !== test.id || !isSectionedTest) { lastFollowedTeacherPosition.current = ""; return; }
    const positionKey = `${teacherPointer.section}:${teacherPointer.paragraphIndex}`;
    if (lastFollowedTeacherPosition.current === positionKey) return;
    lastFollowedTeacherPosition.current = positionKey;
    if (activeSection !== teacherPointer.section) setActiveSection(teacherPointer.section);
    const timer = window.setTimeout(() => document.getElementById(`teacher-passage-${test.id}-${teacherPointer.section}-${teacherPointer.paragraphIndex}`)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" }), 90);
    return () => window.clearTimeout(timer);
  }, [teacherPointer?.testId, teacherPointer?.section, teacherPointer?.paragraphIndex, test.id, isSectionedTest, reduceMotion]);
  const questionEntries = test.questions.map((question, index) => ({ question, index })).filter(({ index }) => {
    if (!isSectionedTest || !activeSectionPage) return true;
    return legacySectionedTest ? index >= activeSectionPage.range[0] && index < activeSectionPage.range[1] : (test.questions[index].passageIndex ?? 0) === activeSectionPage.passageIndex;
  });
  useEffect(() => {
    if (!exam && !submitted) onDraftChange(test.id, { answers, activeSection, updatedAt: new Date().toISOString() });
  }, [answers, activeSection, exam, onDraftChange, submitted]);
  const flashcardStorageKey = "libaria-flashcards-" + studentId + "-" + test.id;
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem(flashcardStorageKey) ?? "[]"); setKnownFlashcards(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : []); } catch { setKnownFlashcards([]); } }, [flashcardStorageKey]);
  const markFlashcard = (card: ReadingFlashcard, known: boolean) => {
    const id = card.term.trim().toLocaleLowerCase();
    const next = known ? Array.from(new Set([...knownFlashcards, id])) : knownFlashcards.filter((item) => item !== id);
    setKnownFlashcards(next);
    persistSharedClassroomValue(flashcardStorageKey, JSON.stringify(next));
    setFlashcardFlipped(false);
    setFlashcardIndex((index) => Math.min(index + 1, (test.flashcards?.length ?? 1) - 1));
  };
  const openNote = (context: string, quote = "") => {
    setNoteContext(context);
    setNoteQuote(quote);
    setNoteText("");
    setNotePanelOpen(true);
  };
  const saveNote = () => {
    const text = noteText.trim();
    if (!text) return;
    onAddNote({ id: createLocalId(), studentId, testId: test.id, testTitle: test.title, context: noteContext, quote: noteQuote || undefined, text, createdAt: new Date().toISOString() });
    setNoteText("");
  };
  const submit = () => {
    if (submitted) return;
    setSubmitted(true);
    onComplete(score, answers);
  };

  submitTimerRef.current = () => submit();

  useEffect(() => {
    if (deadline === null || submitted) return;
    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) submitTimerRef.current();
    };
    updateTimer();
    const interval = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(interval);
  }, [deadline, submitted]);
  const navigateSection = (section: number | null) => {
    setActiveSection(section);
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  if (isSectionedTest && activeSection === null) return <motion.main initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -6 }} className="mx-auto max-w-4xl pb-16 pt-8">
    <button type="button" onClick={onBack} className="mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }}><ArrowLeft size={16} />Back to tests</button>
    <div className="mb-7"><p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}>IELTS Reading · Test 1</p><h1 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">Choose a section</h1><p className="mt-3 max-w-2xl text-sm leading-6" style={{ color: theme.muted }}>Pick where you want to begin. Each section opens on its own page, and your answers stay saved while you move between them.</p></div>
    <div className="grid gap-3 md:grid-cols-3">{sectionPages.map((section) => { const count = section.range[1] - section.range[0]; const answered = test.questions.slice(section.range[0], section.range[1]).reduce((total, _question, offset) => total + (answers[section.range[0] + offset] !== undefined ? 1 : 0), 0); return <motion.button key={section.section} type="button" onClick={() => navigateSection(section.section)} whileHover={reduceMotion ? undefined : { y: -3 }} whileTap={reduceMotion ? undefined : { scale: 0.985 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} className="flex min-h-48 flex-col justify-between rounded-2xl border p-5 text-left shadow-sm" style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }}><div><span className="inline-flex rounded-full px-3 py-1 text-xs font-bold" style={{ background: theme.accent + "16", color: theme.accent }}>Section {section.section}</span><h2 className="mt-4 font-serif text-xl font-semibold leading-snug">{section.title}</h2><p className="mt-2 text-sm" style={{ color: theme.muted }}>Questions {section.range[0] + 1}–{section.range[1]}</p></div><div className="mt-5 flex items-center justify-between"><span className="text-xs font-semibold" style={{ color: theme.muted }}>{answered} / {count} answered</span><span className="inline-flex items-center gap-1 text-sm font-bold" style={{ color: theme.accent }}>Open section <ArrowRight size={15} /></span></div></motion.button>; })}</div>
  </motion.main>;

  return <motion.main initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -8 }} transition={{ type: "spring", stiffness: 280, damping: 30 }} className="mx-auto max-w-4xl pb-16 pt-8">
    {isSectionedTest && activeSectionPage && <nav aria-label="Reading sections" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3 sm:p-4" style={{ borderColor: theme.border, background: theme.surface }}><div><p className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.accent }}>Section {activeSectionPage.section} of {sectionPages.length}</p><p className="mt-1 text-sm font-semibold">{activeSectionPage.range[1] > activeSectionPage.range[0] ? `Questions ${(test.questionNumberStart ?? 1) + activeSectionPage.range[0]}–${(test.questionNumberStart ?? 1) + activeSectionPage.range[1] - 1}` : "No questions linked yet"}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => navigateSection(null)} className="rounded-full border px-3 py-2 text-xs font-semibold" style={{ borderColor: theme.border, color: theme.ink }}>All sections</button><button type="button" disabled={activeSectionPage.section <= 1} onClick={() => navigateSection(Math.max(1, (activeSection ?? 1) - 1))} className="rounded-full border px-3 py-2 text-xs font-semibold disabled:opacity-40" style={{ borderColor: theme.border, color: theme.ink }}>Previous</button><button type="button" disabled={activeSectionPage.section >= sectionPages.length} onClick={() => navigateSection(Math.min(sectionPages.length, (activeSection ?? 1) + 1))} className="rounded-full px-3 py-2 text-xs font-bold disabled:opacity-40" style={{ background: theme.accent, color: theme.onAccent }}>Next section</button></div></nav>}<div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-bold uppercase tracking-[.18em]" style={{ color: theme.accent }}>{exam ? "Scheduled exam" : "Phase " + (test.phase ?? 1) + " · Reading test"}</p><h1 className="max-w-2xl font-serif text-3xl font-semibold leading-tight sm:text-4xl">{test.title}</h1><p className="mt-3 text-sm" style={{ color: theme.muted }}>{test.topic} · {exam ? `${exam.durationMinutes} minutes` : test.minutes > 0 ? `${test.minutes} minutes` : "No time limit"} · {test.questions.length} questions</p></div><div className="flex items-center gap-3">{exam && !submitted && <div className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: theme.border, background: theme.surface }}><span className="block text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Time left</span><strong className="font-mono text-2xl tabular-nums" style={{ color: (secondsLeft ?? 0) < 60 ? "#d45b50" : theme.ink }}>{Math.floor((secondsLeft ?? 0) / 60).toString().padStart(2, "0")}:{((secondsLeft ?? 0) % 60).toString().padStart(2, "0")}</strong></div>}{submitted && exam?.gradedAt && <div className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: theme.border, background: theme.surface }}><span className="block text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Your score</span><strong className="text-2xl">{exam.score ?? 0}<span className="text-base font-medium" style={{ color: theme.muted }}> / {test.questions.length}</span></strong></div>}{NOTES_ENABLED && <button type="button" onClick={() => { setNotePanelOpen(true); setNoteContext("Reading test"); setNoteQuote(""); }} className="inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold" style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }}><StickyNote size={16} />Notes <span className="text-xs" style={{ color: theme.muted }}>{notes.filter((note) => note.testId === test.id).length}</span></button>}</div></div>
    {(!exam || test.kind === "ielts") && <div className="space-y-5">{shownPassages.map((passage, passageIndex) => { const sectionNumber = passage.section ?? ((test.passages ?? [passage]).indexOf(passage) + 1); const sectionPointer = teacherPointer?.testId === test.id && teacherPointer.section === sectionNumber ? teacherPointer : null; return <motion.article layout key={passageIndex} className="rounded-3xl border p-6 shadow-sm sm:p-10" style={{ background: theme.surface, borderColor: theme.border, color: theme.ink, fontFamily }}>
      <div className="mb-6 flex items-center justify-between gap-3 border-b pb-4" style={{ borderColor: theme.border }}><div><span className="block text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.muted }}>Section {sectionNumber}</span><h2 className="mt-1 font-serif text-2xl font-semibold">{passage.title}</h2>{passage.difficulty && <span className="mt-1 inline-block text-xs" style={{ color: theme.muted }}>{passage.difficulty}</span>}{sectionPointer && <span role="status" className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: theme.accent + "18", color: theme.accent }}><span className="h-2 w-2 animate-pulse rounded-full" style={{ background: theme.accent }} />Teacher is guiding this section</span>}</div><span className="shrink-0 text-xs" style={{ color: theme.muted }}>{passage.text.split(/\s+/).filter(Boolean).length} words</span></div>
      <div className="space-y-5" style={{ fontSize: preferences.fontSize, lineHeight: preferences.lineHeight === "compact" ? 1.55 : preferences.lineHeight === "spacious" ? 2.15 : 1.85 }}>{getReadingParagraphs(passage).map((paragraph, index) => { const labelMatch = paragraph.match(/^\(([A-H])\)\s*([\s\S]*)$/); const paragraphText = labelMatch ? labelMatch[2] : paragraph; const isTeacherParagraph = sectionPointer?.paragraphIndex === index; return <div id={`teacher-passage-${test.id}-${sectionNumber}-${index}`} key={index} className={`${labelMatch ? "grid grid-cols-[2rem_minmax(0,1fr)] gap-3 whitespace-pre-line" : "whitespace-pre-line"} relative rounded-lg transition-colors duration-200`} style={isTeacherParagraph ? { background: theme.accent + "12", boxShadow: `inset 3px 0 ${theme.accent}` } : undefined}>{isTeacherParagraph && sectionPointer && <span aria-hidden="true" className="pointer-events-none absolute z-10" style={{ left: `${Math.max(3, Math.min(97, sectionPointer.x))}%`, top: `${Math.max(2, Math.min(98, sectionPointer.y))}%`, transform: "translate(-50%, -50%)" }}><span className="absolute -top-6 left-0 whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-bold text-white shadow-sm" style={{ background: theme.accent }}>{sectionPointer.teacherName}</span><span className="mx-auto block h-7 w-0.5" style={{ background: theme.accent, boxShadow: `0 0 0 2px ${theme.surface}` }} /></span>}{labelMatch && <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border text-sm font-bold" style={{ borderColor: theme.border, background: theme.page, color: theme.accent }}>{labelMatch[1]}</span>}<span className="min-w-0">{paragraphText}</span></div>; })}</div>
    </motion.article>; })}</div>}
    <section className={exam ? "space-y-4" : "mt-8 space-y-4"}><div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}>{exam ? "Exam" : "Comprehension"}</p><h2 className="mt-1 font-serif text-2xl font-semibold">{exam ? "Exam questions" : "Check what you understood"}</h2></div>{submitted && !exam && <button onClick={() => { setAnswers({}); setSubmitted(false); }} className="text-sm font-bold" style={{ color: theme.accent }}>Try again</button>}</div>
      {questionEntries.map(({ question, index }) => { const questionNumber = (test.questionNumberStart ?? (test.id === "ielts-hiv-pandemic" ? 13 : 1)) + index; const questionInstructions = questionGroupInstructions(test, index); const isTextAnswer = question.type === "sentence-completion" || question.type === "summary-completion"; const isSwipeChoice = question.type === "matching-headings" || question.type === "true-false-not-given" || question.type === "yes-no-not-given"; const revealResult = submitted && (!exam || Boolean(exam.gradedAt)); const correct = answerIsCorrect(question, answers[index]); const earnedPoint = exam?.gradedAt ? Boolean(exam.questionPoints?.[index]) : correct; return <Fragment key={question.prompt}>{questionInstructions && <div className="rounded-2xl border px-4 py-4 sm:px-5" style={{ borderColor: theme.border, background: theme.page, color: theme.ink }}><p className="text-sm font-bold">{questionInstructions.title}</p><p className="mt-2 text-sm leading-6" style={{ color: theme.muted }}>{questionInstructions.text}</p></div>}<motion.fieldset layout key={question.prompt} className="group relative rounded-2xl border p-5 sm:p-6" style={{ borderColor: theme.border, background: theme.surface }}><legend className="px-1 text-base font-semibold leading-relaxed">{questionNumber}. {question.prompt}</legend>{isSwipeChoice ? <MatchingHeadingPicker question={question} selectedIndex={typeof answers[index] === "number" ? answers[index] as number : undefined} disabled={submitted} revealResult={revealResult} earnedPoint={earnedPoint} onSelect={(optionIndex) => setAnswers({ ...answers, [index]: optionIndex })} theme={theme} /> : question.type && <p className="mt-1 text-xs font-semibold uppercase tracking-wider" style={{ color: theme.muted }}>{question.type.replaceAll("-", " ")}</p>}{isTextAnswer ? <input type="text" value={String(answers[index] ?? "")} disabled={submitted} onChange={(event) => setAnswers({ ...answers, [index]: event.target.value })} placeholder="Type your answer" className="mt-3 h-12 w-full rounded-xl border px-4 text-sm outline-none" style={{ borderColor: theme.border, background: theme.page, color: theme.ink }} /> : !isSwipeChoice && <div className="mt-3 grid gap-2 sm:grid-cols-2">{question.options.map((option, optionIndex) => { const selected = answers[index] === optionIndex; const correctOption = typeof question.answer === "number" ? optionIndex === question.answer : option.trim().toLocaleLowerCase() === question.answer.trim().toLocaleLowerCase(); const wrongSelected = revealResult && selected && !earnedPoint; const answerStyle = wrongSelected ? { borderColor: "#d56b73", background: theme.dark ? "#472a30" : "#fff0f0", color: theme.ink } : revealResult && correctOption ? { borderColor: "#5b9b70", background: theme.dark ? "#233a2d" : "#e9f5ed", color: theme.ink } : selected ? { borderColor: theme.accent, background: theme.accent + "14", color: theme.ink } : { borderColor: theme.border, background: "transparent", color: theme.ink }; return <label key={option} className="flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed transition-colors" style={answerStyle}><input type="radio" name={"question-" + index} value={optionIndex} checked={selected} disabled={submitted} onChange={() => setAnswers({ ...answers, [index]: optionIndex })} className="mt-1 accent-emerald-700" /><span className="flex-1">{option}</span>{wrongSelected && <XCircle size={17} className="shrink-0 text-rose-600" aria-label="Incorrect answer" />}{revealResult && correctOption && <CheckCircle2 size={17} className="shrink-0 text-emerald-600" aria-label="Correct answer" />}</label>; })}</div>}{revealResult && <div className="mt-4 rounded-2xl border p-4 sm:p-5" style={{ borderColor: earnedPoint ? "#5b9b70" : "#d56b73", background: earnedPoint ? theme.dark ? "#20392b" : "#e9f5ed" : theme.dark ? "#40272c" : "#fff0f0" }}><div className="flex items-center gap-2">{earnedPoint ? <CheckCircle2 size={20} className="shrink-0" style={{ color: theme.dark ? "#a2d9af" : "#286b43" }} /> : <XCircle size={20} className="shrink-0" style={{ color: theme.dark ? "#f0a0a5" : "#ad424c" }} />}<p className="text-base font-bold" style={{ color: earnedPoint ? theme.dark ? "#a2d9af" : "#23643d" : theme.dark ? "#f0a0a5" : "#a83e48" }}>{earnedPoint ? "Correct" : "Incorrect"}</p><span className="ml-auto text-xs font-semibold" style={{ color: theme.muted }}>{exam?.gradedAt ? (exam.questionPoints?.[index] ?? 0) + " point(s)" : earnedPoint ? "1 point" : "0 points"}</span></div>{!earnedPoint && <p className="mt-3 text-sm font-semibold leading-6" style={{ color: theme.ink }}>Correct answer: {typeof question.answer === "number" ? question.options[question.answer] : question.answer}</p>}{question.explanation && <p className="mt-2 text-sm leading-6" style={{ color: theme.ink }}>{question.explanation}</p>}</div>}{submitted && exam && !exam.gradedAt && <p className="mt-3 text-sm" style={{ color: theme.muted }}>Your response has been sent for teacher review.</p>}<button type="button" aria-label={"Add note for question " + questionNumber} title="Add note" onClick={() => openNote("Question " + questionNumber + " · " + question.prompt)} className="absolute right-4 top-4 hidden rounded-full border p-2 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 sm:inline-flex" style={{ borderColor: theme.border, color: theme.accent, background: theme.surface }}><StickyNote size={14} /></button></motion.fieldset></Fragment>; })}
      {!submitted ? isSectionedTest && activeSectionPage && activeSectionPage.section < sectionPages.length ? <button type="button" onClick={() => navigateSection(Math.min(sectionPages.length, (activeSection ?? 1) + 1))} className="mt-3 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition hover:opacity-90" style={{ background: theme.accent, color: theme.onAccent }}>Next section <ArrowRight size={17} /></button> : <div><button onClick={() => submit()} className="mt-3 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition hover:opacity-90" style={{ background: theme.accent, color: theme.onAccent }}>{exam ? "Submit exam" : "Check answers"} <Check size={17} /></button>{!exam && Object.keys(answers).length !== test.questions.length && <p className="mt-2 text-xs" style={{ color: theme.muted }}>Unanswered questions will count as incorrect.</p>}</div> : <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4" style={{ borderColor: theme.border, background: theme.surface }}><p className="font-semibold">{exam ? exam.gradedAt ? "Graded · " + (exam.score ?? 0) + "/" + test.questions.length + " points" : "Exam submitted. Your teacher will review it and award points." : score === test.questions.length ? "Excellent reading." : score >= 3 ? "Good work. Review any missed answers." : "Keep practicing. Read the passage once more."}</p><button onClick={onBack} className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold" style={{ background: theme.accent, color: theme.onAccent }}>{exam ? exam.gradedAt ? "Back to classroom" : "Return to classroom" : "Back to Phase 1"} <ArrowRight size={15} /></button></div>}
    </section>
    {submitted && !exam && Boolean(test.flashcards?.length) && <section className="mt-8 rounded-3xl border p-5 sm:p-7" style={{ borderColor: theme.border, background: theme.surface }}><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}><Layers3 size={15} />After reading</p><h2 className="mt-1 font-serif text-2xl font-semibold">Vocabulary & collocations</h2><p className="mt-1 text-sm" style={{ color: theme.muted }}>Tap a card to reveal its meaning, then mark it for practice.</p></div><span className="text-sm font-semibold" style={{ color: theme.muted }}>{knownFlashcards.length}/{test.flashcards?.length ?? 0} known</span></div>{(() => { const cards = test.flashcards ?? []; const card = cards[flashcardIndex]; if (!card) return null; const known = knownFlashcards.includes(card.term.trim().toLocaleLowerCase()); return <div className="mx-auto max-w-2xl"><motion.button type="button" aria-pressed={flashcardFlipped} onClick={() => setFlashcardFlipped((value) => !value)} whileTap={reduceMotion ? undefined : { scale: 0.99 }} className="flex min-h-52 w-full flex-col items-center justify-center rounded-2xl border p-7 text-center transition-colors" style={{ borderColor: theme.accent + "55", background: theme.page, color: theme.ink }}><span className="mb-4 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider" style={{ background: theme.accent + "18", color: theme.accent }}>{card.kind === "collocation" ? "Collocation" : "Vocabulary"} · {flashcardIndex + 1} of {cards.length}</span><AnimatePresence mode="wait" initial={false}><motion.span key={flashcardFlipped ? "back" : "front"} initial={reduceMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -5 }} transition={{ duration: 0.16 }} className="block"><strong className="block font-serif text-3xl">{flashcardFlipped ? card.meaning : card.term}</strong>{flashcardFlipped && card.example && <span className="mt-3 block max-w-prose text-sm leading-6" style={{ color: theme.muted }}>“{card.example}”</span>}</motion.span></AnimatePresence><span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: theme.muted }}><RotateCcw size={13} />Tap to {flashcardFlipped ? "see term" : "flip"}</span></motion.button><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><button type="button" disabled={flashcardIndex === 0} onClick={() => { setFlashcardIndex((index) => Math.max(0, index - 1)); setFlashcardFlipped(false); }} className="rounded-full border px-4 py-2.5 text-sm font-semibold disabled:opacity-40" style={{ borderColor: theme.border }}>Previous</button><button type="button" disabled={flashcardIndex >= cards.length - 1} onClick={() => { setFlashcardIndex((index) => Math.min(cards.length - 1, index + 1)); setFlashcardFlipped(false); }} className="rounded-full border px-4 py-2.5 text-sm font-semibold disabled:opacity-40" style={{ borderColor: theme.border }}>Next</button></div><div className="flex gap-2"><button type="button" onClick={() => markFlashcard(card, false)} className="rounded-full border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: theme.border, color: theme.ink }}>Practice again</button><button type="button" onClick={() => markFlashcard(card, true)} className="rounded-full px-5 py-2.5 text-sm font-bold" style={{ background: theme.accent, color: theme.onAccent }}>{known ? "Known ✓" : "I know this"}</button></div></div></div>; })()}</section>}
    {NOTES_ENABLED && notePanelOpen && <aside aria-label="Reading notes" className="fixed inset-x-3 bottom-3 z-50 max-h-[78dvh] overflow-y-auto rounded-3xl border p-5 shadow-2xl md:inset-x-auto md:inset-y-3 md:right-3 md:w-[360px]" style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }}><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.accent }}>Connected notes</p><h2 className="mt-1 font-serif text-xl font-semibold">{test.title}</h2></div><button type="button" onClick={() => setNotePanelOpen(false)} aria-label="Close notes" className="rounded-full p-2" style={{ color: theme.muted }}><X size={18} /></button></div><div className="mb-4 rounded-xl px-3 py-2" style={{ background: theme.page }}><p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: theme.muted }}>Linked to</p><p className="mt-1 text-sm font-semibold">{noteContext}</p>{noteQuote && <p className="mt-1 line-clamp-3 text-xs leading-5" style={{ color: theme.muted }}>“{noteQuote}”</p>}</div><label className="block text-xs font-bold" style={{ color: theme.muted }}>Your note<textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Write a quick thought…" rows={2} className="mt-2 w-full resize-y rounded-xl border p-3 text-sm font-normal outline-none focus:ring-2" style={{ borderColor: theme.border, background: theme.page, color: theme.ink }} /></label><div className="mt-2 flex justify-end"><button type="button" disabled={!noteText.trim()} onClick={saveNote} className="rounded-full px-4 py-2 text-sm font-bold disabled:opacity-45" style={{ background: theme.accent, color: theme.onAccent }}>Save note</button></div><div className="mt-5 border-t pt-4" style={{ borderColor: theme.border }}><p className="mb-3 text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Notes for this reading · {notes.filter((note) => note.testId === test.id).length}</p><div className="space-y-2">{notes.filter((note) => note.testId === test.id).length ? notes.filter((note) => note.testId === test.id).map((note) => <article key={note.id} className="rounded-xl border-l-4 border-y border-r p-3" style={{ borderLeftColor: "#e9c96b", borderTopColor: theme.border, borderRightColor: theme.border, borderBottomColor: theme.border, background: theme.surface }}><button type="button" onClick={() => { setExpandedNoteId((current) => current === note.id ? null : note.id); setEditNoteText(note.text); }} aria-expanded={expandedNoteId === note.id} className="w-full text-left"><span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: theme.accent }}><StickyNote size={13} />{note.context}</span><span className="mt-1 block line-clamp-2 text-sm leading-5" style={{ color: theme.ink }}>{note.text}</span>{note.quote && <span className="mt-1 block line-clamp-1 text-xs italic" style={{ color: theme.muted }}>“{note.quote}”</span>}</button>{expandedNoteId === note.id && <div className="mt-2"><textarea aria-label="Edit note" value={editNoteText} onChange={(event) => setEditNoteText(event.target.value)} rows={3} className="w-full resize-y rounded-lg border p-2.5 text-sm leading-5 outline-none" style={{ borderColor: theme.border, background: theme.page, color: theme.ink }} /><div className="mt-2 flex justify-end"><button type="button" disabled={!editNoteText.trim()} onClick={() => { onUpdateNote(note.id, editNoteText.trim()); setExpandedNoteId(null); }} className="rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-45" style={{ background: theme.accent, color: theme.onAccent }}>Save changes</button></div></div>}</article>) : <p className="text-sm" style={{ color: theme.muted }}>No notes yet. Select a line or tap a paragraph to add one.</p>}</div></div></aside>}
  </motion.main>;
}

function StudentHomePage({ studentName, theme, code, error, onCodeChange, onSubmit, onContinue, onTeacherLogin }: { studentName: string; theme: ReaderTheme; code: string; error: string; onCodeChange: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onContinue: () => void; onTeacherLogin: () => void }) {
  return <motion.main initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .28, ease: "easeOut" }} className="mx-auto flex min-h-[calc(100dvh-120px)] w-full max-w-5xl items-center justify-center py-10 sm:py-16">
    <section className="grid w-full overflow-hidden rounded-[2rem] border shadow-sm md:grid-cols-[1.1fr_.9fr]" style={{ borderColor: theme.border, background: theme.surface }}>
      <div className="flex flex-col justify-center p-6 sm:p-10 md:p-12"><p className="text-xs font-bold uppercase tracking-[.18em]" style={{ color: theme.accent }}>Libraria · Student home</p><h1 className="mt-3 max-w-xl font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">A calm place to read, learn, and grow.</h1><p className="mt-4 max-w-lg text-sm leading-7" style={{ color: theme.muted }}>Enter the 9-digit student code from your teacher to open your personal reading library and assigned exams.</p><form onSubmit={onSubmit} className="mt-7 max-w-md space-y-3"><label htmlFor="home-student-code" className="block text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Your student code<input id="home-student-code" value={code} onChange={(event) => onCodeChange(event.target.value.replace(/\D/g, "").slice(0, 9))} maxLength={9} inputMode="numeric" autoComplete="off" placeholder="123456789" className="mt-2 h-14 w-full rounded-xl border px-4 font-mono text-lg font-bold tracking-[.25em] outline-none transition focus:ring-2" style={{ borderColor: theme.border, background: theme.page, color: theme.ink }} /></label>{error && <p role="alert" className="text-sm" style={{ color: theme.dark ? "#f0a0a5" : "#ad424c" }}>{error}</p>}<button type="submit" disabled={code.length !== 9} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45" style={{ background: theme.accent, color: theme.onAccent }}>Open my profile <ArrowRight size={16} /></button></form><p className="mt-4 text-xs" style={{ color: theme.muted }}>No code yet? Ask your teacher to create your student profile.</p></div>
      <div className="flex flex-col justify-between gap-8 border-t p-6 sm:p-10 md:border-l md:border-t-0" style={{ borderColor: theme.border, background: theme.page }}><div><div className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: theme.accent, color: theme.onAccent }}><BookOpen size={22} /></div><p className="mt-8 text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}>Your learning, together</p><h2 className="mt-2 font-serif text-2xl font-semibold">One profile. All your progress.</h2><p className="mt-3 text-sm leading-6" style={{ color: theme.muted }}>Your teacher’s reading materials, exam assignments, and reviewed results stay organized under your name.</p></div><div className="space-y-3"><div className="rounded-2xl border p-4" style={{ borderColor: theme.border, background: theme.surface }}><p className="text-xs font-semibold" style={{ color: theme.muted }}>Already using this device?</p><button type="button" onClick={onContinue} className="mt-2 inline-flex min-h-10 w-full items-center justify-between gap-2 rounded-xl border px-3 text-sm font-semibold" style={{ borderColor: theme.border, color: theme.ink }}>Continue as <span className="truncate font-bold" style={{ color: theme.accent }}>{studentName}</span><ArrowRight size={15} className="shrink-0" /></button></div><button type="button" onClick={onTeacherLogin} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition hover:shadow-sm" style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }}><LockKeyhole size={15} />Teacher sign in</button></div></div>
    </section>
  </motion.main>;
}

function ScheduledAssessments({ rows, theme, now, onOpen, onViewAll, onRemind }: { rows: StudentExamRow[]; theme: ReaderTheme; now: number; onOpen: (assignment: ExamAssignment) => void; onViewAll: () => void; onRemind: (assignment: ExamAssignment, test: ReadingTest) => void }) {
  if (!rows.length) return null;
  return <section aria-labelledby="scheduled-assessments-title" className="mb-8">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><span className="inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[.14em]" style={{ color: theme.onAccent, background: theme.accent }}>Upcoming assessments</span><h2 id="scheduled-assessments-title" className="mt-2 font-serif text-2xl font-semibold">Scheduled exams</h2><p className="mt-1 text-sm" style={{ color: theme.muted }}>Your teacher-assigned timed reading tests, all in one place.</p></div><span className="rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: theme.border, color: theme.muted }}>{rows.length} {rows.length === 1 ? "exam" : "exams"} to do</span></div>
    <div className="scheduled-grid grid gap-3 lg:grid-cols-2">{rows.map(({ assignment, test, startsAt, endsAt }) => { const available = now >= startsAt; const inProgress = Boolean(assignment.startedAt); const status = inProgress ? "In progress" : available ? "Available now" : `Opens ${new Date(startsAt).toLocaleString()}`; const sectionCount = test.passages?.length ?? 1; return <article key={assignment.id} className="exam-card rounded-2xl border p-5 shadow-sm" style={{ borderColor: theme.border, background: theme.surface }}><div className="flex flex-wrap items-center justify-between gap-2"><span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold" style={{ background: available ? theme.accent : theme.page, color: available ? theme.onAccent : theme.ink }}><CalendarClock size={14} />{status}</span><span className="text-xs font-semibold" style={{ color: theme.muted }}>{assignment.durationMinutes} min</span></div><h3 className="mt-4 font-serif text-xl font-semibold leading-snug">{test.title}</h3><p className="mt-1 text-sm" style={{ color: theme.muted }}>{test.topic}</p><div className="mt-4 flex flex-wrap gap-2">{[`${sectionCount} ${sectionCount === 1 ? "passage" : "passages"}`, `${test.questions.length} questions`, `Due ${new Date(endsAt).toLocaleDateString()}`].map((tag) => <span key={tag} className="rounded-full px-3 py-1.5 text-xs font-medium" style={{ background: theme.page, color: theme.muted }}>{tag}</span>)}</div><div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => available ? onOpen(assignment) : onViewAll()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold" style={{ background: available ? theme.accent : theme.page, color: available ? theme.onAccent : theme.ink }}>{available ? inProgress ? "Resume exam" : "Start exam" : "View exam details"}<ArrowRight size={15} /></button><button type="button" onClick={() => onRemind(assignment, test)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold" style={{ borderColor: theme.border, color: theme.ink }}><CalendarClock size={15} />Add reminder</button></div></article>; })}</div>
  </section>;
}

function ExamHistoryPreview({ rows, theme, onViewAll }: { rows: StudentExamRow[]; theme: ReaderTheme; onViewAll: () => void }) {
  if (!rows.length) return null;
  return <section aria-labelledby="exam-history-title" className="mb-10"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}>Completed & past</p><h2 id="exam-history-title" className="mt-1 font-serif text-2xl font-semibold">Exam history</h2><p className="mt-1 text-sm" style={{ color: theme.muted }}>Recent results and work waiting for teacher review.</p></div><button type="button" onClick={onViewAll} className="rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: theme.border, color: theme.ink }}>View all exams <ArrowRight className="ml-1 inline" size={14} /></button></div><div className="grid gap-3 md:grid-cols-2">{rows.slice(0, 4).map(({ assignment, test, expired }) => { const status = assignment.gradedAt ? "Graded" : assignment.completedAt ? "Waiting for review" : expired ? "Missed" : "Past"; const statusColor = assignment.gradedAt ? (theme.dark ? "#9bd5a6" : "#27734a") : assignment.completedAt ? "#a95e18" : theme.muted; return <article key={assignment.id} className="flex items-center justify-between gap-4 rounded-2xl border p-4" style={{ borderColor: theme.border, background: theme.surface }}><div className="min-w-0"><span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: statusColor }}>{status}</span><h3 className="mt-1 truncate font-semibold">{test.title}</h3><p className="mt-1 text-xs" style={{ color: theme.muted }}>{assignment.completedAt ? `Submitted ${new Date(assignment.completedAt).toLocaleDateString()}` : `Due ${new Date(assignment.startsAt).toLocaleDateString()}`}{assignment.gradedAt ? ` · ${assignment.score ?? 0}/${test.questions.length} points` : ""}</p>{assignment.teacherFeedback && <p className="mt-1 line-clamp-1 text-xs" style={{ color: theme.muted }}>{assignment.teacherFeedback}</p>}</div><span className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: statusColor + "18", color: statusColor }}>{assignment.gradedAt ? `${assignment.score ?? 0}/${test.questions.length}` : status}</span></article>; })}</div></section>;
}

function StudentExamsPage({ assignments, tests, studentId, theme, onOpenExam, onBackToLibrary }: { assignments: ExamAssignment[]; tests: ReadingTest[]; studentId: string; theme: ReaderTheme; onOpenExam: (assignment: ExamAssignment) => void; onBackToLibrary: () => void }) {
  const [filter, setFilter] = useState<"all" | "todo" | "waiting" | "past">("all");
  const now = Date.now();
  const rows = assignments.flatMap((assignment) => {
    const test = tests.find((item) => item.id === assignment.testId);
    if (assignment.studentId !== studentId || !test || test.status === "draft") return [];
    const start = new Date(assignment.startsAt).getTime();
    const end = Math.min(start + assignment.durationMinutes * 60_000, assignment.closesAt ? new Date(assignment.closesAt).getTime() : Number.POSITIVE_INFINITY);
    const expired = now >= end && !assignment.completedAt;
    const status = assignment.gradedAt ? "Graded" : assignment.completedAt ? "Waiting for review" : expired ? "Missed" : assignment.startedAt ? "In progress" : now >= start ? "Available" : "Upcoming";
    return [{ assignment, test, expired, status }];
  }).sort((a, b) => new Date(b.assignment.startsAt).getTime() - new Date(a.assignment.startsAt).getTime());
  const counts = { all: rows.length, todo: rows.filter((row) => !row.assignment.completedAt && !row.expired).length, waiting: rows.filter((row) => row.assignment.completedAt && !row.assignment.gradedAt).length, past: rows.filter((row) => Boolean(row.assignment.gradedAt) || row.expired).length };
  const filtered = rows.filter((row) => filter === "all" || filter === "todo" && !row.assignment.completedAt && !row.expired || filter === "waiting" && row.assignment.completedAt && !row.assignment.gradedAt || filter === "past" && (Boolean(row.assignment.gradedAt) || row.expired));
  const tabs = [{ id: "all" as const, label: "All exams" }, { id: "todo" as const, label: "To do" }, { id: "waiting" as const, label: "Waiting for review" }, { id: "past" as const, label: "Past exams" }];

  return <main className="mx-auto w-full max-w-4xl pb-16 pt-8 sm:pt-12">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}>Student workspace · {rows.length} assigned</p><h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight">Your exams</h1><p className="mt-2 text-sm" style={{ color: theme.muted }}>Upcoming work, submissions waiting for review, and your past results.</p></div><button type="button" onClick={onBackToLibrary} className="rounded-full border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }}>Reading library</button></div>
    <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{tabs.map((tab) => <button key={tab.id} type="button" aria-pressed={filter === tab.id} onClick={() => setFilter(tab.id)} className="rounded-2xl border p-3 text-left transition" style={{ borderColor: filter === tab.id ? theme.accent : theme.border, background: filter === tab.id ? theme.accent + "12" : theme.surface }}><p className="text-[11px] font-semibold" style={{ color: theme.muted }}>{tab.label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{counts[tab.id]}</p></button>)}</div>
    {filtered.length === 0 ? <section className="rounded-3xl border p-8 text-center sm:p-12" style={{ borderColor: theme.border, background: theme.surface }}><h2 className="font-serif text-2xl font-semibold">{rows.length ? "Nothing in this list yet" : "No exams assigned yet"}</h2><p className="mt-2 text-sm" style={{ color: theme.muted }}>{rows.length ? "Choose another filter to see your exam activity." : "Your teacher’s assigned exams will appear here."}</p></section> : <div className="space-y-3">{filtered.map(({ assignment, test, expired, status }) => { const completed = Boolean(assignment.completedAt); const graded = Boolean(assignment.gradedAt); const available = !completed && !expired && now >= new Date(assignment.startsAt).getTime(); const statusColor = graded ? "#27734a" : completed ? "#a95e18" : expired ? theme.muted : assignment.startedAt ? "#286283" : theme.accent; const startLabel = assignment.startedAt ? `Started ${new Date(assignment.startedAt).toLocaleString()}` : `Opens ${new Date(assignment.startsAt).toLocaleString()}`; const endTime = Math.min(new Date(assignment.startsAt).getTime() + assignment.durationMinutes * 60_000, assignment.closesAt ? new Date(assignment.closesAt).getTime() : Number.POSITIVE_INFINITY); const endLabel = completed && assignment.completedAt ? `Submitted ${new Date(assignment.completedAt).toLocaleString()}` : Number.isFinite(endTime) ? `Due ${new Date(endTime).toLocaleString()}` : `${assignment.durationMinutes} minute limit`; return <article key={assignment.id} className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: graded ? "#27734a55" : theme.border, background: theme.surface }}><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ background: statusColor + "18", color: statusColor }}>{status}</span><span className="text-xs" style={{ color: theme.muted }}>Phase {test.phase ?? 1} · {assignment.durationMinutes} min</span></div><h2 className="mt-2 font-serif text-xl font-semibold">{test.title}</h2><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: theme.muted }}><span>{startLabel}</span><span>{endLabel}</span></div>{graded && <p className="mt-2 text-sm font-semibold" style={{ color: statusColor }}>Score · {assignment.score ?? 0}/{test.questions.length}</p>}</div><button type="button" disabled={completed && !graded || expired || !available && !graded} onClick={() => onOpenExam(assignment)} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50" style={{ background: available || assignment.startedAt && !completed ? theme.accent : graded ? theme.surface : theme.page, color: available || assignment.startedAt && !completed ? theme.onAccent : theme.ink, border: graded ? `1px solid ${theme.border}` : undefined }}>{graded ? "Review answers" : completed ? "Waiting for review" : expired ? "Expired" : assignment.startedAt ? "Resume exam" : available ? "Start exam" : "Not open yet"}{(available || assignment.startedAt && !completed || graded) && <ArrowRight size={15} />}</button></div></article>; })}</div>}
  </main>;
}

export function ReadingApp() {
  const reduceMotion = useReducedMotion();
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [allTests, setAllTests] = useState<ReadingTest[]>(readingTests);
  const [activePhase, setActivePhase] = useState<1 | 2 | 3 | 4>(1);
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [active, setActive] = useState<{ unit: number; lesson: number } | null>(null);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const [selectedPracticeTestId, setSelectedPracticeTestId] = useState(readingTests[0]?.id ?? "");
  const [practiceStep, setPracticeStep] = useState<PracticeStep>("home");
  const [practiceQuestionCount, setPracticeQuestionCount] = useState(12);
  const [practiceSections, setPracticeSections] = useState<number[]>([1]);
  const [practiceSession, setPracticeSession] = useState<PracticeCard[] | null>(null);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState(DEFAULT_STUDENT_ID);
  const [studentPage, setStudentPage] = useState<"home" | "library" | "exams">("home");
  const [studentCodeInput, setStudentCodeInput] = useState("");
  const [studentCodeError, setStudentCodeError] = useState("");
  const [assignments, setAssignments] = useState<ExamAssignment[]>([]);
  const [readingNotes, setReadingNotes] = useState<ReadingNote[]>([]);
  const [teacherMode, setTeacherMode] = useState(false);
  const [teacherAuthenticated, setTeacherAuthenticated] = useState(false);
  const [teachingPointer, setTeachingPointer] = useState<TeachingPointer | null>(null);
  const teachingChannel = useRef<BroadcastChannel | null>(null);
  const [clockNow, setClockNow] = useState(Date.now());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [cloudStatus, setCloudStatus] = useState<"local" | "syncing" | "connected" | "error">("local");
  const remoteHydrated = useRef(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "saved" | "read">("all");

  const applyRemoteClassroom = (data: Record<string, string>) => {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string") localStorage.setItem(key, value);
    }
    try {
      const rawRoster = localStorage.getItem(STUDENTS_STORAGE_KEY);
      const roster = rawRoster ? JSON.parse(rawRoster) as StudentProfile[] : [];
      if (Array.isArray(roster) && roster.length) {
        const savedSelection = localStorage.getItem(SELECTED_STUDENT_STORAGE_KEY);
        const selected = roster.find((student) => student.id === savedSelection)?.id ?? roster[0].id;
        setStudents(roster);
        setSelectedStudentId(selected);
        localStorage.setItem(SELECTED_STUDENT_STORAGE_KEY, selected);
        setProgress(readStudentProgress(selected));
        const savedNotes = localStorage.getItem(studentNotesKey(selected));
        const notes = savedNotes ? JSON.parse(savedNotes) : [];
        setReadingNotes(Array.isArray(notes) ? notes : []);
      }
      const savedAssignments = localStorage.getItem(EXAMS_STORAGE_KEY);
      setAssignments(savedAssignments ? JSON.parse(savedAssignments) as ExamAssignment[] : []);
      const savedTests = localStorage.getItem(CUSTOM_TESTS_STORAGE_KEY);
      const customTests = savedTests ? JSON.parse(savedTests) as ReadingTest[] : [];
      setAllTests([...readingTests, ...(Array.isArray(customTests) ? customTests : [])]);
      setTeachingPointer(() => {
        try {
          const raw = localStorage.getItem(TEACHING_POINTER_STORAGE_KEY);
          const pointer = raw ? JSON.parse(raw) as TeachingPointer : null;
          return pointer && Date.now() - pointer.updatedAt < 120_000 ? pointer : null;
        } catch { return null; }
      });
      remoteHydrated.current = true;
    } catch {
      setCloudStatus("error");
    }
  };

  useEffect(() => {
    const restoreFromUrl = () => {
      const route = readPracticeLocation();
      setPracticeStep(route.step);
      if (route.testId) setSelectedPracticeTestId(route.testId);
      setPracticeSections(route.sections);
      setPracticeQuestionCount(route.count);
    };
    restoreFromUrl();
    window.addEventListener("popstate", restoreFromUrl);
    return () => window.removeEventListener("popstate", restoreFromUrl);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/teacher-session", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ authenticated?: boolean }> : null)
      .then((session) => { if (active) setTeacherAuthenticated(session?.authenticated === true); })
      .catch(() => { if (active) setTeacherAuthenticated(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    const syncExistingStudent = async () => {
      try {
        const response = await fetch("/api/classroom-state", { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json() as { role?: string; data?: Record<string, string> };
        if (alive && result.role === "student" && result.data) {
          applyRemoteClassroom(result.data);
          setCloudStatus("connected");
        }
      } catch { /* Local reading mode remains available when no cloud connection is configured. */ }
    };
    void syncExistingStudent();
    const refresh = window.setInterval(() => { void syncExistingStudent(); }, 15_000);
    return () => { alive = false; window.clearInterval(refresh); };
  }, []);

  useEffect(() => {
    if (!teacherAuthenticated || !teacherMode) return;
    let alive = true;
    let refresh = 0;
    setCloudStatus("syncing");
    void (async () => {
      try {
        const response = await fetch("/api/classroom-state", { cache: "no-store" });
        if (response.status === 503 || response.status === 404) { if (alive) setCloudStatus("local"); return; }
        if (!response.ok) throw new Error("Could not load the online classroom.");
        const result = await response.json() as { configured?: boolean; initialized?: boolean; data?: Record<string, string> };
        if (!alive) return;
        if (result.configured === false) { setCloudStatus("local"); return; }
        if (result.initialized && result.data) {
          applyRemoteClassroom(result.data);
        } else {
          const seed = collectLocalClassroomState();
          const seedResponse = await fetch("/api/classroom-state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "bootstrap", data: seed }) });
          if (!seedResponse.ok) throw new Error("Could not initialize the online classroom.");
        }
        setCloudStatus("connected");
        refresh = window.setInterval(() => {
          void fetch("/api/classroom-state", { cache: "no-store" }).then(async (nextResponse) => {
            if (!nextResponse.ok) return;
            const nextState = await nextResponse.json() as { data?: Record<string, string> };
            if (alive && nextState.data) applyRemoteClassroom(nextState.data);
          }).catch(() => undefined);
        }, 10_000);
      } catch {
        if (alive) setCloudStatus("error");
      }
    })();
    return () => { alive = false; if (refresh) window.clearInterval(refresh); };
  }, [teacherAuthenticated, teacherMode]);

  useEffect(() => {
    let timer = 0;
    let pending: Record<string, string> = {};
    const flush = async () => {
      timer = 0;
      const data = pending;
      pending = {};
      if (!Object.keys(data).length) return;
      try {
        const response = await fetch("/api/classroom-state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", data }) });
        if (!response.ok) {
          if (response.status !== 401) setCloudStatus("error");
          return;
        }
        setCloudStatus("connected");
      } catch { setCloudStatus("error"); }
    };
    const onWrite = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string; value?: string }>).detail;
      if (!detail?.key || typeof detail.value !== "string") return;
      pending[detail.key] = detail.value;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => { void flush(); }, 180);
    };
    window.addEventListener("libaria:shared-classroom-write", onWrite);
    return () => { window.removeEventListener("libaria:shared-classroom-write", onWrite); if (timer) window.clearTimeout(timer); };
  }, []);

  const signOutTeacher = async () => {
    try { await fetch("/api/teacher-session", { method: "DELETE" }); } catch { /* The session cookie expires if the request cannot reach the server. */ }
    setTeacherAuthenticated(false);
    setTeacherMode(false);
  };

  useEffect(() => {
    const readPointer = (raw: string | null) => {
      try {
        const pointer = raw ? JSON.parse(raw) as TeachingPointer : null;
        setTeachingPointer(pointer && Date.now() - pointer.updatedAt < 120_000 ? pointer : null);
      } catch { setTeachingPointer(null); }
    };
    readPointer(localStorage.getItem(TEACHING_POINTER_STORAGE_KEY));
    const onStorage = (event: StorageEvent) => { if (event.key === TEACHING_POINTER_STORAGE_KEY) readPointer(event.newValue); };
    window.addEventListener("storage", onStorage);
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("libaria-teaching");
    if (channel) {
      channel.onmessage = (event: MessageEvent<TeachingPointer | null>) => {
        const pointer = event.data;
        setTeachingPointer(pointer && Date.now() - pointer.updatedAt < 120_000 ? pointer : null);
      };
      teachingChannel.current = channel;
    }
    const expiryCheck = window.setInterval(() => setTeachingPointer((pointer) => pointer && Date.now() - pointer.updatedAt >= 120_000 ? null : pointer), 5_000);
    return () => { window.removeEventListener("storage", onStorage); window.clearInterval(expiryCheck); channel?.close(); teachingChannel.current = null; };
  }, []);

  const publishTeachingPointer = (pointer: TeachingPointer | null) => {
    setTeachingPointer(pointer);
    if (pointer) persistSharedClassroomValue(TEACHING_POINTER_STORAGE_KEY, JSON.stringify(pointer));
    else persistSharedClassroomValue(TEACHING_POINTER_STORAGE_KEY, "null");
    teachingChannel.current?.postMessage(pointer);
  };

  useEffect(() => {
    try {
      const storedStudents = localStorage.getItem(STUDENTS_STORAGE_KEY);
      const parsedRoster: Array<Partial<StudentProfile>> = storedStudents ? JSON.parse(storedStudents) : [];
      const usedCodes: string[] = [];
      let roster: StudentProfile[] = Array.isArray(parsedRoster) ? parsedRoster.map((student) => {
        const storedCode = typeof student.joinCode === "string" ? student.joinCode : "";
        const joinCode = /^\d{9}$/.test(storedCode) && !usedCodes.includes(storedCode) ? storedCode : createStudentJoinCode(usedCodes);
        usedCodes.push(joinCode);
        return {
          id: student.id ?? DEFAULT_STUDENT_ID,
          name: student.name ?? "Student",
          joinCode,
          createdAt: student.createdAt ?? new Date().toISOString(),
          unlockedPhases: Array.isArray(student.unlockedPhases) ? student.unlockedPhases : [1],
          groupName: student.groupName,
        };
      }) : [];
      if (!roster.length) {
        roster = [{ id: DEFAULT_STUDENT_ID, name: "My profile", joinCode: createStudentJoinCode(), createdAt: new Date().toISOString(), unlockedPhases: [1] }];
      }
      localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(roster));
      const savedSelection = localStorage.getItem(SELECTED_STUDENT_STORAGE_KEY);
      const selected = roster.find((student) => student.id === savedSelection)?.id ?? roster[0].id;
      setStudents(roster);
      setSelectedStudentId(selected);
      const initialProgress = readStudentProgress(selected);
      setProgress(initialProgress);
      localStorage.setItem(studentProgressKey(selected), JSON.stringify(initialProgress));
      const storedNotes = localStorage.getItem(studentNotesKey(selected));
      if (storedNotes) {
        const parsedNotes = JSON.parse(storedNotes);
        if (Array.isArray(parsedNotes)) setReadingNotes(parsedNotes);
      }
      const rawAssignments = localStorage.getItem(EXAMS_STORAGE_KEY);
      if (rawAssignments) setAssignments(JSON.parse(rawAssignments));
      const rawCustomTests = localStorage.getItem(CUSTOM_TESTS_STORAGE_KEY);
      if (rawCustomTests) {
        const customTests = JSON.parse(rawCustomTests);
        if (Array.isArray(customTests)) setAllTests([...readingTests, ...customTests]);
      }
      const settings = localStorage.getItem(SETTINGS_KEY);
      if (settings) {
        const stored = JSON.parse(settings) as Partial<Omit<Preferences, "theme" | "designStyle" | "shadowMode">> & { theme?: unknown; designStyle?: unknown; shadowMode?: unknown };
        const savedTheme = stored.theme === "night" || stored.theme === "dark" ? "dark" : "light";
        const savedStyle = typeof stored.designStyle === "string" && Object.hasOwn(designStyles, stored.designStyle) ? stored.designStyle as DesignStyle : "editorial";
        const savedShadow = stored.shadowMode === "hard-offset" || stored.shadowMode === "pillowed-clay" ? stored.shadowMode : "soft-elevation";
        setPreferences({ ...defaults, ...stored, theme: savedTheme, designStyle: savedStyle, shadowMode: savedShadow });
      }
    } catch {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      localStorage.removeItem(SETTINGS_KEY);
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setClockNow(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let previousY = window.scrollY;
    let frame = 0;
    const updateHeader = () => {
      frame = 0;
      const nextY = window.scrollY;
      const delta = nextY - previousY;
      if (nextY < 48 || delta < -4) setHeaderVisible(true);
      else if (nextY > 120 && delta > 4) setHeaderVisible(false);
      previousY = nextY;
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateHeader);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const theme = designStyles[preferences.designStyle][preferences.theme];
  const studentGreen = theme.dark ? "#8bc99e" : theme.accent;
  const studentGreenText = theme.dark ? "#18211c" : "#ffffff";
  const classroomTheme: ReaderTheme = theme;
  const frameTheme = teacherMode ? classroomTheme : theme;
  const current = active ? englishCurriculum[active.unit]?.lessons[active.lesson] : null;
  const activeTest = allTests.find((test) => test.id === activeTestId) ?? null;
  const activeExam = assignments.find((assignment) => assignment.id === activeExamId) ?? null;
  const selectedStudent = students.find((student) => student.id === selectedStudentId);
  const unlockedPhases = selectedStudent?.unlockedPhases ?? [1];
  const currentKey = active ? active.unit + "-" + active.lesson : "";
  const lessons = useMemo(() => englishCurriculum.flatMap((unit, unitIndex) =>
    unit.lessons.map((lesson, lessonIndex) => ({ unit, unitIndex, lesson, lessonIndex, key: unitIndex + "-" + lessonIndex })),
  ), []);
  const phaseLessons = activePhase === 1 ? lessons : [];
  const visible = phaseLessons.filter(({ unit, lesson, key }) => {
    const matchesQuery = (lesson.title + " " + unit.title + " " + lesson.reading).toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all" || (filter === "read" && progress.read.includes(key)) || (filter === "saved" && progress.saved.includes(key)) || (filter === "unread" && !progress.read.includes(key));
    return matchesQuery && matchesFilter;
  });
  const assignedToStudent = (test: ReadingTest) => {
    if (test.visibility === "all") return true;
    if (test.visibility === "groups") return Boolean(selectedStudent?.groupName && test.groupNames?.includes(selectedStudent.groupName));
    if (test.visibility === "students") return Boolean(test.studentIds?.includes(selectedStudentId));
    return !test.studentId || test.studentId === selectedStudentId;
  };
  const phaseTests = allTests.filter((test) => test.status !== "draft" && test.kind !== "exam" && !test.timedExam && (test.kind === "ielts" || test.id.startsWith("custom-")) && (test.phase ?? 1) === activePhase && assignedToStudent(test));
  const unfinishedTest = phaseTests.find((test) => (progress.testsStarted ?? []).includes(test.id) && !progress.testsDone.includes(test.id) && (!test.opensAt || clockNow >= new Date(test.opensAt).getTime()) && (!test.closesAt || clockNow <= new Date(test.closesAt).getTime()));
  const heroTest = unfinishedTest ?? phaseTests.find((test) => (!test.opensAt || clockNow >= new Date(test.opensAt).getTime()) && (!test.closesAt || clockNow <= new Date(test.closesAt).getTime())) ?? null;
  const visibleTests = phaseTests.filter((test) => (test.title + " " + test.topic).toLowerCase().includes(query.toLowerCase()));
  const practiceTests = phaseTests.filter((test) => test.kind === "ielts").slice(0, 4);
  const assignedExamRows = assignments.flatMap((assignment) => {
    const test = allTests.find((item) => item.id === assignment.testId);
    if (assignment.studentId !== selectedStudentId || !test || test.status === "draft") return [];
    const startsAt = new Date(assignment.startsAt).getTime();
    const endsAt = Math.min(startsAt + assignment.durationMinutes * 60_000, assignment.closesAt ? new Date(assignment.closesAt).getTime() : Number.POSITIVE_INFINITY);
    const expired = !assignment.completedAt && clockNow >= endsAt;
    return [{ assignment, test, expired, startsAt, endsAt }];
  }).sort((a, b) => a.startsAt - b.startsAt);
  const pastExams = assignedExamRows.filter(({ assignment, expired }) => Boolean(assignment.completedAt) || expired).sort((a, b) => b.startsAt - a.startsAt);
  const importantExamRows = assignedExamRows.filter(({ assignment, expired }) => (!assignment.completedAt && !expired) || (Boolean(assignment.gradedAt) && !assignment.reviewedAt));
  const selectedPracticeTest = practiceTests.find((test) => test.id === selectedPracticeTestId) ?? practiceTests[0] ?? null;
  const practiceStageIndex = ({ home: 0, test: 1, section: 2, setup: 3 } as const)[practiceStep];
  const selectedVocabularyCount = readingVocabularyDecks.filter((deck) => practiceSections.includes(deck.section)).reduce((total, deck) => total + deck.cards.length, 0);
  const maxPracticeCards = Math.max(1, selectedVocabularyCount);
  const navigatePractice = (step: PracticeStep, options: { testId?: string; sections?: number[]; count?: number; replace?: boolean } = {}) => {
    const nextTestId = options.testId ?? selectedPracticeTest?.id ?? selectedPracticeTestId;
    const nextSections = options.sections ?? practiceSections;
    const nextCount = options.count ?? practiceQuestionCount;
    setPracticeStep(step);
    if (options.testId) setSelectedPracticeTestId(options.testId);
    if (options.sections) setPracticeSections(options.sections);
    if (options.count !== undefined) setPracticeQuestionCount(options.count);

    const url = new URL(window.location.href);
    for (const key of ["practice", "test", "sections", "count"]) url.searchParams.delete(key);
    if (step !== "home") {
      url.searchParams.set("practice", step === "test" ? "choose-test" : step === "section" ? "choose-section" : "deck-setup");
      if (step === "section" || step === "setup") {
        if (nextTestId) url.searchParams.set("test", nextTestId);
        url.searchParams.set("sections", nextSections.join(","));
      }
      if (step === "setup") url.searchParams.set("count", String(Math.min(nextCount, Math.max(1, selectedVocabularyCount || maxPracticeCards))));
    }
    window.history[options.replace ? "replaceState" : "pushState"]({}, "", url);
  };
  const words = current?.reading.split(/\s+/).filter(Boolean).length ?? 0;
  const minutes = Math.max(1, Math.ceil(words / 180));
  const savePreferences = (next: Preferences) => {
    setPreferences(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  };
  const downloadExamReminder = (assignment: ExamAssignment, test: ReadingTest) => {
    const start = new Date(assignment.startsAt);
    const end = new Date(Math.min(start.getTime() + assignment.durationMinutes * 60_000, assignment.closesAt ? new Date(assignment.closesAt).getTime() : start.getTime() + assignment.durationMinutes * 60_000));
    const formatIcsDate = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const escapeIcs = (value: string) => value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Libraria//Exam Reminder//EN", "BEGIN:VEVENT", `UID:${assignment.id}@libraria`, `DTSTAMP:${formatIcsDate(new Date())}`, `DTSTART:${formatIcsDate(start)}`, `DTEND:${formatIcsDate(end)}`, `SUMMARY:${escapeIcs(test.title)}`, `DESCRIPTION:${escapeIcs(`${test.topic} · ${test.questions.length} questions · ${assignment.durationMinutes} minutes`)}`, "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", `DESCRIPTION:${escapeIcs(`Libraria exam reminder: ${test.title}`)}`, "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${test.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "libraria-exam"}.ics`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const updateProgress = (next: Progress) => {
    setProgress(next);
    persistSharedClassroomValue(studentProgressKey(selectedStudentId), JSON.stringify(next));
  };
  const persistTestDraft = useCallback((testId: string, draft: ReadingTestDraft) => {
    setProgress((current) => {
      const next: Progress = {
        ...current,
        testsStarted: Array.from(new Set([...current.testsStarted, testId])),
        testDrafts: { ...current.testDrafts, [testId]: draft },
      };
      persistSharedClassroomValue(studentProgressKey(selectedStudentId), JSON.stringify(next));
      return next;
    });
  }, [selectedStudentId]);
  const selectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setStudentPage("library");
    setActivePhase(1);
    localStorage.setItem(SELECTED_STUDENT_STORAGE_KEY, studentId);
    setProgress(readStudentProgress(studentId));
    try {
      const storedNotes = localStorage.getItem(studentNotesKey(studentId));
      const parsedNotes = storedNotes ? JSON.parse(storedNotes) : [];
      setReadingNotes(Array.isArray(parsedNotes) ? parsedNotes : []);
    } catch {
      setReadingNotes([]);
    }
    setActive(null);
    setActiveTestId(null);
    setActiveExamId(null);
  };
  const joinStudentProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = studentCodeInput.toUpperCase().replace(/[^A-Z0-9]/g, "");
    void (async () => {
      try {
        const response = await fetch("/api/student-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
        if (response.ok) {
          const joined = await response.json() as { student?: { id?: string } };
          const stateResponse = await fetch("/api/classroom-state", { cache: "no-store" });
          if (!stateResponse.ok) throw new Error("Your profile opened, but shared data could not be loaded. Please try again.");
          const state = await stateResponse.json() as { data?: Record<string, string> };
          if (state.data) applyRemoteClassroom(state.data);
          if (joined.student?.id) selectStudent(joined.student.id);
          setCloudStatus("connected");
          setStudentCodeInput("");
          setStudentCodeError("");
          return;
        }
        const result = await response.json() as { error?: string };
        if (response.status === 503 && result.error?.includes("environment variables")) {
          const localStudent = students.find((profile) => profile.joinCode?.toUpperCase() === code);
          if (localStudent) { selectStudent(localStudent.id); setStudentCodeInput(""); setStudentCodeError(""); return; }
        }
        throw new Error(result.error ?? "That code was not found. Check it with your teacher and try again.");
      } catch (error) {
        setStudentCodeError(error instanceof Error ? error.message : "Could not open this student profile.");
      }
    })();
  };
  const addReadingNote = (note: ReadingNote) => {
    const next = [note, ...readingNotes];
    setReadingNotes(next);
    persistSharedClassroomValue(studentNotesKey(note.studentId), JSON.stringify(next));
  };
  const updateReadingNote = (noteId: string, text: string) => {
    const next = readingNotes.map((note) => note.id === noteId ? { ...note, text } : note);
    setReadingNotes(next);
    persistSharedClassroomValue(studentNotesKey(selectedStudentId), JSON.stringify(next));
  };
  const addStudent = (name: string) => {
    const student: StudentProfile = { id: createLocalId(), name, joinCode: createStudentJoinCode(students.flatMap((profile) => profile.joinCode ? [profile.joinCode] : [])), createdAt: new Date().toISOString(), unlockedPhases: [1] };
    const next = [...students, student];
    setStudents(next);
    persistSharedClassroomValue(STUDENTS_STORAGE_KEY, JSON.stringify(next));
    return student;
  };
  const toggleStudentPhase = (studentId: string, phase: number) => {
    if (phase === 1) return;
    const next = students.map((student) => {
      if (student.id !== studentId) return student;
      const current = student.unlockedPhases ?? [1];
      return { ...student, unlockedPhases: current.includes(phase) ? current.filter((item) => item !== phase) : [...current, phase].sort() };
    });
    setStudents(next);
    persistSharedClassroomValue(STUDENTS_STORAGE_KEY, JSON.stringify(next));
    if (studentId === selectedStudentId && !next.find((student) => student.id === studentId)?.unlockedPhases.includes(activePhase)) setActivePhase(1);
  };
  const updateStudentCode = (studentId: string, code: string) => {
    if (!/^\d{9}$/.test(code) || students.some((student) => student.id !== studentId && student.joinCode === code)) return false;
    const next = students.map((student) => student.id === studentId ? { ...student, joinCode: code } : student);
    setStudents(next);
    persistSharedClassroomValue(STUDENTS_STORAGE_KEY, JSON.stringify(next));
    return true;
  };
    const createAssignments = (newAssignments: ExamAssignment[]) => {
    const next = [...assignments, ...newAssignments];
    setAssignments(next);
    persistSharedClassroomValue(EXAMS_STORAGE_KEY, JSON.stringify(next));
  };
  const createTeacherTest = (test: ReadingTest) => {
    const draft = { ...test, status: "draft" as const };
    const next = [...allTests, draft];
    setAllTests(next);
    persistSharedClassroomValue(CUSTOM_TESTS_STORAGE_KEY, JSON.stringify(next.filter((item) => item.id.startsWith("custom-"))));
  };
  const publishTeacherTest = (testId: string) => {
    const source = allTests.find((item) => item.id === testId);
    if (!source || source.status === "published") return;
    const published = { ...source, status: "published" as const };
    const nextTests = allTests.map((item) => item.id === testId ? published : item);
    setAllTests(nextTests);
    persistSharedClassroomValue(CUSTOM_TESTS_STORAGE_KEY, JSON.stringify(nextTests.filter((item) => item.id.startsWith("custom-"))));
    if (published.kind === "exam" || published.timedExam) {
      const targets = students.filter((student) => (published.visibility === "all" || published.visibility === "groups" && Boolean(student.groupName && published.groupNames?.includes(student.groupName)) || published.visibility === "students" && Boolean(published.studentIds?.includes(student.id))) && !assignments.some((assignment) => assignment.testId === testId && assignment.studentId === student.id));
      const startsAt = published.opensAt ?? new Date().toISOString();
      const createdAt = targets.map((student) => ({ id: createLocalId("exam-"), studentId: student.id, testId, startsAt, durationMinutes: published.minutes, closesAt: published.closesAt }));
      if (createdAt.length) createAssignments(createdAt);
    }
  };
  const unpublishTeacherTest = (testId: string) => {
    const source = allTests.find((item) => item.id === testId);
    if (!source || source.status !== "published") return;
    const unpublished = { ...source, status: "draft" as const };
    const nextTests = allTests.map((item) => item.id === testId ? unpublished : item);
    setAllTests(nextTests);
    persistSharedClassroomValue(CUSTOM_TESTS_STORAGE_KEY, JSON.stringify(nextTests.filter((item) => item.id.startsWith("custom-"))));
  };
  const beginExam = (assignment: ExamAssignment) => {
    const now = new Date().toISOString();
    const shouldMarkStarted = !assignment.startedAt;
    const shouldMarkReviewed = Boolean(assignment.gradedAt && !assignment.reviewedAt);
    if (shouldMarkStarted || shouldMarkReviewed) {
      const next = assignments.map((item) => item.id === assignment.id ? { ...item, ...(shouldMarkStarted ? { startedAt: now } : {}), ...(shouldMarkReviewed ? { reviewedAt: now } : {}) } : item);
      setAssignments(next);
      persistSharedClassroomValue(EXAMS_STORAGE_KEY, JSON.stringify(next));
    }
    setActive(null);
    setActiveExamId(assignment.id);
    setActiveTestId(assignment.testId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const completeAssignment = (assignmentId: string, answers: Record<number, number | string>, questionPoints?: Record<number, number>) => {
    const gradedAt = questionPoints ? new Date().toISOString() : undefined;
    const score = questionPoints ? Object.values(questionPoints).reduce((total, points) => total + points, 0) : undefined;
    const next = assignments.map((item) => item.id === assignmentId ? { ...item, completedAt: new Date().toISOString(), answers, ...(questionPoints ? { questionPoints, gradedAt, score } : {}) } : item);
    setAssignments(next);
    persistSharedClassroomValue(EXAMS_STORAGE_KEY, JSON.stringify(next));
  };
  const gradeAssignment = (assignmentId: string, questionPoints: Record<number, number>, feedback = "") => {
    const score = Object.values(questionPoints).reduce((total, points) => total + points, 0);
    const next = assignments.map((item) => item.id === assignmentId ? { ...item, questionPoints, score, teacherFeedback: feedback || undefined, gradedAt: new Date().toISOString() } : item);
    setAssignments(next);
    persistSharedClassroomValue(EXAMS_STORAGE_KEY, JSON.stringify(next));
  };
  const toggleSaved = (key: string) => updateProgress({ ...progress, saved: progress.saved.includes(key) ? progress.saved.filter((item) => item !== key) : [...progress.saved, key] });
  const markRead = () => {
    if (!currentKey || progress.read.includes(currentKey)) return;
    updateProgress({ ...progress, read: [...progress.read, currentKey] });
  };
  const openLesson = (unit: number, lesson: number) => {
    const lessonKey = unit + "-" + lesson;
    if (!progress.readsStarted?.includes(lessonKey) && !progress.read.includes(lessonKey)) updateProgress({ ...progress, readsStarted: [...(progress.readsStarted ?? []), lessonKey] });
    setActive({ unit, lesson });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const moveLesson = (step: number) => {
    if (!active) return;
    const index = lessons.findIndex((item) => item.key === currentKey) + step;
    const next = lessons[index];
    if (next) openLesson(next.unitIndex, next.lessonIndex);
  };
  const startTest = (test: ReadingTest) => {
    const existingDraft = progress.testDrafts[test.id];
    const nextProgress: Progress = {
      ...progress,
      testsStarted: Array.from(new Set([...(progress.testsStarted ?? []), test.id])),
      testDrafts: { ...progress.testDrafts, [test.id]: { answers: existingDraft?.answers ?? {}, activeSection: existingDraft?.activeSection ?? null, updatedAt: new Date().toISOString() } },
    };
    updateProgress(nextProgress);
    setActive(null);
    setActiveTestId(test.id);
    setSettingsOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const completeTest = (test: ReadingTest, score: number, answers: Record<number, number | string>) => {
    if (activeExamId) {
      const questionPoints = test.scoreRelease === "immediate" ? Object.fromEntries(test.questions.map((question, index) => [index, answerIsCorrect(question, answers[index]) ? 1 : 0])) : undefined;
      completeAssignment(activeExamId, answers, questionPoints);
      return;
    }
    const next: Progress = {
      ...progress,
      testsDone: progress.testsDone.includes(test.id) ? progress.testsDone : [...progress.testsDone, test.id],
      testsCompletedAt: { ...(progress.testsCompletedAt ?? {}), [test.id]: new Date().toISOString() },
      testScores: { ...progress.testScores, [test.id]: score },
      testDrafts: { ...progress.testDrafts, [test.id]: { answers, activeSection: progress.testDrafts[test.id]?.activeSection ?? null, updatedAt: new Date().toISOString() } },
    };
    updateProgress(next);
  };

  const Settings = (
    <div className="relative">
      <button onClick={() => setSettingsOpen(!settingsOpen)} aria-expanded={settingsOpen} className="inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold transition hover:shadow-sm" style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }}>
        <Settings2 size={17} /> Settings <ChevronDown size={15} />
      </button>
      <AnimatePresence>
      {settingsOpen && <motion.div key="reading-settings" initial={reduceMotion ? false : { opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduceMotion ? undefined : { opacity: 0, y: -5, scale: 0.98 }} transition={{ type: "spring", stiffness: 420, damping: 32 }} className="absolute right-0 top-14 z-20 max-h-[calc(100dvh-6rem)] w-[min(340px,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-2xl border p-5 shadow-xl" style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }}>
        <div className="mb-4 flex items-center justify-between">
          <div><p className="font-extrabold">{teacherMode ? "Display settings" : "Reading settings"}</p><p className="text-xs" style={{ color: theme.muted }}>{teacherMode ? "Choose the look and reading comfort for the app" : "Make the page comfortable for you"}</p></div>
          <button onClick={() => setSettingsOpen(false)} aria-label="Close settings" className="rounded-full p-2 hover:bg-black/5"><X size={17} /></button>
        </div>
        <div className="space-y-5">
          {!teacherMode && studentPage !== "home" && <section className="rounded-xl border p-3" style={{ borderColor: theme.border, background: theme.page }}><p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Student profile</p><p className="mt-1 truncate text-sm font-semibold">{selectedStudent?.name ?? "Student"}</p>{selectedStudent?.joinCode && <p className="mt-0.5 font-mono text-xs tracking-wider" style={{ color: theme.muted }}>{selectedStudent.joinCode}</p>}<button type="button" onClick={() => { setSettingsOpen(false); setStudentCodeInput(""); setStudentCodeError(""); setActive(null); setActiveTestId(null); setActiveExamId(null); setPracticeSession(null); navigatePractice("home"); setStudentPage("home"); }} className="mt-3 min-h-10 w-full rounded-full border px-3 text-sm font-semibold" style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }}>Log out / switch student</button></section>}
           <fieldset><legend className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Design style</legend><div className="grid grid-cols-2 gap-2">
             {Object.entries(designStyles).map(([key, style]) => { const swatch = style[preferences.theme]; return <button key={key} type="button" aria-pressed={preferences.designStyle === key} onClick={() => savePreferences({ ...preferences, designStyle: key as DesignStyle })} className="rounded-xl border p-3 text-left transition-all hover:shadow-sm" style={{ borderColor: preferences.designStyle === key ? theme.accent : theme.border, background: swatch.surface, color: swatch.ink }}><span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: swatch.accent }} /><strong className="text-sm">{style.name}</strong>{preferences.designStyle === key && <Check size={14} className="ml-auto" style={{ color: theme.accent }} />}</span><span className="mt-1 block text-[10px] leading-4" style={{ color: swatch.muted }}>{style.description}</span></button>; })}
           </div></fieldset>
          <fieldset><legend className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Container shadows</legend><div className="grid gap-2">
            {([{ id: "hard-offset", title: "Hard Offset Brutal", detail: "Crisp ink edge and 5px offset" }, { id: "soft-elevation", title: "Soft 3D Elevation", detail: "Quiet lift with a soft shadow" }, { id: "pillowed-clay", title: "Pillowed Clay", detail: "Padded, molded depth" }] as const).map((mode) => <button key={mode.id} type="button" aria-pressed={preferences.shadowMode === mode.id} onClick={() => savePreferences({ ...preferences, shadowMode: mode.id })} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition" style={{ borderColor: preferences.shadowMode === mode.id ? theme.accent : theme.border, background: preferences.shadowMode === mode.id ? theme.accent + "0d" : theme.surface }}><span><strong className="block text-xs">{mode.title}</strong><span className="mt-0.5 block text-[10px]" style={{ color: theme.muted }}>{mode.detail}</span></span>{preferences.shadowMode === mode.id && <Check size={15} style={{ color: theme.accent }} />}</button>)}
          </div></fieldset>
           <fieldset><legend className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Appearance</legend><div className="grid grid-cols-2 gap-2">
             {(["light", "dark"] as const).map((mode) => { const swatch = designStyles[preferences.designStyle][mode]; return <button key={mode} type="button" aria-pressed={preferences.theme === mode} onClick={() => savePreferences({ ...preferences, theme: mode })} className="rounded-xl border p-3 text-center text-sm font-semibold transition-shadow hover:shadow-sm" style={{ borderColor: preferences.theme === mode ? theme.accent : theme.border, background: swatch.page, color: swatch.ink }}><span className="mx-auto mb-2 block h-6 w-6 rounded-full border" style={{ background: swatch.surface, borderColor: swatch.border }} />{mode === "light" ? "Light" : "Dark"}</button>; })}
           </div></fieldset>
          <fieldset><legend className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Typeface</legend><div className="grid grid-cols-3 gap-2">
            {(["serif", "sans", "mono"] as const).map((font) => <button key={font} onClick={() => savePreferences({ ...preferences, font })} className="rounded-xl border px-2 py-2 text-sm capitalize" style={{ borderColor: preferences.font === font ? theme.accent : theme.border, fontFamily: font === "serif" ? "Georgia, serif" : font === "mono" ? "ui-monospace, monospace" : "Arial, sans-serif" }}>{font}</button>)}
          </div></fieldset>
          <div><div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}><span className="inline-flex items-center gap-2"><Type size={15} /> Text size</span><span>{preferences.fontSize}px</span></div>
            <div className="flex items-center gap-3"><button onClick={() => savePreferences({ ...preferences, fontSize: Math.max(16, preferences.fontSize - 1) })} aria-label="Decrease text size" className="rounded-lg border p-2" style={{ borderColor: theme.border }}><Minus size={15} /></button><input aria-label="Text size" aria-valuetext={`${preferences.fontSize} pixels`} type="range" min="16" max="30" step="1" value={preferences.fontSize} onChange={(event) => savePreferences({ ...preferences, fontSize: Number(event.target.value) })} className="h-8 min-w-0 flex-1 cursor-pointer touch-pan-x accent-emerald-700" style={{ touchAction: "pan-x" }} /><button onClick={() => savePreferences({ ...preferences, fontSize: Math.min(30, preferences.fontSize + 1) })} aria-label="Increase text size" className="rounded-lg border p-2" style={{ borderColor: theme.border }}><Plus size={15} /></button></div>
          </div>
          <fieldset><legend className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Line spacing</legend><div className="grid grid-cols-3 gap-2">
            {(["compact", "relaxed", "spacious"] as const).map((spacing) => <button key={spacing} onClick={() => savePreferences({ ...preferences, lineHeight: spacing })} className="rounded-xl border px-2 py-2 text-xs capitalize" style={{ borderColor: preferences.lineHeight === spacing ? theme.accent : theme.border }}>{spacing}</button>)}
          </div></fieldset>
          <fieldset><legend className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Reading width</legend><div className="grid grid-cols-2 gap-2">
            {(["narrow", "wide"] as const).map((width) => <button key={width} onClick={() => savePreferences({ ...preferences, width })} className="rounded-xl border px-3 py-2 text-sm capitalize" style={{ borderColor: preferences.width === width ? theme.accent : theme.border }}>{width}</button>)}
          </div></fieldset>
          <label className="flex cursor-pointer items-center justify-between rounded-xl border p-3 text-sm font-semibold" style={{ borderColor: theme.border }}>Focus mode<input type="checkbox" checked={preferences.focus} onChange={(event) => savePreferences({ ...preferences, focus: event.target.checked })} className="h-4 w-4 accent-emerald-700" /></label>
        </div>
      </motion.div>}
      </AnimatePresence>
    </div>
  );

  return (
    <div data-design-style={preferences.designStyle} data-style={preferences.designStyle} data-mode={preferences.theme} data-appearance={preferences.theme} data-shadow-mode={preferences.shadowMode} data-font={preferences.font} data-spacing={preferences.lineHeight} className="libaria-app min-h-screen w-full transition-colors duration-300" style={{ background: frameTheme.page, color: frameTheme.ink, "--bg-page": frameTheme.page, "--bg-card": frameTheme.surface, "--bg-accent": frameTheme.accent, "--text-main": frameTheme.ink, "--text-muted": frameTheme.muted, "--border-color": frameTheme.border, "--style-ink": "#18181B" } as CSSProperties}>
      <div className="mx-auto min-h-screen max-w-6xl px-4 sm:px-8">
        <motion.header
          initial={false}
          animate={headerVisible || settingsOpen ? { y: 0, opacity: 1 } : { y: "-110%", opacity: 0 }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 340, damping: 34, mass: 0.8 }}
          className="sticky top-0 z-30 -mx-4 flex min-h-[76px] items-center justify-between border-b px-4 backdrop-blur-2xl sm:-mx-8 sm:px-8"
          style={{ borderColor: frameTheme.border, background: frameTheme.page + "e8", pointerEvents: headerVisible || settingsOpen ? "auto" : "none" }}
        >
          <div className="flex items-center gap-3">
            {active || activeTest ? <button onClick={() => { setActive(null); setActiveTestId(null); setActiveExamId(null); setStudentPage("library"); }} className="inline-flex items-center gap-2 rounded-full p-2 pr-3 text-sm font-bold transition hover:bg-black/5"><ArrowLeft size={18} /><span>Library</span></button> : <button type="button" onClick={() => { setActive(null); setActiveTestId(null); setActiveExamId(null); setPracticeSession(null); navigatePractice("home"); setStudentPage("home"); setTeacherMode(false); }} className="flex items-center gap-2 text-lg font-black tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: frameTheme.accent, color: frameTheme.ink }}><BookOpen size={19} /></span>Libraria</button>}
            {(active || activeTest) && !preferences.focus && <span className="hidden text-sm sm:inline" style={{ color: frameTheme.muted }}>Libraria <span className="mx-1">/</span>{activeTest?.title ?? current?.title}</span>}
          </div>
          {!teacherMode && <div className="flex items-center gap-2">
            <div className="relative">
              <button type="button" aria-expanded={profileOpen} aria-haspopup="menu" onClick={() => { setProfileOpen((open) => !open); setSettingsOpen(false); }} className="inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition" style={{ borderColor: frameTheme.border, background: frameTheme.surface, color: frameTheme.ink }}><UserRound size={16} /><span className="max-w-32 truncate">{selectedStudent?.name ?? "My profile"}</span><ChevronDown size={14} /></button>
              <AnimatePresence>{profileOpen && <motion.div role="menu" initial={reduceMotion ? false : { opacity: 0, y: -5, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduceMotion ? undefined : { opacity: 0, y: -4 }} className="absolute right-0 top-14 z-30 w-60 rounded-2xl border p-3 shadow-xl" style={{ borderColor: frameTheme.border, background: frameTheme.surface, color: frameTheme.ink }}><p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: frameTheme.muted }}>Student profile</p><p className="truncate px-2 text-sm font-semibold">{selectedStudent?.name ?? "No student selected"}</p>{selectedStudent?.joinCode && <p className="px-2 pt-1 font-mono text-xs tracking-wider" style={{ color: frameTheme.muted }}>Code · {selectedStudent.joinCode}</p>}<button role="menuitem" type="button" onClick={() => { setProfileOpen(false); setStudentCodeInput(""); setStudentCodeError(""); setActive(null); setActiveTestId(null); setActiveExamId(null); setPracticeSession(null); navigatePractice("home"); setStudentPage("home"); }} className="mt-3 min-h-10 w-full rounded-xl border px-3 text-left text-sm font-semibold" style={{ borderColor: frameTheme.border }}>Switch profile / log out</button></motion.div>}</AnimatePresence>
            </div>
            {Settings}
          </div>}
          {teacherMode && teacherAuthenticated && <div className="flex items-center gap-2">{Settings}</div>}
        </motion.header>

        <AnimatePresence mode="wait" initial={false}>
    {teacherMode ? teacherAuthenticated ? <TeacherDashboard key="teacher-dashboard" students={students} assignments={assignments} tests={allTests} theme={classroomTheme} onAddStudent={addStudent} onUpdateStudentCode={updateStudentCode} onToggleStudentPhase={toggleStudentPhase} onCreateAssignments={createAssignments} onCreateTest={createTeacherTest} onPublishMaterial={publishTeacherTest} onUnpublishMaterial={unpublishTeacherTest} onUpdateMaterial={(testId, updates) => { const next = allTests.map((item) => item.id === testId ? { ...item, ...updates } : item); setAllTests(next); persistSharedClassroomValue(CUSTOM_TESTS_STORAGE_KEY, JSON.stringify(next.filter((item) => item.id.startsWith("custom-")))); }} onGradeAssignment={gradeAssignment} onTeachPointer={publishTeachingPointer} onBack={() => { publishTeachingPointer(null); void signOutTeacher(); }} /> : <TeacherLoginGate theme={classroomTheme} onCancel={() => setTeacherMode(false)} onAuthenticated={() => setTeacherAuthenticated(true)} /> : studentPage === "home" ? <StudentHomePage studentName={selectedStudent?.name ?? "Student"} theme={theme} code={studentCodeInput} error={studentCodeError} onCodeChange={(value) => { setStudentCodeInput(value); setStudentCodeError(""); }} onSubmit={joinStudentProfile} onContinue={() => setStudentPage("library")} onTeacherLogin={() => setTeacherMode(true)} /> : practiceSession ? <FlashcardPracticeView cards={practiceSession} theme={theme} onClose={() => { setPracticeSession(null); navigatePractice("home"); }} /> : activeTest ? <ReadingTestView key={activeTest.id + (activeExamId ?? "")} test={activeTest} theme={theme} preferences={preferences} exam={activeExam} studentId={selectedStudentId} draft={activeExam ? undefined : progress.testDrafts[activeTest.id]} notes={readingNotes} teacherPointer={teachingPointer} onDraftChange={persistTestDraft} onAddNote={addReadingNote} onUpdateNote={updateReadingNote} onBack={() => { setActiveTestId(null); setActiveExamId(null); }} onComplete={(score, answers) => completeTest(activeTest, score, answers)} /> : studentPage === "exams" ? <StudentExamsPage assignments={assignments} tests={allTests} studentId={selectedStudentId} theme={theme} onOpenExam={beginExam} onBackToLibrary={() => setStudentPage("library")} /> : active && current ? <motion.main key={"read-" + currentKey} initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -8 }} transition={{ type: "spring", stiffness: 280, damping: 30 }} className="mx-auto pb-16 pt-10" style={{ maxWidth: preferences.width === "narrow" ? 740 : 920 }}>
          <div className={preferences.focus ? "mb-10 text-center" : "mb-10"}>
            <p className="mb-3 text-xs font-bold uppercase tracking-[.18em]" style={{ color: theme.accent }}>{englishCurriculum[active.unit].title}</p>
            <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">{current.title}</h1>
            <div className={"mt-4 flex items-center gap-4 text-sm " + (preferences.focus ? "justify-center" : "")} style={{ color: theme.muted }}><span className="inline-flex items-center gap-1.5"><Clock3 size={15} />{minutes} min read</span><span>{words} words</span></div>
          </div>
          <motion.article layout initial={reduceMotion ? false : { opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="rounded-3xl border px-6 py-8 shadow-sm transition-all duration-300 sm:px-12 sm:py-12" style={{ background: theme.surface, color: theme.ink, borderColor: theme.border, fontFamily: preferences.font === "serif" ? "Georgia, 'Times New Roman', serif" : preferences.font === "mono" ? "ui-monospace, SFMono-Regular, monospace" : "Arial, Helvetica, sans-serif" }}>
            <div className="mb-7 flex items-center justify-between border-b pb-4" style={{ borderColor: theme.border }}><span className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.muted }}>A short read</span><button onClick={() => toggleSaved(currentKey)} aria-pressed={progress.saved.includes(currentKey)} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold transition hover:bg-black/5" style={{ color: progress.saved.includes(currentKey) ? theme.accent : theme.muted }}><Bookmark size={17} fill={progress.saved.includes(currentKey) ? "currentColor" : "none"} />{progress.saved.includes(currentKey) ? "Saved" : "Save"}</button></div>
              <motion.p
                className="mx-auto max-w-prose"
                animate={{ fontSize: preferences.fontSize }}
                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 170, damping: 25, mass: 0.75 }}
                style={{ lineHeight: preferences.lineHeight === "compact" ? 1.55 : preferences.lineHeight === "spacious" ? 2.15 : 1.85 }}
              >{current.reading}</motion.p>
            {!preferences.focus && <p className="mx-auto mt-8 max-w-prose border-t pt-5 text-sm" style={{ borderColor: theme.border, color: theme.muted }}>Read at your own pace. Your place and preferences stay saved on this device.</p>}
          </motion.article>
          <div className="mt-6 flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center">
            <button onClick={() => moveLesson(-1)} disabled={lessons.findIndex((item) => item.key === currentKey) === 0} className="inline-flex items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-bold transition hover:shadow-sm disabled:opacity-40" style={{ borderColor: theme.border, background: theme.surface }}><ArrowLeft size={16} />Previous read</button>
            <button onClick={markRead} className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition hover:opacity-90" style={{ background: progress.read.includes(currentKey) ? theme.surface : theme.accent, color: progress.read.includes(currentKey) ? theme.accent : theme.surface, border: progress.read.includes(currentKey) ? "1px solid " + theme.border : "1px solid " + theme.accent }}><Check size={17} />{progress.read.includes(currentKey) ? "Finished reading" : "Mark as read"}</button>
            <button onClick={() => moveLesson(1)} disabled={lessons.findIndex((item) => item.key === currentKey) === lessons.length - 1} className="inline-flex items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-bold transition hover:shadow-sm disabled:opacity-40" style={{ borderColor: theme.border, background: theme.surface }}>Next read<ArrowRight size={16} /></button>
          </div>
        </motion.main> : <motion.main key="library" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -8 }} transition={{ type: "spring", stiffness: 280, damping: 30 }} className="pb-16 pt-10">
          {practiceStep === "home" && <>
          <section data-tactile="card" className="reading-hero mb-8 grid gap-6 rounded-[1.75rem] border p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8" style={{ background: theme.surface, borderColor: theme.border }}>
            <div><p className="mb-2 text-[11px] font-bold uppercase tracking-[.18em]" style={{ color: theme.accent }}>IELTS reading practice</p><h1 className="max-w-2xl font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Read closely. Understand more.</h1><p className="mt-3 max-w-xl text-sm leading-6" style={{ color: theme.muted }}>Practice with focused IELTS passages, question sets, and answer explanations.</p>{heroTest && <button type="button" onClick={() => startTest(heroTest)} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold" style={{ background: theme.accent, color: theme.onAccent }}>Continue reading - {heroTest.title}<ArrowRight size={16} /></button>}</div>
            <div className="flex items-center justify-center gap-4 sm:justify-end"><ReadingSticker theme={theme} reduceMotion={reduceMotion} /><div data-tactile="card" className="rounded-xl border px-5 py-4 sm:min-w-48" style={{ borderColor: theme.border, background: theme.page + "88" }}><span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Phase {activePhase} progress</span><p className="mt-1.5 text-3xl font-semibold tracking-tight">{phaseTests.filter((test) => progress.testsDone.includes(test.id)).length}<span className="ml-1 text-sm font-medium" style={{ color: theme.muted }}>/ {phaseTests.length} tests</span></p><div className="mt-2.5 h-1 overflow-hidden rounded-full" style={{ background: theme.border }}><div className="h-full rounded-full transition-[width] duration-500" style={{ width: Math.min(100, phaseTests.filter((test) => progress.testsDone.includes(test.id)).length / Math.max(1, phaseTests.length) * 100) + "%", background: theme.accent }} /></div></div></div>
          </section>
          </>}
          <section aria-labelledby="practice-title" className={practiceStep === "home" ? "mb-5 grid gap-3 sm:grid-cols-2" : "mb-10 overflow-hidden rounded-[1.75rem] border p-5 shadow-[0_24px_70px_rgba(28,36,31,.10)] sm:p-8"} style={practiceStep === "home" ? undefined : { borderColor: theme.border, background: `linear-gradient(145deg, ${theme.surface}, ${theme.page})`, color: theme.ink }}>
            {practiceStep !== "home" && <div className="mb-6 flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}>Practice</p><p className="mt-1 text-sm" style={{ color: theme.muted }}>{["Practice home", "Choose test", "Choose section", "Deck setup"][practiceStageIndex]}</p></div><div className="flex items-center gap-1.5" aria-label={`Step ${practiceStageIndex} of 3`}>{[1, 2, 3].map((step) => <span key={step} className="h-1.5 rounded-full transition-all duration-300" style={{ width: step === practiceStageIndex ? 24 : 8, background: step <= practiceStageIndex ? theme.accent : theme.border }} />)}</div></div>}
            <>
              {practiceStep === "home" ? <><motion.button data-tactile="card" key="practice-home" type="button" onClick={() => navigatePractice("test")} initial={reduceMotion ? false : { opacity: 0, y: 8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduceMotion ? undefined : { opacity: 0, scale: .98 }} whileHover={reduceMotion ? undefined : preferences.shadowMode === "hard-offset" ? { x: -3, y: -3 } : { y: -3 }} whileTap={reduceMotion ? undefined : preferences.shadowMode === "hard-offset" ? { x: 3, y: 3, scale: .99 } : { scale: .985 }} transition={{ type: "spring", stiffness: 320, damping: 26 }} className="group flex min-h-24 w-full items-center justify-between rounded-2xl px-6 py-5 text-left sm:min-h-28 sm:px-9" style={{ background: theme.accent, color: theme.onAccent }}><span><span className="block font-serif text-2xl font-semibold tracking-tight sm:text-3xl">Practice</span><span className="mt-1 block text-xs opacity-80 sm:text-sm">Read at your own pace</span></span><span className="grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-white/10 transition-transform duration-300 group-hover:translate-x-1"><ArrowRight size={20} /></span></motion.button><motion.button data-tactile="card" key="timed-exam-home" type="button" onClick={() => setStudentPage("exams")} initial={reduceMotion ? false : { opacity: 0, y: 8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} whileHover={reduceMotion ? undefined : preferences.shadowMode === "hard-offset" ? { x: -3, y: -3 } : { y: -3 }} whileTap={reduceMotion ? undefined : preferences.shadowMode === "hard-offset" ? { x: 3, y: 3, scale: .99 } : { scale: .985 }} transition={{ type: "spring", stiffness: 320, damping: 26 }} className="group flex min-h-24 w-full items-center justify-between rounded-2xl border px-6 py-5 text-left sm:min-h-28 sm:px-9" style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }}><span><span className="block font-serif text-2xl font-semibold tracking-tight sm:text-3xl">Timed Exam</span><span className="mt-1 block text-xs sm:text-sm" style={{ color: theme.muted }}>Open your assigned exams</span></span><span className="grid h-11 w-11 place-items-center rounded-full border transition-transform duration-300 group-hover:translate-x-1" style={{ borderColor: theme.border, color: theme.accent }}><CalendarClock size={19} /></span></motion.button></> : practiceStep === "test" ? <motion.div key="choose-test" initial={reduceMotion ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? undefined : { opacity: 0, x: -8 }} transition={{ duration: .2 }}>
                <button type="button" onClick={() => navigatePractice("home")} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: theme.muted }}><ArrowLeft size={15} />Practice home</button><h2 id="practice-title" className="font-serif text-3xl font-semibold">Choose a test</h2><p className="mt-2 text-sm" style={{ color: theme.muted }}>Choose the reading set you want to review.</p>
                <div className="mt-5 grid gap-2.5 sm:grid-cols-2">{[0, 1, 2, 3].map((index) => { const test = practiceTests[index]; const disabled = !test; const selected = Boolean(test && selectedPracticeTest?.id === test.id); const progressWidth = test ? Math.min(100, Math.round((progress.testDrafts[test.id] ? Object.keys(progress.testDrafts[test.id].answers).length / Math.max(1, test.questions.length) : 0) * 100)) : 0; return <motion.button key={index} type="button" disabled={disabled} onClick={() => { if (test) navigatePractice("section", { testId: test.id, sections: [1] }); }} whileHover={!disabled && !reduceMotion ? { y: -2 } : undefined} whileTap={!disabled && !reduceMotion ? { scale: .99 } : undefined} className="relative flex min-h-24 items-center gap-3 rounded-xl border p-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50" style={{ borderColor: selected ? theme.accent : theme.border, background: selected ? theme.accent + "0b" : theme.surface, boxShadow: selected ? `0 0 0 1px ${theme.accent}22` : undefined }}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[11px] font-bold" style={{ background: selected ? theme.accent : theme.page, color: selected ? theme.surface : theme.muted }}>0{index + 1}</span><span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-[.14em]" style={{ color: selected ? theme.accent : theme.muted }}>{test ? selected ? "Selected" : "Available" : "Locked"}</span><span className="mt-0.5 block truncate text-sm font-semibold">{test?.title ?? `Reading Test ${index + 1}`}</span><span className="mt-0.5 block truncate text-[11px]" style={{ color: theme.muted }}>{test?.topic ?? "More practice is coming soon"}</span>{test && <span className="mt-2 block h-0.5 overflow-hidden rounded-full" style={{ background: theme.border }}><span className="block h-full rounded-full" style={{ width: `${progressWidth}%`, background: theme.accent }} /></span>}</span>{test && <ArrowRight size={16} style={{ color: selected ? theme.accent : theme.muted }} />}</motion.button>; })}</div>
              </motion.div> : practiceStep === "section" ? <motion.div key="choose-section" initial={reduceMotion ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? undefined : { opacity: 0, x: -8 }} transition={{ duration: .2 }}>
                <button type="button" onClick={() => navigatePractice("test")} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: theme.muted }}><ArrowLeft size={15} />Choose another test</button><p className="text-xs font-bold uppercase tracking-[.15em]" style={{ color: theme.accent }}>{selectedPracticeTest?.title}</p><h2 id="practice-title" className="mt-2 font-serif text-3xl font-semibold">Choose a section</h2><p className="mt-2 text-sm" style={{ color: theme.muted }}>Pick a skill to practice. Reading is ready now.</p>
                <div className="mt-5 grid gap-2 sm:grid-cols-3">{readingVocabularyDecks.map((deck) => { const selected = practiceSections.includes(deck.section); return <button key={deck.section} type="button" aria-pressed={selected} onClick={() => { const nextSections = selected ? practiceSections.filter((section) => section !== deck.section) : [...practiceSections, deck.section].sort((a, b) => a - b); const nextTotal = readingVocabularyDecks.filter((item) => nextSections.includes(item.section)).reduce((total, item) => total + item.cards.length, 0); const nextCount = Math.min(practiceQuestionCount, Math.max(1, nextTotal)); navigatePractice("section", { sections: nextSections, count: nextCount, replace: true }); }} className="rounded-xl border p-4 text-left transition" style={{ borderColor: selected ? theme.accent : theme.border, background: selected ? theme.accent + "0b" : theme.surface }}><span className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[.12em]" style={{ color: selected ? theme.accent : theme.muted }}>Section {deck.section}</span><span className="grid h-5 w-5 place-items-center rounded-full border" style={{ borderColor: selected ? theme.accent : theme.border, background: selected ? theme.accent : "transparent", color: theme.surface }}>{selected && <Check size={12} />}</span></span><span className="mt-2 block text-sm font-semibold leading-snug">{deck.title}</span><span className="mt-1 block text-[11px]" style={{ color: theme.muted }}>{deck.cards.length} study cards</span></button>; })}</div>
                <div className="mt-5 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center"><p className="text-xs" style={{ color: theme.muted }}>{practiceSections.length} of {readingVocabularyDecks.length} sections selected</p><button type="button" disabled={practiceSections.length === 0} onClick={() => navigatePractice("setup", { count: Math.min(practiceQuestionCount, maxPracticeCards) })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-40" style={{ background: theme.accent, color: theme.onAccent }}>Choose card count <ArrowRight size={15} /></button></div>
              </motion.div> : <motion.div key="deck-setup" initial={reduceMotion ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? undefined : { opacity: 0, x: -8 }} transition={{ duration: .2 }}>
                <button type="button" onClick={() => navigatePractice("section")} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: theme.muted }}><ArrowLeft size={15} />Choose section</button><p className="text-xs font-bold uppercase tracking-[.15em]" style={{ color: theme.accent }}>Reading · {selectedPracticeTest?.title}</p><h2 id="practice-title" className="mt-2 font-serif text-3xl font-semibold">Set up your deck</h2><p className="mt-2 text-sm" style={{ color: theme.muted }}>Choose how many cards you want to review.</p>
                <div className="mt-6 rounded-2xl border p-5 sm:p-6" style={{ borderColor: theme.border, background: theme.page }}><div className="flex items-center justify-between gap-3"><div><p className="font-semibold">Maximum cards</p><p className="mt-1 text-xs" style={{ color: theme.muted }}>From your selected sections</p></div><motion.span key={practiceQuestionCount} initial={reduceMotion ? false : { opacity: .6, y: 3 }} animate={{ opacity: 1, y: 0 }} className="text-lg font-bold tabular-nums" style={{ color: theme.accent }}>{practiceQuestionCount}</motion.span></div><input aria-label="Maximum number of flashcards" type="range" min="1" max={maxPracticeCards} step="1" value={Math.min(practiceQuestionCount, maxPracticeCards)} onChange={(event) => navigatePractice("setup", { count: Number(event.target.value), replace: true })} className="mt-5 h-8 w-full cursor-pointer" style={{ accentColor: theme.accent }} /><div className="flex justify-between text-xs" style={{ color: theme.muted }}><span>1 card</span><span>{maxPracticeCards} max</span></div></div>
                <div className="mt-5 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center"><p className="text-xs" style={{ color: theme.muted }}>{selectedVocabularyCount} cards across {practiceSections.length} selected sections · about {Math.max(1, Math.round(practiceQuestionCount * .4))} minutes</p><button type="button" disabled={!selectedPracticeTest || practiceSections.length === 0} onClick={() => { if (!selectedPracticeTest) return; const selectedDecks = readingVocabularyDecks.filter((deck) => practiceSections.includes(deck.section)); const maxCards = Math.max(...selectedDecks.map((deck) => deck.cards.length)); const deck = Array.from({ length: maxCards }, (_, index) => selectedDecks.flatMap((section) => section.cards[index] ? [{ ...section.cards[index], sectionTitle: section.title }] : [])).flat(); const cards = deck.slice(0, Math.min(practiceQuestionCount, deck.length)).map((item, index) => ({ questionNumber: index + 1, prompt: item.term, options: [], optionLabels: "plain" as const, answer: item.meaning, explanation: [item.sectionTitle, item.example ? `Example: “${item.example}”` : item.kind === "collocation" ? "Collocation" : "Academic vocabulary"].join(" · ") })); setPracticeSession(cards); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40" style={{ background: theme.accent, color: theme.onAccent }}>Start flashcards <ArrowRight size={15} /></button></div>
              </motion.div>}
            </>
          </section>
          {practiceStep === "home" && importantExamRows.length > 0 && <section aria-labelledby="important-exams-title" className="mb-10"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}>Your next steps</p><h2 id="important-exams-title" className="mt-1 font-serif text-2xl font-semibold">Important exams</h2></div><button type="button" onClick={() => setStudentPage("exams")} className="inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold" style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }}>All exams <ArrowRight size={14} /></button></div><div className="grid gap-3 md:grid-cols-2">{importantExamRows.map(({ assignment, test, startsAt, endsAt }) => { const graded = Boolean(assignment.gradedAt); const available = clockNow >= startsAt; const inProgress = Boolean(assignment.startedAt); const label = graded ? "Graded · Ready to review" : inProgress ? "In progress" : available ? "Ready to start" : "Upcoming"; const statusColor = graded ? (theme.dark ? "#9bd5a6" : "#27734a") : available ? theme.accent : theme.muted; return <article key={assignment.id} className="flex flex-col justify-between gap-4 rounded-2xl border p-4 sm:p-5" style={{ borderColor: graded ? statusColor + "66" : theme.border, background: theme.surface }}><div><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ background: statusColor + "18", color: statusColor }}>{label}</span><span className="text-xs" style={{ color: theme.muted }}>{assignment.durationMinutes} min</span></div><h3 className="mt-3 font-serif text-xl font-semibold">{test.title}</h3><p className="mt-1 text-sm" style={{ color: theme.muted }}>{graded ? `Score · ${assignment.score ?? 0}/${test.questions.length} points` : `${test.topic} · ${available ? `Due ${new Date(endsAt).toLocaleString()}` : `Opens ${new Date(startsAt).toLocaleString()}`}`}</p>{graded && assignment.teacherFeedback && <p className="mt-2 line-clamp-2 text-sm" style={{ color: theme.muted }}>{assignment.teacherFeedback}</p>}</div><button type="button" onClick={() => graded ? beginExam(assignment) : available ? beginExam(assignment) : setStudentPage("exams")} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-bold sm:w-auto sm:self-start" style={{ background: available || graded ? theme.accent : theme.page, color: available || graded ? theme.onAccent : theme.ink }}>{graded ? "Review answers" : inProgress ? "Resume exam" : available ? "Start exam" : "View exam details"}<ArrowRight size={15} /></button></article>; })}</div></section>}
            {practiceStep === "home" && <section aria-label="Learning phases" className="mb-10"><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}>Your learning path</p><h2 className="mt-1 font-serif text-2xl font-semibold">Choose a phase</h2></div><span className="text-xs font-medium" style={{ color: theme.muted }}>{unlockedPhases.length} of 4 open for {selectedStudent?.name ?? "student"}</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{([1, 2, 3, 4] as const).map((phase) => { const unlocked = unlockedPhases.includes(phase); const selected = activePhase === phase; return <motion.button data-tactile="control" key={phase} type="button" disabled={!unlocked} onClick={() => setActivePhase(phase)} aria-current={selected ? "step" : undefined} whileHover={unlocked && !reduceMotion ? preferences.shadowMode === "hard-offset" ? { x: -3, y: -3 } : { y: -2 } : undefined} whileTap={unlocked && !reduceMotion ? preferences.shadowMode === "hard-offset" ? { x: 3, y: 3 } : { scale: 0.98 } : undefined} transition={{ type: "spring", stiffness: 420, damping: 30 }} className="flex min-h-16 items-center justify-between rounded-2xl border px-4 py-3 text-left font-semibold disabled:cursor-not-allowed disabled:opacity-35" style={{ borderColor: selected ? theme.accent : theme.border, background: selected ? theme.accent : theme.surface, color: selected ? theme.surface : unlocked ? theme.ink : theme.muted, boxShadow: selected ? "0 8px 24px " + theme.accent + "28" : undefined }}><span><span className="block text-xs opacity-75">{unlocked ? selected ? "Open now" : "Available" : "Locked"}</span><span className="mt-0.5 block">Phase {phase}</span></span>{selected ? <Check size={18} /> : unlocked ? <span className="h-4 w-4 rounded-full border" style={{ borderColor: theme.border }} /> : <LockKeyhole size={15} />}</motion.button>; })}</div></section>}
          {practiceStep === "home" && <ExamHistoryPreview rows={pastExams} theme={theme} onViewAll={() => setStudentPage("exams")} />}
          {practiceStep === "home" && <>{NOTES_ENABLED && readingNotes.length > 0 && <section className="mb-10"><div className="mb-4 flex items-center gap-2"><StickyNote size={17} style={{ color: theme.accent }} /><div><p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}>Later review</p><h2 className="mt-1 font-serif text-2xl font-semibold">Your reading notes</h2></div></div><div className="grid gap-3 md:grid-cols-2">{readingNotes.map((note) => <article key={note.id} className="rounded-2xl border p-4" style={{ borderColor: theme.border, background: theme.surface }}><p className="text-xs font-bold" style={{ color: theme.accent }}>{note.context}</p><p className="mt-1 text-xs" style={{ color: theme.muted }}>{note.testTitle}</p>{note.quote && <p className="mt-2 line-clamp-2 text-sm italic leading-6" style={{ color: theme.muted }}>“{note.quote}”</p>}<p className="mt-2 whitespace-pre-wrap text-sm leading-6">{note.text}</p></article>)}</div></section>}
          {visibleTests.length > 0 && <section className="mb-10"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}>Phase {activePhase}</p><h2 className="mt-1 font-serif text-2xl font-semibold">Reading tests</h2><p className="mt-1 text-sm" style={{ color: theme.muted }}>Practice comprehension with your assigned reading materials.</p></div><span className="text-sm" style={{ color: theme.muted }}>{phaseTests.filter((test) => progress.testsDone.includes(test.id)).length} of {phaseTests.length} complete</span></div>
                        <div className="grid gap-4">{visibleTests.map((test) => {
              const notOpen = Boolean(test.opensAt && clockNow < new Date(test.opensAt).getTime());
              const closed = Boolean(test.closesAt && clockNow > new Date(test.closesAt).getTime());
              const available = !notOpen && !closed;
              const isComplete = progress.testsDone.includes(test.id);
              const isInProgress = (progress.testsStarted ?? []).includes(test.id) && !isComplete;
              const draft = progress.testDrafts[test.id];
              const answeredCount = Object.keys(draft?.answers ?? {}).length;
              const percent = isComplete ? 100 : Math.min(100, Math.round((answeredCount / Math.max(1, test.questions.length)) * 100));
              const statusLabel = isComplete ? "Completed" : isInProgress ? "In progress" : "Not started";
              const statusColor = isComplete ? studentGreen : isInProgress ? "#5e8aa8" : theme.muted;
              const statusBackground = isComplete ? studentGreen + "18" : isInProgress ? (theme.dark ? "#293b46" : "#e8f1f7") : theme.page;
              return <motion.article data-tactile="card" key={test.id} whileHover={reduceMotion ? undefined : { y: -3 }} whileTap={reduceMotion ? undefined : { scale: 0.99 }} transition={{ type: "spring", stiffness: 420, damping: 30 }} className="exam-card rounded-2xl border-l-[5px] border-y border-r p-5 shadow-sm sm:p-6" style={{ background: isInProgress ? theme.accent + "08" : theme.surface, borderTopColor: theme.border, borderRightColor: theme.border, borderBottomColor: theme.border, borderLeftColor: isComplete || isInProgress ? theme.accent : theme.border }}>
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold uppercase tracking-[.12em]" style={{ color: theme.accent }}>IELTS Reading · Phase {test.phase ?? 1}</span><span className="text-xs font-semibold" style={{ color: theme.muted }}>{test.minutes > 0 ? `${test.minutes} min · ` : ""}{test.questions.length} questions</span></div>
                <h3 className="mt-3 font-serif text-2xl font-semibold leading-snug sm:text-3xl">{test.title}</h3>
                <p className="mt-1 text-sm" style={{ color: theme.muted }}>{test.topic}</p>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><span data-tactile="badge" className="inline-flex rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: statusBackground, color: statusColor }}>{statusLabel}</span><span className="text-sm font-bold tabular-nums" style={{ color: theme.ink }}>{percent}%</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full" role="progressbar" aria-label={`${test.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} style={{ background: theme.border }}><motion.div className="h-full rounded-full" initial={false} animate={{ width: percent + "%" }} transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 160, damping: 24 }} style={{ background: isComplete ? studentGreen : theme.accent }} /></div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs" style={{ color: theme.muted }}>{isInProgress ? "Last activity: " + timeAgo(draft?.updatedAt, clockNow) : isComplete ? "Finished reading" : "Ready when you are"}</p><button disabled={!available} onClick={() => startTest(test)} className="inline-flex min-h-12 items-center gap-2 rounded-full px-6 py-3 text-sm font-bold shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45" style={{ background: available ? theme.accent : theme.page, color: available ? theme.surface : theme.muted }}>{notOpen ? "Not open yet" : closed ? "Closed" : isInProgress ? "Continue Reading" : isComplete ? "Review" : "Start Reading"}<ArrowRight size={16} /></button></div>
              </motion.article>;
            })}</div>
          </section>}
          <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex h-12 flex-1 items-center gap-3 rounded-full border px-4 sm:max-w-md" style={{ borderColor: theme.border, background: theme.surface }}><Search size={18} style={{ color: theme.muted }} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find an IELTS test" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:opacity-60" style={{ color: theme.ink }} /><span className="sr-only">Search IELTS tests</span></label>
          </div>
          <div className="space-y-9">
            {false && activePhase === 1 && englishCurriculum.map((unit, unitIndex) => {
              const items = visible.filter((entry) => entry.unitIndex === unitIndex);
              if (!items.length) return null;
              return <section key={unit.title}>
                <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}>Phase 1 · Collection {String(unitIndex + 1).padStart(2, "0")}</p><h2 className="mt-1 font-serif text-2xl font-semibold">{unit.title}</h2><p className="mt-1 text-sm" style={{ color: theme.muted }}>{unit.description}</p></div><span className="hidden text-sm sm:block" style={{ color: theme.muted }}>{items.length} {items.length === 1 ? "read" : "reads"}</span></div>
                <div className="grid gap-3 md:grid-cols-2">{items.map(({ lesson, lessonIndex, unitIndex: u, key }) => {
                  const isRead = progress.read.includes(key);
                  const isStarted = (progress.readsStarted ?? []).includes(key) && !isRead;
                  const isSaved = progress.saved.includes(key);
                  const estimated = Math.max(1, Math.ceil(lesson.reading.split(/\s+/).length / 180));
                  return <motion.article key={key} whileHover={reduceMotion ? undefined : { y: -3 }} whileTap={reduceMotion ? undefined : { scale: 0.985 }} transition={{ type: "spring", stiffness: 420, damping: 30 }} className="group flex min-h-40 flex-col justify-between rounded-2xl border p-5 shadow-sm" style={{ background: theme.surface, borderColor: theme.border }}>
                    <button onClick={() => openLesson(u, lessonIndex)} className="text-left"><span className="mb-3 flex items-center gap-2 text-xs font-semibold" style={{ color: isRead ? theme.accent : theme.muted }}><span>{isRead ? "Finished" : isStarted ? "In progress" : "English read"}</span><span>·</span><span>{estimated} min</span></span><span className="block font-serif text-xl font-semibold leading-snug group-hover:underline decoration-1 underline-offset-4">{lesson.title}</span><span className="mt-2 line-clamp-2 block text-sm leading-6" style={{ color: theme.muted }}>{lesson.reading}</span>{isStarted && <span className="mt-3 block h-1 overflow-hidden rounded-full" style={{ background: theme.border }}><span className="block h-full w-1/3 rounded-full" style={{ background: theme.accent + "90" }} /></span>}</button>
                    <div className="mt-4 flex items-center justify-between"><button onClick={() => openLesson(u, lessonIndex)} className="inline-flex items-center gap-2 text-base font-bold" style={{ color: theme.accent }}>{isRead ? "Read again" : isStarted ? "Continue reading" : "Start reading"}<ArrowRight size={16} /></button><button onClick={() => toggleSaved(key)} aria-label={isSaved ? "Remove saved read" : "Save read"} aria-pressed={isSaved} className="rounded-full p-2 transition hover:bg-black/5" style={{ color: isSaved ? theme.accent : theme.muted }}><Bookmark size={17} fill={isSaved ? "currentColor" : "none"} /></button></div>
                  </motion.article>;
                })}</div>
              </section>;
            })}
            {visible.length === 0 && visibleTests.length === 0 && <div className="rounded-2xl border p-10 text-center" style={{ borderColor: theme.border, background: theme.surface, color: theme.muted }}><BookOpen className="mx-auto mb-3" /><p className="font-semibold">{activePhase === 1 ? "No reads found. Try another search or filter." : "No materials added to Phase " + activePhase + " yet."}</p>{activePhase === 1 ? <button onClick={() => { setQuery(""); setFilter("all"); }} className="mt-3 text-sm font-bold" style={{ color: theme.accent }}>Show all reading</button> : <p className="mt-2 text-sm">Ask teacher to add materials for your profile.</p>}</div>}
          </div>
          <footer className="mt-10 flex items-center justify-between border-t pt-5 text-xs" style={{ borderColor: theme.border, color: theme.muted }}><span>{cloudStatus === "connected" ? "Progress synced online." : cloudStatus === "syncing" ? "Syncing classroom…" : cloudStatus === "error" ? "Online sync unavailable · changes remain on this device." : "Saved on this device."}</span><button onClick={() => { localStorage.removeItem(studentProgressKey(selectedStudentId)); if (selectedStudentId === DEFAULT_STUDENT_ID) { localStorage.removeItem(LEGACY_STORAGE_KEY); localStorage.removeItem("lingo-english-local-progress"); } setProgress(emptyProgress); }} className="underline underline-offset-4 hover:opacity-70">Clear reading progress</button></footer>
        </>}
        </motion.main>}
        </AnimatePresence>
      </div>
    </div>
  );
}




