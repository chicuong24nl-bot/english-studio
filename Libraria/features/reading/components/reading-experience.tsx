"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, ChevronDown, Layers3, RotateCcw, Sparkles, StickyNote, X, XCircle } from "lucide-react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { getReadingParagraphs, type ReadingFlashcard, type ReadingPassage, type ReadingQuestion, type ReadingTest } from "@/features/reading/data/reading-tests";
import { createLocalId, type ExamAssignment, type ReadingNote, type ReadingTestDraft, type TeachingPointer } from "@/features/classroom/data-model";
import { persistSharedClassroomValue } from "@/features/classroom/client-sync";
import type { Preferences, PracticeCard, ReaderTheme } from "@/features/reading/components/ui-types";

const NOTES_ENABLED = false;
export function answerIsCorrect(question: ReadingQuestion, answer: number | string | undefined) {
  if (answer === undefined) return false;
  if (typeof question.answer === "number") return answer === question.answer;
  if (typeof answer === "number") return question.options[answer]?.trim().toLocaleLowerCase() === question.answer.trim().toLocaleLowerCase();
  return String(answer).trim().toLocaleLowerCase() === question.answer.trim().toLocaleLowerCase();
}

export function timeAgo(timestamp: string | undefined, now: number) {
  if (!timestamp) return "Just started";
  const minutes = Math.max(0, Math.floor((now - new Date(timestamp).getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
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

export function FlashcardPracticeView({ cards, theme, onClose }: { cards: PracticeCard[]; theme: ReaderTheme; onClose: () => void }) {
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

export function ReadingSticker({ theme, reduceMotion }: { theme: ReaderTheme; reduceMotion: boolean | null }) {
  return <div aria-hidden="true" className="flex shrink-0 items-center justify-center">
    <motion.div animate={reduceMotion ? undefined : { y: [0, -5, 0], rotate: [-3, 1, -3] }} transition={reduceMotion ? undefined : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }} className="relative grid h-[4.5rem] w-[4.5rem] place-items-center rounded-[1.35rem] border-[3px] border-white/90 shadow-[0_8px_22px_rgba(34,29,20,.2)]" style={{ background: `linear-gradient(145deg, ${theme.accent}, ${theme.accent}cc)` }}>
      <BookOpen size={31} strokeWidth={1.8} color={theme.surface} />
      <motion.span animate={reduceMotion ? undefined : { scale: [1, 1.18, 1], opacity: [.75, 1, .75] }} transition={reduceMotion ? undefined : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }} className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full border-2 border-white shadow-sm" style={{ background: "#f6c86f", color: "#5c3e1f" }}><Sparkles size={13} strokeWidth={2.4} /></motion.span>
      <span className="absolute -bottom-1 -left-1 h-3 w-3 rounded-full border-2 border-white" style={{ background: theme.accent }} />
    </motion.div>
  </div>;
}

export function ReadingTestView({ test, theme, preferences, exam, studentId, draft, notes, teacherPointer, onDraftChange, onAddNote, onUpdateNote, onBack, onComplete }: { test: ReadingTest; theme: ReaderTheme; preferences: Preferences; exam?: ExamAssignment | null; studentId: string; draft?: ReadingTestDraft; notes: ReadingNote[]; teacherPointer: TeachingPointer | null; onDraftChange: (testId: string, draft: ReadingTestDraft) => void; onAddNote: (note: ReadingNote) => void; onUpdateNote: (noteId: string, text: string) => void; onBack: () => void; onComplete: (score: number, answers: Record<number, number | string>) => void }) {
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
    if (lastFollowedTeacherPosition.current === positionKey && activeSection === teacherPointer.section) return;
    lastFollowedTeacherPosition.current = positionKey;
    const timer = window.setTimeout(() => {
      setActiveSection(teacherPointer.section);
      window.requestAnimationFrame(() => document.getElementById(`teacher-passage-${test.id}-${teacherPointer.section}-${teacherPointer.paragraphIndex}`)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeSection, teacherPointer, test.id, isSectionedTest, reduceMotion]);
  const questionEntries = test.questions.map((question, index) => ({ question, index })).filter(({ index }) => {
    if (!isSectionedTest || !activeSectionPage) return true;
    return legacySectionedTest ? index >= activeSectionPage.range[0] && index < activeSectionPage.range[1] : (test.questions[index].passageIndex ?? 0) === activeSectionPage.passageIndex;
  });
  useEffect(() => {
    if (exam || submitted) return;
    const timer = window.setTimeout(() => onDraftChange(test.id, { answers, activeSection, updatedAt: new Date().toISOString() }), 0);
    return () => window.clearTimeout(timer);
  }, [answers, activeSection, exam, onDraftChange, submitted, test.id]);
  const flashcardStorageKey = "libaria-flashcards-" + studentId + "-" + test.id;
  useEffect(() => {
    let known: string[] = [];
    try { const saved = JSON.parse(localStorage.getItem(flashcardStorageKey) ?? "[]"); known = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : []; } catch { known = []; }
    const timer = window.setTimeout(() => setKnownFlashcards(known), 0);
    return () => window.clearTimeout(timer);
  }, [flashcardStorageKey]);
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
  const submit = useCallback(() => {
    if (submitted) return;
    setSubmitted(true);
    onComplete(score, answers);
  }, [answers, onComplete, score, submitted]);

  useEffect(() => { submitTimerRef.current = submit; }, [submit]);

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

  if (isSectionedTest && activeSection === null) return <motion.main initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -6 }} className="mx-auto max-w-4xl px-1 pb-16 pt-5 sm:px-0 sm:pt-8">
    <button type="button" onClick={onBack} className="mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }}><ArrowLeft size={16} />Back to tests</button>
    <div className="mb-7"><p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}>IELTS Reading · Test 1</p><h1 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">Choose a section</h1><p className="mt-3 max-w-2xl text-sm leading-6" style={{ color: theme.muted }}>Pick where you want to begin. Each section opens on its own page, and your answers stay saved while you move between them.</p></div>
    <div className="grid gap-3 md:grid-cols-3">{sectionPages.map((section) => { const count = section.range[1] - section.range[0]; const answered = test.questions.slice(section.range[0], section.range[1]).reduce((total, _question, offset) => total + (answers[section.range[0] + offset] !== undefined ? 1 : 0), 0); return <motion.button key={section.section} type="button" onClick={() => navigateSection(section.section)} whileHover={reduceMotion ? undefined : { y: -3 }} whileTap={reduceMotion ? undefined : { scale: 0.985 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} className="flex min-h-48 flex-col justify-between rounded-2xl border p-5 text-left shadow-sm" style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }}><div><span className="inline-flex rounded-full px-3 py-1 text-xs font-bold" style={{ background: theme.accent + "16", color: theme.accent }}>Section {section.section}</span><h2 className="mt-4 font-serif text-xl font-semibold leading-snug">{section.title}</h2><p className="mt-2 text-sm" style={{ color: theme.muted }}>Questions {section.range[0] + 1}–{section.range[1]}</p></div><div className="mt-5 flex items-center justify-between"><span className="text-xs font-semibold" style={{ color: theme.muted }}>{answered} / {count} answered</span><span className="inline-flex items-center gap-1 text-sm font-bold" style={{ color: theme.accent }}>Open section <ArrowRight size={15} /></span></div></motion.button>; })}</div>
  </motion.main>;

  return <motion.main initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -8 }} transition={{ type: "spring", stiffness: 280, damping: 30 }} className="mx-auto max-w-4xl px-1 pb-16 pt-5 sm:px-0 sm:pt-8">
    {isSectionedTest && activeSectionPage && <nav aria-label="Reading sections" className="mb-6 flex flex-col justify-between gap-3 rounded-2xl border p-3 sm:flex-row sm:flex-wrap sm:items-center sm:p-4" style={{ borderColor: theme.border, background: theme.surface }}><div><p className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.accent }}>Section {activeSectionPage.section} of {sectionPages.length}</p><p className="mt-1 text-sm font-semibold">{activeSectionPage.range[1] > activeSectionPage.range[0] ? `Questions ${(test.questionNumberStart ?? 1) + activeSectionPage.range[0]}–${(test.questionNumberStart ?? 1) + activeSectionPage.range[1] - 1}` : "No questions linked yet"}</p></div><div className="grid grid-cols-3 gap-2"><button type="button" onClick={() => navigateSection(null)} className="min-h-10 rounded-full border px-2 text-[11px] font-semibold sm:px-3 sm:text-xs" style={{ borderColor: theme.border, color: theme.ink }}>All sections</button><button type="button" disabled={activeSectionPage.section <= 1} onClick={() => navigateSection(Math.max(1, (activeSection ?? 1) - 1))} className="min-h-10 rounded-full border px-2 text-[11px] font-semibold disabled:opacity-40 sm:px-3 sm:text-xs" style={{ borderColor: theme.border, color: theme.ink }}>Previous</button><button type="button" disabled={activeSectionPage.section >= sectionPages.length} onClick={() => navigateSection(Math.min(sectionPages.length, (activeSection ?? 1) + 1))} className="min-h-10 rounded-full px-2 text-[11px] font-bold disabled:opacity-40 sm:px-3 sm:text-xs" style={{ background: theme.accent, color: theme.onAccent }}>Next section</button></div></nav>}<div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-bold uppercase tracking-[.18em]" style={{ color: theme.accent }}>{exam ? "Scheduled exam" : "Phase " + (test.phase ?? 1) + " · Reading test"}</p><h1 className="max-w-2xl font-serif text-3xl font-semibold leading-tight sm:text-4xl">{test.title}</h1><p className="mt-3 text-sm" style={{ color: theme.muted }}>{test.topic} · {exam ? `${exam.durationMinutes} minutes` : test.minutes > 0 ? `${test.minutes} minutes` : "No time limit"} · {test.questions.length} questions</p></div><div className="flex items-center gap-3">{exam && !submitted && <div className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: theme.border, background: theme.surface }}><span className="block text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Time left</span><strong className="font-mono text-2xl tabular-nums" style={{ color: (secondsLeft ?? 0) < 60 ? "#d45b50" : theme.ink }}>{Math.floor((secondsLeft ?? 0) / 60).toString().padStart(2, "0")}:{((secondsLeft ?? 0) % 60).toString().padStart(2, "0")}</strong></div>}{submitted && exam?.gradedAt && <div className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: theme.border, background: theme.surface }}><span className="block text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Your score</span><strong className="text-2xl">{exam.score ?? 0}<span className="text-base font-medium" style={{ color: theme.muted }}> / {test.questions.length}</span></strong></div>}{NOTES_ENABLED && <button type="button" onClick={() => { setNotePanelOpen(true); setNoteContext("Reading test"); setNoteQuote(""); }} className="inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold" style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }}><StickyNote size={16} />Notes <span className="text-xs" style={{ color: theme.muted }}>{notes.filter((note) => note.testId === test.id).length}</span></button>}</div></div>
    {(!exam || test.kind === "ielts") && <div className="space-y-5">{shownPassages.map((passage, passageIndex) => { const sectionNumber = passage.section ?? ((test.passages ?? [passage]).indexOf(passage) + 1); const sectionPointer = teacherPointer?.testId === test.id && teacherPointer.section === sectionNumber ? teacherPointer : null; return <motion.article layout key={passageIndex} className="rounded-3xl border p-6 shadow-sm sm:p-10" style={{ background: theme.surface, borderColor: theme.border, color: theme.ink, fontFamily }}>
      <div className="mb-6 flex items-center justify-between gap-3 border-b pb-4" style={{ borderColor: theme.border }}><div><span className="block text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.muted }}>Section {sectionNumber}</span><h2 className="mt-1 font-serif text-2xl font-semibold">{passage.title}</h2>{passage.difficulty && <span className="mt-1 inline-block text-xs" style={{ color: theme.muted }}>{passage.difficulty}</span>}{sectionPointer && <span role="status" className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: theme.accent + "18", color: theme.accent }}><span className="h-2 w-2 animate-pulse rounded-full" style={{ background: theme.accent }} />Teacher is guiding this section</span>}</div><span className="shrink-0 text-xs" style={{ color: theme.muted }}>{passage.text.split(/\s+/).filter(Boolean).length} words</span></div>
      <div className="space-y-5" style={{ fontSize: preferences.fontSize, lineHeight: preferences.lineHeight === "compact" ? 1.55 : preferences.lineHeight === "spacious" ? 2.15 : 1.85 }}>{getReadingParagraphs(passage).map((paragraph, index) => { const labelMatch = paragraph.match(/^\(([A-H])\)\s*([\s\S]*)$/); const paragraphText = labelMatch ? labelMatch[2] : paragraph; const isTeacherParagraph = sectionPointer?.paragraphIndex === index; const start = sectionPointer?.highlightStart; const end = sectionPointer?.highlightEnd; const hasTeacherHighlight = isTeacherParagraph && Number.isInteger(start) && Number.isInteger(end) && (start ?? 0) >= 0 && (end ?? 0) > (start ?? 0) && (end ?? 0) <= paragraphText.length; return <div id={`teacher-passage-${test.id}-${sectionNumber}-${index}`} key={index} className={`${labelMatch ? "grid grid-cols-[2rem_minmax(0,1fr)] gap-3 whitespace-pre-line" : "whitespace-pre-line"} relative rounded-lg transition-colors duration-200`} style={isTeacherParagraph ? { background: theme.accent + "12", boxShadow: `inset 3px 0 ${theme.accent}` } : undefined}>{isTeacherParagraph && sectionPointer && <span aria-hidden="true" className="pointer-events-none absolute z-10" style={{ left: `${Math.max(3, Math.min(97, sectionPointer.x))}%`, top: `${Math.max(2, Math.min(98, sectionPointer.y))}%`, transform: "translate(-50%, -50%)" }}><span className="absolute -top-6 left-0 whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-bold text-white shadow-sm" style={{ background: theme.accent }}>{sectionPointer.teacherName}</span><span className="mx-auto block h-7 w-0.5" style={{ background: theme.accent, boxShadow: `0 0 0 2px ${theme.surface}` }} /></span>}{labelMatch && <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border text-sm font-bold" style={{ borderColor: theme.border, background: theme.page, color: theme.accent }}>{labelMatch[1]}</span>}<span className="min-w-0">{hasTeacherHighlight ? <>{paragraphText.slice(0, start)}<mark className="rounded-sm px-0.5" style={{ background: theme.accent + "55", color: theme.ink, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" } as React.CSSProperties}>{paragraphText.slice(start, end)}</mark>{paragraphText.slice(end)}</> : paragraphText}</span></div>; })}</div>
    </motion.article>; })}</div>}
    <section className={exam ? "space-y-4" : "mt-8 space-y-4"}><div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}>{exam ? "Exam" : "Comprehension"}</p><h2 className="mt-1 font-serif text-2xl font-semibold">{exam ? "Exam questions" : "Check what you understood"}</h2></div>{submitted && !exam && <button onClick={() => { setAnswers({}); setSubmitted(false); }} className="text-sm font-bold" style={{ color: theme.accent }}>Try again</button>}</div>
      {questionEntries.map(({ question, index }) => { const questionNumber = (test.questionNumberStart ?? (test.id === "ielts-hiv-pandemic" ? 13 : 1)) + index; const questionInstructions = questionGroupInstructions(test, index); const isTextAnswer = question.type === "sentence-completion" || question.type === "summary-completion"; const isSwipeChoice = question.type === "matching-headings" || question.type === "true-false-not-given" || question.type === "yes-no-not-given"; const revealResult = submitted && (!exam || Boolean(exam.gradedAt)); const correct = answerIsCorrect(question, answers[index]); const earnedPoint = exam?.gradedAt ? Boolean(exam.questionPoints?.[index]) : correct; return <Fragment key={question.prompt}>{questionInstructions && <div className="rounded-2xl border px-4 py-4 sm:px-5" style={{ borderColor: theme.border, background: theme.page, color: theme.ink }}><p className="text-sm font-bold">{questionInstructions.title}</p><p className="mt-2 text-sm leading-6" style={{ color: theme.muted }}>{questionInstructions.text}</p></div>}<motion.fieldset layout key={question.prompt} className="group relative rounded-2xl border p-5 sm:p-6" style={{ borderColor: theme.border, background: theme.surface }}><legend className="px-1 text-base font-semibold leading-relaxed">{questionNumber}. {question.prompt}</legend>{isSwipeChoice ? <MatchingHeadingPicker question={question} selectedIndex={typeof answers[index] === "number" ? answers[index] as number : undefined} disabled={submitted} revealResult={revealResult} earnedPoint={earnedPoint} onSelect={(optionIndex) => setAnswers({ ...answers, [index]: optionIndex })} theme={theme} /> : question.type && <p className="mt-1 text-xs font-semibold uppercase tracking-wider" style={{ color: theme.muted }}>{question.type.replaceAll("-", " ")}</p>}{isTextAnswer ? <input type="text" value={String(answers[index] ?? "")} disabled={submitted} onChange={(event) => setAnswers({ ...answers, [index]: event.target.value })} placeholder="Type your answer" className="mt-3 h-12 w-full rounded-xl border px-4 text-sm outline-none" style={{ borderColor: theme.border, background: theme.page, color: theme.ink }} /> : !isSwipeChoice && <div className="mt-3 grid gap-2 sm:grid-cols-2">{question.options.map((option, optionIndex) => { const selected = answers[index] === optionIndex; const correctOption = typeof question.answer === "number" ? optionIndex === question.answer : option.trim().toLocaleLowerCase() === question.answer.trim().toLocaleLowerCase(); const wrongSelected = revealResult && selected && !earnedPoint; const answerStyle = wrongSelected ? { borderColor: "#d56b73", background: theme.dark ? "#472a30" : "#fff0f0", color: theme.ink } : revealResult && correctOption ? { borderColor: "#5b9b70", background: theme.dark ? "#233a2d" : "#e9f5ed", color: theme.ink } : selected ? { borderColor: theme.accent, background: theme.accent + "14", color: theme.ink } : { borderColor: theme.border, background: "transparent", color: theme.ink }; return <label key={option} className="flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed transition-colors" style={answerStyle}><input type="radio" name={"question-" + index} value={optionIndex} checked={selected} disabled={submitted} onChange={() => setAnswers({ ...answers, [index]: optionIndex })} className="mt-1 accent-emerald-700" /><span className="flex-1">{option}</span>{wrongSelected && <XCircle size={17} className="shrink-0 text-rose-600" aria-label="Incorrect answer" />}{revealResult && correctOption && <CheckCircle2 size={17} className="shrink-0 text-emerald-600" aria-label="Correct answer" />}</label>; })}</div>}{revealResult && <div className="mt-4 rounded-2xl border p-4 sm:p-5" style={{ borderColor: earnedPoint ? "#5b9b70" : "#d56b73", background: earnedPoint ? theme.dark ? "#20392b" : "#e9f5ed" : theme.dark ? "#40272c" : "#fff0f0" }}><div className="flex items-center gap-2">{earnedPoint ? <CheckCircle2 size={20} className="shrink-0" style={{ color: theme.dark ? "#a2d9af" : "#286b43" }} /> : <XCircle size={20} className="shrink-0" style={{ color: theme.dark ? "#f0a0a5" : "#ad424c" }} />}<p className="text-base font-bold" style={{ color: earnedPoint ? theme.dark ? "#a2d9af" : "#23643d" : theme.dark ? "#f0a0a5" : "#a83e48" }}>{earnedPoint ? "Correct" : "Incorrect"}</p><span className="ml-auto text-xs font-semibold" style={{ color: theme.muted }}>{exam?.gradedAt ? (exam.questionPoints?.[index] ?? 0) + " point(s)" : earnedPoint ? "1 point" : "0 points"}</span></div>{!earnedPoint && <p className="mt-3 text-sm font-semibold leading-6" style={{ color: theme.ink }}>Correct answer: {typeof question.answer === "number" ? question.options[question.answer] : question.answer}</p>}{question.explanation && <p className="mt-2 text-sm leading-6" style={{ color: theme.ink }}>{question.explanation}</p>}</div>}{submitted && exam && !exam.gradedAt && <p className="mt-3 text-sm" style={{ color: theme.muted }}>Your response has been sent for teacher review.</p>}<button type="button" aria-label={"Add note for question " + questionNumber} title="Add note" onClick={() => openNote("Question " + questionNumber + " · " + question.prompt)} className="absolute right-4 top-4 hidden rounded-full border p-2 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 sm:inline-flex" style={{ borderColor: theme.border, color: theme.accent, background: theme.surface }}><StickyNote size={14} /></button></motion.fieldset></Fragment>; })}
      {!submitted ? isSectionedTest && activeSectionPage && activeSectionPage.section < sectionPages.length ? <button type="button" onClick={() => navigateSection(Math.min(sectionPages.length, (activeSection ?? 1) + 1))} className="mt-3 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition hover:opacity-90" style={{ background: theme.accent, color: theme.onAccent }}>Next section <ArrowRight size={17} /></button> : <div><button onClick={() => submit()} className="mt-3 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition hover:opacity-90" style={{ background: theme.accent, color: theme.onAccent }}>{exam ? "Submit exam" : "Check answers"} <Check size={17} /></button>{!exam && Object.keys(answers).length !== test.questions.length && <p className="mt-2 text-xs" style={{ color: theme.muted }}>Unanswered questions will count as incorrect.</p>}</div> : <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4" style={{ borderColor: theme.border, background: theme.surface }}><p className="font-semibold">{exam ? exam.gradedAt ? "Graded · " + (exam.score ?? 0) + "/" + test.questions.length + " points" : "Exam submitted. Your teacher will review it and award points." : score === test.questions.length ? "Excellent reading." : score >= 3 ? "Good work. Review any missed answers." : "Keep practicing. Read the passage once more."}</p><button onClick={onBack} className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold" style={{ background: theme.accent, color: theme.onAccent }}>{exam ? exam.gradedAt ? "Back to classroom" : "Return to classroom" : "Back to Phase 1"} <ArrowRight size={15} /></button></div>}
    </section>
    {submitted && !exam && Boolean(test.flashcards?.length) && <section className="mt-8 rounded-3xl border p-5 sm:p-7" style={{ borderColor: theme.border, background: theme.surface }}><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}><Layers3 size={15} />After reading</p><h2 className="mt-1 font-serif text-2xl font-semibold">Vocabulary & collocations</h2><p className="mt-1 text-sm" style={{ color: theme.muted }}>Tap a card to reveal its meaning, then mark it for practice.</p></div><span className="text-sm font-semibold" style={{ color: theme.muted }}>{knownFlashcards.length}/{test.flashcards?.length ?? 0} known</span></div>{(() => { const cards = test.flashcards ?? []; const card = cards[flashcardIndex]; if (!card) return null; const known = knownFlashcards.includes(card.term.trim().toLocaleLowerCase()); return <div className="mx-auto max-w-2xl"><motion.button type="button" aria-pressed={flashcardFlipped} onClick={() => setFlashcardFlipped((value) => !value)} whileTap={reduceMotion ? undefined : { scale: 0.99 }} className="flex min-h-52 w-full flex-col items-center justify-center rounded-2xl border p-7 text-center transition-colors" style={{ borderColor: theme.accent + "55", background: theme.page, color: theme.ink }}><span className="mb-4 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider" style={{ background: theme.accent + "18", color: theme.accent }}>{card.kind === "collocation" ? "Collocation" : "Vocabulary"} · {flashcardIndex + 1} of {cards.length}</span><AnimatePresence mode="wait" initial={false}><motion.span key={flashcardFlipped ? "back" : "front"} initial={reduceMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -5 }} transition={{ duration: 0.16 }} className="block"><strong className="block font-serif text-3xl">{flashcardFlipped ? card.meaning : card.term}</strong>{flashcardFlipped && card.example && <span className="mt-3 block max-w-prose text-sm leading-6" style={{ color: theme.muted }}>“{card.example}”</span>}</motion.span></AnimatePresence><span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: theme.muted }}><RotateCcw size={13} />Tap to {flashcardFlipped ? "see term" : "flip"}</span></motion.button><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><button type="button" disabled={flashcardIndex === 0} onClick={() => { setFlashcardIndex((index) => Math.max(0, index - 1)); setFlashcardFlipped(false); }} className="rounded-full border px-4 py-2.5 text-sm font-semibold disabled:opacity-40" style={{ borderColor: theme.border }}>Previous</button><button type="button" disabled={flashcardIndex >= cards.length - 1} onClick={() => { setFlashcardIndex((index) => Math.min(cards.length - 1, index + 1)); setFlashcardFlipped(false); }} className="rounded-full border px-4 py-2.5 text-sm font-semibold disabled:opacity-40" style={{ borderColor: theme.border }}>Next</button></div><div className="flex gap-2"><button type="button" onClick={() => markFlashcard(card, false)} className="rounded-full border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: theme.border, color: theme.ink }}>Practice again</button><button type="button" onClick={() => markFlashcard(card, true)} className="rounded-full px-5 py-2.5 text-sm font-bold" style={{ background: theme.accent, color: theme.onAccent }}>{known ? "Known ✓" : "I know this"}</button></div></div></div>; })()}</section>}
    {NOTES_ENABLED && notePanelOpen && <aside aria-label="Reading notes" className="fixed inset-x-3 bottom-3 z-50 max-h-[78dvh] overflow-y-auto rounded-3xl border p-5 shadow-2xl md:inset-x-auto md:inset-y-3 md:right-3 md:w-[360px]" style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }}><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.accent }}>Connected notes</p><h2 className="mt-1 font-serif text-xl font-semibold">{test.title}</h2></div><button type="button" onClick={() => setNotePanelOpen(false)} aria-label="Close notes" className="rounded-full p-2" style={{ color: theme.muted }}><X size={18} /></button></div><div className="mb-4 rounded-xl px-3 py-2" style={{ background: theme.page }}><p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: theme.muted }}>Linked to</p><p className="mt-1 text-sm font-semibold">{noteContext}</p>{noteQuote && <p className="mt-1 line-clamp-3 text-xs leading-5" style={{ color: theme.muted }}>“{noteQuote}”</p>}</div><label className="block text-xs font-bold" style={{ color: theme.muted }}>Your note<textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Write a quick thought…" rows={2} className="mt-2 w-full resize-y rounded-xl border p-3 text-sm font-normal outline-none focus:ring-2" style={{ borderColor: theme.border, background: theme.page, color: theme.ink }} /></label><div className="mt-2 flex justify-end"><button type="button" disabled={!noteText.trim()} onClick={saveNote} className="rounded-full px-4 py-2 text-sm font-bold disabled:opacity-45" style={{ background: theme.accent, color: theme.onAccent }}>Save note</button></div><div className="mt-5 border-t pt-4" style={{ borderColor: theme.border }}><p className="mb-3 text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Notes for this reading · {notes.filter((note) => note.testId === test.id).length}</p><div className="space-y-2">{notes.filter((note) => note.testId === test.id).length ? notes.filter((note) => note.testId === test.id).map((note) => <article key={note.id} className="rounded-xl border-l-4 border-y border-r p-3" style={{ borderLeftColor: "#e9c96b", borderTopColor: theme.border, borderRightColor: theme.border, borderBottomColor: theme.border, background: theme.surface }}><button type="button" onClick={() => { setExpandedNoteId((current) => current === note.id ? null : note.id); setEditNoteText(note.text); }} aria-expanded={expandedNoteId === note.id} className="w-full text-left"><span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: theme.accent }}><StickyNote size={13} />{note.context}</span><span className="mt-1 block line-clamp-2 text-sm leading-5" style={{ color: theme.ink }}>{note.text}</span>{note.quote && <span className="mt-1 block line-clamp-1 text-xs italic" style={{ color: theme.muted }}>“{note.quote}”</span>}</button>{expandedNoteId === note.id && <div className="mt-2"><textarea aria-label="Edit note" value={editNoteText} onChange={(event) => setEditNoteText(event.target.value)} rows={3} className="w-full resize-y rounded-lg border p-2.5 text-sm leading-5 outline-none" style={{ borderColor: theme.border, background: theme.page, color: theme.ink }} /><div className="mt-2 flex justify-end"><button type="button" disabled={!editNoteText.trim()} onClick={() => { onUpdateNote(note.id, editNoteText.trim()); setExpandedNoteId(null); }} className="rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-45" style={{ background: theme.accent, color: theme.onAccent }}>Save changes</button></div></div>}</article>) : <p className="text-sm" style={{ color: theme.muted }}>No notes yet. Select a line or tap a paragraph to add one.</p>}</div></div></aside>}
  </motion.main>;
}
