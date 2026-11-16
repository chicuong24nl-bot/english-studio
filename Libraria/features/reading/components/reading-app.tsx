"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Bookmark, BookOpen, CalendarClock, Check, ChevronDown, Clock3, LockKeyhole, Minus, Plus, Search, Settings2, StickyNote, Type, UserRound, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { englishCurriculum } from "@/content/english-curriculum";
import { readingVocabularyDecks } from "@/features/reading/data/vocabulary-decks";
import { readingTests, type ReadingTest } from "@/features/reading/data/reading-tests";
import { CUSTOM_TESTS_STORAGE_KEY, createLocalId, createStudentJoinCode, DEFAULT_STUDENT_ID, EXAMS_STORAGE_KEY, SELECTED_STUDENT_STORAGE_KEY, STUDENTS_STORAGE_KEY, TEACHING_POINTER_STORAGE_KEY, emptyStudentProgress, studentNotesKey, studentProgressKey, type ExamAssignment, type ReadingNote, type ReadingTestDraft, type StudentProfile, type StudentProgress, type TeachingPointer } from "@/features/classroom/data-model";
import { TeacherDashboard } from "@/features/classroom/components/teacher-dashboard";
import { TeacherLoginGate } from "@/features/classroom/components/teacher-login-gate";
import { collectLocalClassroomState, persistSharedClassroomValue } from "@/features/classroom/client-sync";
import { canStudentAccessMaterial, canStudentOpenExam, isPublishedMaterial } from "@/features/reading/data/material-policy";
import { StudentExamsPage } from "@/features/reading/components/student-exams-page";
import { StudentHomePage } from "@/features/reading/components/student-home-page";
import { answerIsCorrect, FlashcardPracticeView, ReadingSticker, ReadingTestView, timeAgo } from "@/features/reading/components/reading-experience";
import type { DesignStyle, Preferences, PracticeCard, ReaderTheme, StudentExamRow } from "@/features/reading/components/ui-types";
import { decodeRouteSegments, isKnownAppPath, parsePracticeLocation, practicePath, teacherTabs, type PracticeStep } from "@/features/reading/navigation/routes";

const LEGACY_STORAGE_KEY = "english-reader-progress";
const SETTINGS_KEY = "english-reader-settings";
const REMEMBERED_STUDENT_CODE_KEY = "libaria-remembered-student-code";
const NOTES_ENABLED = false;
type Progress = StudentProgress;
type TeacherTab = "students" | "materials" | "teach" | "exams" | "settings";
const baseReadingTestIds = new Set(readingTests.map((test) => test.id));
function mergeTeacherMaterials(saved: unknown): ReadingTest[] {
  const savedTests = Array.isArray(saved) ? saved as ReadingTest[] : [];
  return [
    ...readingTests.map((test) => ({ ...test, status: "draft" as const, ...savedTests.find((stored) => stored.id === test.id) })),
    ...savedTests.filter((test) => !baseReadingTestIds.has(test.id)),
  ];
}
function persistTeacherMaterials(tests: ReadingTest[]) {
  persistSharedClassroomValue(CUSTOM_TESTS_STORAGE_KEY, JSON.stringify(tests));
}
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

function buildPracticeCards(sections: number[], count: number): PracticeCard[] {
  const selectedDecks = readingVocabularyDecks.filter((deck) => sections.includes(deck.section));
  const maxCards = Math.max(0, ...selectedDecks.map((deck) => deck.cards.length));
  const deck = Array.from({ length: maxCards }, (_, index) => selectedDecks.flatMap((section) => section.cards[index] ? [{ ...section.cards[index], sectionTitle: section.title }] : [])).flat();
  return deck.slice(0, Math.min(count, deck.length)).map((item, index) => ({
    questionNumber: index + 1,
    prompt: item.term,
    options: [],
    optionLabels: "plain" as const,
    answer: item.meaning,
    explanation: [item.sectionTitle, item.example ? `Example: “${item.example}”` : item.kind === "collocation" ? "Collocation" : "Academic vocabulary"].join(" · "),
  }));
}

function ExamHistoryPreview({ rows, theme, onViewAll }: { rows: StudentExamRow[]; theme: ReaderTheme; onViewAll: () => void }) {
  if (!rows.length) return null;
  return <section aria-labelledby="exam-history-title" className="mb-10"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}>Completed & past</p><h2 id="exam-history-title" className="mt-1 font-serif text-2xl font-semibold">Exam history</h2><p className="mt-1 text-sm" style={{ color: theme.muted }}>Recent results and work waiting for teacher review.</p></div><button type="button" onClick={onViewAll} className="rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: theme.border, color: theme.ink }}>View all exams <ArrowRight className="ml-1 inline" size={14} /></button></div><div className="grid gap-3 md:grid-cols-2">{rows.slice(0, 4).map(({ assignment, test, expired }) => { const status = assignment.gradedAt ? "Graded" : assignment.completedAt ? "Waiting for review" : expired ? "Missed" : "Past"; const statusColor = assignment.gradedAt ? (theme.dark ? "#9bd5a6" : "#27734a") : assignment.completedAt ? "#a95e18" : theme.muted; return <article key={assignment.id} className="flex items-center justify-between gap-4 rounded-2xl border p-4" style={{ borderColor: theme.border, background: theme.surface }}><div className="min-w-0"><span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: statusColor }}>{status}</span><h3 className="mt-1 truncate font-semibold">{test.title}</h3><p className="mt-1 text-xs" style={{ color: theme.muted }}>{assignment.completedAt ? `Submitted ${new Date(assignment.completedAt).toLocaleDateString()}` : `Due ${new Date(assignment.startsAt).toLocaleDateString()}`}{assignment.gradedAt ? ` · ${assignment.score ?? 0}/${test.questions.length} points` : ""}</p>{assignment.teacherFeedback && <p className="mt-1 line-clamp-1 text-xs" style={{ color: theme.muted }}>{assignment.teacherFeedback}</p>}</div><span className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: statusColor + "18", color: statusColor }}>{assignment.gradedAt ? `${assignment.score ?? 0}/${test.questions.length}` : status}</span></article>; })}</div></section>;
}

export function ReadingApp() {
  const reduceMotion = useReducedMotion();
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [allTests, setAllTests] = useState<ReadingTest[]>(() => mergeTeacherMaterials([]));
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
  const [rememberStudent, setRememberStudent] = useState(false);
  const [rememberedStudentCode, setRememberedStudentCode] = useState("");
  const [studentLoginLoading, setStudentLoginLoading] = useState(false);
  const [assignments, setAssignments] = useState<ExamAssignment[]>([]);
  const [readingNotes, setReadingNotes] = useState<ReadingNote[]>([]);
  const [teacherMode, setTeacherMode] = useState(false);
  const [teacherAuthenticated, setTeacherAuthenticated] = useState(false);
  const [teachingPointer, setTeachingPointer] = useState<TeachingPointer | null>(null);
  const teachingChannel = useRef<BroadcastChannel | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [cloudStatus, setCloudStatus] = useState<"local" | "syncing" | "connected" | "error">("local");
  const [localDataReady, setLocalDataReady] = useState(false);
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
      const savedMaterials = savedTests ? JSON.parse(savedTests) as ReadingTest[] : [];
      setAllTests(mergeTeacherMaterials(savedMaterials));
      setTeachingPointer(() => {
        try {
          const raw = localStorage.getItem(TEACHING_POINTER_STORAGE_KEY);
          const pointer = raw ? JSON.parse(raw) as TeachingPointer : null;
          return pointer && (pointer.highlightText || Date.now() - pointer.updatedAt < 120_000) ? pointer : null;
        } catch { return null; }
      });
      remoteHydrated.current = true;
    } catch {
      setCloudStatus("error");
    }
  };

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
      finally { if (alive) setLocalDataReady(true); }
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
    navigateToPath("/library");
  };

  useEffect(() => {
    const readPointer = (raw: string | null) => {
      try {
        const pointer = raw ? JSON.parse(raw) as TeachingPointer : null;
        setTeachingPointer(pointer && (pointer.highlightText || Date.now() - pointer.updatedAt < 120_000) ? pointer : null);
      } catch { setTeachingPointer(null); }
    };
    readPointer(localStorage.getItem(TEACHING_POINTER_STORAGE_KEY));
    const onStorage = (event: StorageEvent) => { if (event.key === TEACHING_POINTER_STORAGE_KEY) readPointer(event.newValue); };
    window.addEventListener("storage", onStorage);
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("libaria-teaching");
    if (channel) {
      channel.onmessage = (event: MessageEvent<TeachingPointer | null>) => {
        const pointer = event.data;
        setTeachingPointer(pointer && (pointer.highlightText || Date.now() - pointer.updatedAt < 120_000) ? pointer : null);
      };
      teachingChannel.current = channel;
    }
    const expiryCheck = window.setInterval(() => setTeachingPointer((pointer) => pointer && !pointer.highlightText && Date.now() - pointer.updatedAt >= 120_000 ? null : pointer), 5_000);
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
      setRememberStudent(localStorage.getItem("libaria-remember-student") === "true");
      setRememberedStudentCode(localStorage.getItem(REMEMBERED_STUDENT_CODE_KEY) ?? "");
      localStorage.removeItem("libaria-remembered-student-id");
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
        const savedMaterials = JSON.parse(rawCustomTests);
        setAllTests(mergeTeacherMaterials(savedMaterials));
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
    if (studentPage !== "home") return;
    setStudentCodeInput(rememberStudent ? localStorage.getItem(REMEMBERED_STUDENT_CODE_KEY) ?? "" : "");
  }, [studentPage, rememberStudent]);

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
  const assignedToStudent = useCallback((test: ReadingTest) => canStudentAccessMaterial(test, selectedStudentId, selectedStudent), [selectedStudent, selectedStudentId]);
  const phaseTests = allTests.filter((test) => isPublishedMaterial(test) && test.kind !== "exam" && !test.timedExam && (test.kind === "ielts" || test.id.startsWith("custom-")) && (test.phase ?? 1) === activePhase && assignedToStudent(test));
  const unfinishedTest = phaseTests.find((test) => (progress.testsStarted ?? []).includes(test.id) && !progress.testsDone.includes(test.id) && (!test.opensAt || clockNow >= new Date(test.opensAt).getTime()) && (!test.closesAt || clockNow <= new Date(test.closesAt).getTime()));
  const heroTest = unfinishedTest ?? phaseTests.find((test) => (!test.opensAt || clockNow >= new Date(test.opensAt).getTime()) && (!test.closesAt || clockNow <= new Date(test.closesAt).getTime())) ?? null;
  const visibleTests = phaseTests.filter((test) => (test.title + " " + test.topic).toLowerCase().includes(query.toLowerCase()));
  const practiceTests = phaseTests.filter((test) => (!test.opensAt || clockNow >= new Date(test.opensAt).getTime()) && (!test.closesAt || clockNow <= new Date(test.closesAt).getTime()));
  const assignedExamRows = assignments.flatMap((assignment) => {
    const test = allTests.find((item) => item.id === assignment.testId);
    if (assignment.studentId !== selectedStudentId || !test || !isPublishedMaterial(test)) return [];
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
  const restoreAppRoute = useCallback(() => {
    let route = parsePracticeLocation(window.location.pathname, window.location.search);
    const decodedSegments = decodeRouteSegments(route.path);
    let segments = decodedSegments ?? [];
    const pathTest = segments[0] === "reading" ? allTests.find((test) => test.id === segments[1]) : undefined;
    const pathAssignment = segments[0] === "exam" ? assignments.find((assignment) => assignment.id === segments[1]) : undefined;
    const assignedTest = pathAssignment ? allTests.find((test) => test.id === pathAssignment.testId) : undefined;
    const validRoute = decodedSegments !== null
      && isKnownAppPath(route.path, segments, new Set(allTests.map((test) => test.id)), new Set(assignments.map((assignment) => assignment.id)))
      && (segments[0] !== "reading" || Boolean(pathTest && isPublishedMaterial(pathTest) && pathTest.kind !== "exam" && !pathTest.timedExam && assignedToStudent(pathTest)))
      && (segments[0] !== "exam" || Boolean(pathAssignment && assignedTest && canStudentOpenExam(pathAssignment, selectedStudentId, assignedTest, clockNow)));
    if (!validRoute) {
      window.history.replaceState({}, "", "/");
      route = parsePracticeLocation(window.location.pathname, window.location.search);
      segments = [];
    }
    const isLegacyPracticeRoute = new URLSearchParams(window.location.search).has("practice");
    const isPracticeRoute = segments[0] === "practice" || isLegacyPracticeRoute;
    setPracticeStep(isPracticeRoute ? route.step : "home");
    if (route.testId) setSelectedPracticeTestId(route.testId);
    setPracticeSections(route.sections);
    setPracticeQuestionCount(route.count);
    setActive(null);
    setSettingsOpen(route.path === "/settings" || route.path === "/teacher/style");
    setProfileOpen(route.path === "/profile");
    setTeacherMode(segments[0] === "teacher");
    if (route.path === "/flashcards") {
      setStudentPage("library");
      setPracticeSession(buildPracticeCards(route.sections, route.count));
      setActiveTestId(null);
      setActiveExamId(null);
      return;
    }
    setPracticeSession(null);
    if (segments[0] === "reading" && segments[1]) {
      setStudentPage("library");
      setActiveTestId(segments[1]);
      setActiveExamId(null);
      return;
    }
    if (segments[0] === "exam" && segments[1]) {
      setStudentPage("library");
      setActiveExamId(segments[1]);
      setActiveTestId(assignments.find((assignment) => assignment.id === segments[1])?.testId ?? null);
      return;
    }
    setActiveExamId(null);
    setActiveTestId(null);
    if (segments[0] === "teacher") {
      setStudentPage("library");
    } else if (isPracticeRoute || route.path === "/library" || route.path === "/settings" || route.path === "/profile" || route.path === "/demo") {
      setStudentPage("library");
    } else if (route.path === "/exams") {
      setStudentPage("exams");
    } else {
      setStudentPage("home");
    }
    return teacherTabs.includes(segments[1] as TeacherTab) ? segments[1] as TeacherTab : "students";
  }, [allTests, assignments, assignedToStudent, clockNow, selectedStudentId]);
  const navigateToPath = (path: string, replace = false) => {
    const target = new URL(path, window.location.origin);
    window.history[replace ? "replaceState" : "pushState"]({}, "", target);
    restoreAppRoute();
  };
  const openSettings = () => {
    const returnTo = window.location.pathname + window.location.search;
    navigateToPath(`${teacherMode ? "/teacher/style" : "/settings"}?returnTo=${encodeURIComponent(returnTo)}`);
  };
  const closeSettings = () => {
    const returnTo = new URLSearchParams(window.location.search).get("returnTo") || "/library";
    navigateToPath(returnTo);
  };
  const currentTeacherTab = (() => {
    const segment = typeof window === "undefined" ? "" : window.location.pathname.split("/").filter(Boolean)[1] ?? "";
    return ({ students: "students", materials: "materials", teach: "teach", exams: "exams", settings: "settings" } as Record<string, TeacherTab>)[segment] ?? "students";
  })();
  useEffect(() => {
    if (!localDataReady) return;
    const restoreFromUrl = () => { restoreAppRoute(); };
    restoreFromUrl();
    window.addEventListener("popstate", restoreFromUrl);
    return () => window.removeEventListener("popstate", restoreFromUrl);
  }, [localDataReady, restoreAppRoute]);
  useEffect(() => {
    if (!activeExamId) return;
    const assignment = assignments.find((item) => item.id === activeExamId);
    if (assignment && assignment.testId !== activeTestId) setActiveTestId(assignment.testId);
  }, [activeExamId, activeTestId, assignments]);

  const navigatePractice = (step: PracticeStep, options: { testId?: string; sections?: number[]; count?: number; replace?: boolean } = {}) => {
    const nextTestId = options.testId ?? selectedPracticeTest?.id ?? selectedPracticeTestId;
    const nextSections = options.sections ?? practiceSections;
    const nextCount = options.count ?? practiceQuestionCount;
    setPracticeStep(step);
    if (options.testId) setSelectedPracticeTestId(options.testId);
    if (options.sections) setPracticeSections(options.sections);
    if (options.count !== undefined) setPracticeQuestionCount(options.count);

    const url = new URL(practicePath(step), window.location.origin);
    if (step !== "home") {
      if (step === "section" || step === "setup") {
        if (nextTestId) url.searchParams.set("test", nextTestId);
        url.searchParams.set("sections", nextSections.join(","));
      }
      if (step === "setup") url.searchParams.set("count", String(Math.min(nextCount, Math.max(1, selectedVocabularyCount || maxPracticeCards))));
    }
    window.history[options.replace ? "replaceState" : "pushState"]({}, "", url);
    setStudentPage("library");
  };
  useEffect(() => {
    if (practiceStep !== "test" || practiceTests.length > 0) return;
    window.history.replaceState({}, "", "/practice");
    setPracticeStep("home");
    setStudentPage("library");
  }, [practiceStep, practiceTests.length]);
  const words = current?.reading.split(/\s+/).filter(Boolean).length ?? 0;
  const minutes = Math.max(1, Math.ceil(words / 180));
  const savePreferences = (next: Preferences) => {
    setPreferences(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
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
    navigateToPath("/library");
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
  const rememberSuccessfulLogin = (code: string) => {
    if (rememberStudent) {
      localStorage.setItem(REMEMBERED_STUDENT_CODE_KEY, code);
      setRememberedStudentCode(code);
    } else {
      localStorage.removeItem(REMEMBERED_STUDENT_CODE_KEY);
      setRememberedStudentCode("");
    }
  };
  const openStudentProfile = async (rawCode: string) => {
    const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length !== 9 || studentLoginLoading) return;
    setStudentLoginLoading(true);
    try {
        const response = await fetch("/api/student-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
        if (response.ok) {
          const joined = await response.json() as { student?: { id?: string } };
          const stateResponse = await fetch("/api/classroom-state", { cache: "no-store" });
          if (!stateResponse.ok) throw new Error("Your profile opened, but shared data could not be loaded. Please try again.");
          const state = await stateResponse.json() as { data?: Record<string, string> };
          if (state.data) applyRemoteClassroom(state.data);
          if (joined.student?.id) { selectStudent(joined.student.id); rememberSuccessfulLogin(code); }
          setCloudStatus("connected");
          setStudentCodeInput("");
          setStudentCodeError("");
          return;
        }
        const result = await response.json() as { error?: string };
        if (response.status === 503 && result.error?.includes("environment variables")) {
          const localStudent = students.find((profile) => profile.joinCode?.toUpperCase() === code);
          if (localStudent) { selectStudent(localStudent.id); rememberSuccessfulLogin(code); setStudentCodeInput(""); setStudentCodeError(""); return; }
        }
        throw new Error(result.error ?? "That code was not found. Check it with your teacher and try again.");
    } catch (error) {
      setStudentCodeError(error instanceof Error ? error.message : "Could not open this student profile.");
    } finally {
      setStudentLoginLoading(false);
    }
  };
  const joinStudentProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void openStudentProfile(studentCodeInput);
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
  const deleteStudent = (studentId: string) => {
    const student = students.find((profile) => profile.id === studentId);
    if (!student || !window.confirm(`Delete ${student.name}'s profile? This also removes their exam assignments, saved reading progress, and flashcard progress. This cannot be undone.`)) return;
    const roster = students.filter((profile) => profile.id !== studentId);
    const remainingAssignments = assignments.filter((assignment) => assignment.studentId !== studentId);
    setStudents(roster);
    setAssignments(remainingAssignments);
    persistSharedClassroomValue(STUDENTS_STORAGE_KEY, JSON.stringify(roster));
    persistSharedClassroomValue(EXAMS_STORAGE_KEY, JSON.stringify(remainingAssignments));
    const progressKey = studentProgressKey(studentId);
    localStorage.removeItem(progressKey);
    persistSharedClassroomValue(progressKey, JSON.stringify(emptyStudentProgress));
    const notesKey = studentNotesKey(studentId);
    localStorage.removeItem(notesKey);
    persistSharedClassroomValue(notesKey, "[]");
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(`libaria-flashcards-${studentId}-`)) {
        localStorage.removeItem(key);
        persistSharedClassroomValue(key, "[]");
      }
    }
    if (selectedStudentId === studentId) {
      localStorage.removeItem(SELECTED_STUDENT_STORAGE_KEY);
      setSelectedStudentId(DEFAULT_STUDENT_ID);
      setReadingNotes([]);
      setProgress(emptyProgress);
      setStudentPage("home");
    }
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
    persistTeacherMaterials(next);
  };
  const publishTeacherTest = (testId: string) => {
    const source = allTests.find((item) => item.id === testId);
    if (!source || source.status === "published") return;
    const published = { ...source, status: "published" as const };
    const nextTests = allTests.map((item) => item.id === testId ? published : item);
    setAllTests(nextTests);
    persistTeacherMaterials(nextTests);
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
    persistTeacherMaterials(nextTests);
  };
  const beginExam = (assignment: ExamAssignment) => {
    const test = allTests.find((item) => item.id === assignment.testId);
    if (!test || !canStudentOpenExam(assignment, selectedStudentId, test, clockNow)) return;
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
    navigateToPath(`/exam/${encodeURIComponent(assignment.id)}`);
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
    navigateToPath(`/reading/${encodeURIComponent(test.id)}`);
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
      <button onClick={() => settingsOpen ? closeSettings() : openSettings()} aria-expanded={settingsOpen} className="inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold transition hover:shadow-sm" style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }}>
        <Settings2 size={17} /> Settings <ChevronDown size={15} />
      </button>
      <AnimatePresence>
      {settingsOpen && <motion.div key="reading-settings" initial={reduceMotion ? false : { opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduceMotion ? undefined : { opacity: 0, y: -5, scale: 0.98 }} transition={{ type: "spring", stiffness: 420, damping: 32 }} className="absolute right-0 top-14 z-20 max-h-[calc(100dvh-6rem)] w-[min(340px,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-2xl border p-5 shadow-xl" style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }}>
        <div className="mb-4 flex items-center justify-between">
          <div><p className="font-extrabold">{teacherMode ? "Display settings" : "Reading settings"}</p><p className="text-xs" style={{ color: theme.muted }}>{teacherMode ? "Choose the look and reading comfort for the app" : "Make the page comfortable for you"}</p></div>
          <button onClick={closeSettings} aria-label="Close settings" className="rounded-full p-2 hover:bg-black/5"><X size={17} /></button>
        </div>
        <div className="space-y-5">
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
          className="sticky top-0 z-30 -mx-4 flex min-h-[64px] items-center justify-between gap-2 border-b px-3 backdrop-blur-2xl sm:-mx-8 sm:min-h-[76px] sm:px-8"
          style={{ borderColor: frameTheme.border, background: frameTheme.page + "e8", pointerEvents: headerVisible || settingsOpen ? "auto" : "none" }}
        >
          <div className="flex items-center gap-3">
            {active || activeTest ? <button onClick={() => { setActive(null); navigateToPath(activeExamId ? "/exams" : "/library"); }} className="inline-flex items-center gap-2 rounded-full p-2 pr-3 text-sm font-bold transition hover:bg-black/5"><ArrowLeft size={18} /><span>Library</span></button> : <button type="button" onClick={() => { setActive(null); setActiveTestId(null); setActiveExamId(null); setPracticeSession(null); navigateToPath("/"); }} className="flex items-center gap-2 text-lg font-black tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: frameTheme.accent, color: frameTheme.ink }}><BookOpen size={19} /></span><span className="hidden min-[380px]:inline">Libraria</span></button>}
            {(active || activeTest) && !preferences.focus && <span className="hidden text-sm sm:inline" style={{ color: frameTheme.muted }}>Libraria <span className="mx-1">/</span>{activeTest?.title ?? current?.title}</span>}
          </div>
          {!teacherMode && <div className="flex items-center gap-2">
            {studentPage !== "home" && <div className="relative">
              <button type="button" aria-expanded={profileOpen} aria-haspopup="menu" onClick={() => profileOpen ? navigateToPath("/library") : navigateToPath("/profile")} className="inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition" style={{ borderColor: frameTheme.border, background: frameTheme.surface, color: frameTheme.ink }}><UserRound size={16} /><span className="max-w-32 truncate">{selectedStudent?.name ?? "My profile"}</span><ChevronDown size={14} /></button>
              <AnimatePresence>{profileOpen && <motion.div role="menu" initial={reduceMotion ? false : { opacity: 0, y: -5, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduceMotion ? undefined : { opacity: 0, y: -4 }} className="absolute right-0 top-14 z-30 w-60 rounded-2xl border p-3 shadow-xl" style={{ borderColor: frameTheme.border, background: frameTheme.surface, color: frameTheme.ink }}><p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: frameTheme.muted }}>Student profile</p><p className="truncate px-2 text-sm font-semibold">{selectedStudent?.name ?? "No student selected"}</p>{selectedStudent?.joinCode && <p className="px-2 pt-1 font-mono text-xs tracking-wider" style={{ color: frameTheme.muted }}>Code · {selectedStudent.joinCode}</p>}<button role="menuitem" type="button" onClick={() => { setProfileOpen(false); setStudentCodeInput(""); setStudentCodeError(""); setActive(null); setActiveTestId(null); setActiveExamId(null); setPracticeSession(null); navigateToPath("/"); }} className="mt-3 min-h-10 w-full rounded-xl border px-3 text-left text-sm font-semibold" style={{ borderColor: frameTheme.border }}>Switch profile / log out</button></motion.div>}</AnimatePresence>
            </div>}
            {Settings}
          </div>}
          {teacherMode && teacherAuthenticated && <div className="flex items-center gap-2">{Settings}</div>}
        </motion.header>

        <AnimatePresence mode="wait" initial={false}>
    {teacherMode ? teacherAuthenticated ? <TeacherDashboard key="teacher-dashboard" students={students} assignments={assignments} tests={allTests} theme={classroomTheme} initialTab={currentTeacherTab} onTabChange={(tab) => navigateToPath(tab === "students" ? "/teacher" : `/teacher/${tab}`)} onAddStudent={addStudent} onDeleteStudent={deleteStudent} onUpdateStudentCode={updateStudentCode} onToggleStudentPhase={toggleStudentPhase} onCreateAssignments={createAssignments} onCreateTest={createTeacherTest} onPublishMaterial={publishTeacherTest} onUnpublishMaterial={unpublishTeacherTest} onUpdateMaterial={(testId, updates) => { const next = allTests.map((item) => item.id === testId ? { ...item, ...updates } : item); setAllTests(next); persistTeacherMaterials(next); }} onGradeAssignment={gradeAssignment} onTeachPointer={publishTeachingPointer} onBack={() => { publishTeachingPointer(null); void signOutTeacher(); }} /> : <TeacherLoginGate theme={classroomTheme} onCancel={() => navigateToPath("/")} onAuthenticated={() => setTeacherAuthenticated(true)} /> : studentPage === "home" ? <StudentHomePage rememberMe={rememberStudent} rememberedName={students.find((profile) => profile.joinCode === rememberedStudentCode)?.name ?? "your profile"} hasRememberedStudent={rememberStudent && rememberedStudentCode.length === 9} openingProfile={studentLoginLoading} theme={theme} code={studentCodeInput} error={studentCodeError} onCodeChange={(value) => { setStudentCodeInput(value); setStudentCodeError(""); }} onRememberChange={(value) => { setRememberStudent(value); localStorage.setItem("libaria-remember-student", String(value)); if (!value) { localStorage.removeItem(REMEMBERED_STUDENT_CODE_KEY); setRememberedStudentCode(""); setStudentCodeInput(""); } }} onSubmit={joinStudentProfile} onResumeRemembered={() => { setStudentCodeError(""); void openStudentProfile(rememberedStudentCode); }} onTeacherLogin={() => navigateToPath("/teacher")} /> : practiceSession ? <FlashcardPracticeView cards={practiceSession} theme={theme} onClose={() => { setPracticeSession(null); navigatePractice("home"); }} /> : activeTest ? <ReadingTestView key={activeTest.id + (activeExamId ?? "")} test={activeTest} theme={theme} preferences={preferences} exam={activeExam} studentId={selectedStudentId} draft={activeExam ? undefined : progress.testDrafts[activeTest.id]} notes={readingNotes} teacherPointer={teachingPointer} onDraftChange={persistTestDraft} onAddNote={addReadingNote} onUpdateNote={updateReadingNote} onBack={() => { navigateToPath(activeExamId ? "/exams" : "/library"); }} onComplete={(score, answers) => completeTest(activeTest, score, answers)} /> : studentPage === "exams" ? <StudentExamsPage assignments={assignments} tests={allTests} studentId={selectedStudentId} theme={theme} now={clockNow} onOpenExam={beginExam} onBackToLibrary={() => navigateToPath("/library")} /> : active && current ? <motion.main key={"read-" + currentKey} initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -8 }} transition={{ type: "spring", stiffness: 280, damping: 30 }} className="mx-auto pb-16 pt-10" style={{ maxWidth: preferences.width === "narrow" ? 740 : 920 }}>
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
              {practiceStep === "home" ? <>{practiceTests.length > 0 && <motion.button data-tactile="card" key="practice-home" type="button" onClick={() => navigatePractice("test")} initial={reduceMotion ? false : { opacity: 0, y: 8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduceMotion ? undefined : { opacity: 0, scale: .98 }} whileHover={reduceMotion ? undefined : preferences.shadowMode === "hard-offset" ? { x: -3, y: -3 } : { y: -3 }} whileTap={reduceMotion ? undefined : preferences.shadowMode === "hard-offset" ? { x: 3, y: 3, scale: .99 } : { scale: .985 }} transition={{ type: "spring", stiffness: 320, damping: 26 }} className="group flex min-h-24 w-full items-center justify-between rounded-2xl px-6 py-5 text-left sm:min-h-28 sm:px-9" style={{ background: theme.accent, color: theme.onAccent }}><span><span className="block font-serif text-2xl font-semibold tracking-tight sm:text-3xl">Practice</span><span className="mt-1 block text-xs opacity-80 sm:text-sm">Read at your own pace</span></span><span className="grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-white/10 transition-transform duration-300 group-hover:translate-x-1"><ArrowRight size={20} /></span></motion.button>}<motion.button data-tactile="card" key="timed-exam-home" type="button" onClick={() => navigateToPath("/exams")} initial={reduceMotion ? false : { opacity: 0, y: 8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} whileHover={reduceMotion ? undefined : preferences.shadowMode === "hard-offset" ? { x: -3, y: -3 } : { y: -3 }} whileTap={reduceMotion ? undefined : preferences.shadowMode === "hard-offset" ? { x: 3, y: 3, scale: .99 } : { scale: .985 }} transition={{ type: "spring", stiffness: 320, damping: 26 }} className="group flex min-h-24 w-full items-center justify-between rounded-2xl border px-6 py-5 text-left sm:min-h-28 sm:px-9" style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }}><span><span className="block font-serif text-2xl font-semibold tracking-tight sm:text-3xl">Timed Exam</span><span className="mt-1 block text-xs sm:text-sm" style={{ color: theme.muted }}>Open your assigned exams</span></span><span className="grid h-11 w-11 place-items-center rounded-full border transition-transform duration-300 group-hover:translate-x-1" style={{ borderColor: theme.border, color: theme.accent }}><CalendarClock size={19} /></span></motion.button></> : practiceStep === "test" ? <motion.div key="choose-test" initial={reduceMotion ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? undefined : { opacity: 0, x: -8 }} transition={{ duration: .2 }}>
                <button type="button" onClick={() => navigatePractice("home")} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: theme.muted }}><ArrowLeft size={15} />Practice home</button><h2 id="practice-title" className="font-serif text-3xl font-semibold">Choose a test</h2><p className="mt-2 text-sm" style={{ color: theme.muted }}>Choose the reading set you want to review.</p>
                <div className="mt-5 grid gap-2.5 sm:grid-cols-2">{practiceTests.map((test, index) => { const selected = selectedPracticeTest?.id === test.id; const progressWidth = Math.min(100, Math.round((progress.testDrafts[test.id] ? Object.keys(progress.testDrafts[test.id].answers).length / Math.max(1, test.questions.length) : 0) * 100)); return <motion.button key={test.id} type="button" onClick={() => navigatePractice("section", { testId: test.id, sections: [1] })} whileHover={!reduceMotion ? { y: -2 } : undefined} whileTap={!reduceMotion ? { scale: .99 } : undefined} className="relative flex min-h-24 items-center gap-3 rounded-xl border p-3.5 text-left transition" style={{ borderColor: selected ? theme.accent : theme.border, background: selected ? theme.accent + "0b" : theme.surface, boxShadow: selected ? `0 0 0 1px ${theme.accent}22` : undefined }}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[11px] font-bold" style={{ background: selected ? theme.accent : theme.page, color: selected ? theme.surface : theme.muted }}>{String(index + 1).padStart(2, "0")}</span><span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-[.14em]" style={{ color: selected ? theme.accent : theme.muted }}>{selected ? "Selected" : "Available"}</span><span className="mt-0.5 block truncate text-sm font-semibold">{test.title}</span><span className="mt-0.5 block truncate text-[11px]" style={{ color: theme.muted }}>{test.topic}</span><span className="mt-2 block h-0.5 overflow-hidden rounded-full" style={{ background: theme.border }}><span className="block h-full rounded-full" style={{ width: `${progressWidth}%`, background: theme.accent }} /></span></span><ArrowRight size={16} style={{ color: selected ? theme.accent : theme.muted }} /></motion.button>; })}</div>
              </motion.div> : practiceStep === "section" ? <motion.div key="choose-section" initial={reduceMotion ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? undefined : { opacity: 0, x: -8 }} transition={{ duration: .2 }}>
                <button type="button" onClick={() => navigatePractice("test")} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: theme.muted }}><ArrowLeft size={15} />Choose another test</button><p className="text-xs font-bold uppercase tracking-[.15em]" style={{ color: theme.accent }}>{selectedPracticeTest?.title}</p><h2 id="practice-title" className="mt-2 font-serif text-3xl font-semibold">Choose a section</h2><p className="mt-2 text-sm" style={{ color: theme.muted }}>Pick a skill to practice. Reading is ready now.</p>
                <div className="mt-5 grid gap-2 sm:grid-cols-3">{readingVocabularyDecks.map((deck) => { const selected = practiceSections.includes(deck.section); return <button key={deck.section} type="button" aria-pressed={selected} onClick={() => { const nextSections = selected ? practiceSections.filter((section) => section !== deck.section) : [...practiceSections, deck.section].sort((a, b) => a - b); const nextTotal = readingVocabularyDecks.filter((item) => nextSections.includes(item.section)).reduce((total, item) => total + item.cards.length, 0); const nextCount = Math.min(practiceQuestionCount, Math.max(1, nextTotal)); navigatePractice("section", { sections: nextSections, count: nextCount, replace: true }); }} className="rounded-xl border p-4 text-left transition" style={{ borderColor: selected ? theme.accent : theme.border, background: selected ? theme.accent + "0b" : theme.surface }}><span className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[.12em]" style={{ color: selected ? theme.accent : theme.muted }}>Section {deck.section}</span><span className="grid h-5 w-5 place-items-center rounded-full border" style={{ borderColor: selected ? theme.accent : theme.border, background: selected ? theme.accent : "transparent", color: theme.surface }}>{selected && <Check size={12} />}</span></span><span className="mt-2 block text-sm font-semibold leading-snug">{deck.title}</span><span className="mt-1 block text-[11px]" style={{ color: theme.muted }}>{deck.cards.length} study cards</span></button>; })}</div>
                <div className="mt-5 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center"><p className="text-xs" style={{ color: theme.muted }}>{practiceSections.length} of {readingVocabularyDecks.length} sections selected</p><button type="button" disabled={practiceSections.length === 0} onClick={() => navigatePractice("setup", { count: Math.min(practiceQuestionCount, maxPracticeCards) })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-40" style={{ background: theme.accent, color: theme.onAccent }}>Choose card count <ArrowRight size={15} /></button></div>
              </motion.div> : <motion.div key="deck-setup" initial={reduceMotion ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? undefined : { opacity: 0, x: -8 }} transition={{ duration: .2 }}>
                <button type="button" onClick={() => navigatePractice("section")} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: theme.muted }}><ArrowLeft size={15} />Choose section</button><p className="text-xs font-bold uppercase tracking-[.15em]" style={{ color: theme.accent }}>Reading · {selectedPracticeTest?.title}</p><h2 id="practice-title" className="mt-2 font-serif text-3xl font-semibold">Set up your deck</h2><p className="mt-2 text-sm" style={{ color: theme.muted }}>Choose how many cards you want to review.</p>
                <div className="mt-6 rounded-2xl border p-5 sm:p-6" style={{ borderColor: theme.border, background: theme.page }}><div className="flex items-center justify-between gap-3"><div><p className="font-semibold">Maximum cards</p><p className="mt-1 text-xs" style={{ color: theme.muted }}>From your selected sections</p></div><motion.span key={practiceQuestionCount} initial={reduceMotion ? false : { opacity: .6, y: 3 }} animate={{ opacity: 1, y: 0 }} className="text-lg font-bold tabular-nums" style={{ color: theme.accent }}>{practiceQuestionCount}</motion.span></div><input aria-label="Maximum number of flashcards" type="range" min="1" max={maxPracticeCards} step="1" value={Math.min(practiceQuestionCount, maxPracticeCards)} onChange={(event) => navigatePractice("setup", { count: Number(event.target.value), replace: true })} className="mt-5 h-8 w-full cursor-pointer" style={{ accentColor: theme.accent }} /><div className="flex justify-between text-xs" style={{ color: theme.muted }}><span>1 card</span><span>{maxPracticeCards} max</span></div></div>
                <div className="mt-5 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center"><p className="text-xs" style={{ color: theme.muted }}>{selectedVocabularyCount} cards across {practiceSections.length} selected sections · about {Math.max(1, Math.round(practiceQuestionCount * .4))} minutes</p><button type="button" disabled={!selectedPracticeTest || practiceSections.length === 0} onClick={() => { if (!selectedPracticeTest) return; setPracticeSession(buildPracticeCards(practiceSections, practiceQuestionCount)); navigateToPath(`/flashcards?test=${encodeURIComponent(selectedPracticeTest.id)}&sections=${practiceSections.join(",")}&count=${practiceQuestionCount}`); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40" style={{ background: theme.accent, color: theme.onAccent }}>Start flashcards <ArrowRight size={15} /></button></div>
              </motion.div>}
            </>
          </section>
          {practiceStep === "home" && importantExamRows.length > 0 && <section aria-labelledby="important-exams-title" className="mb-10"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}>Your next steps</p><h2 id="important-exams-title" className="mt-1 font-serif text-2xl font-semibold">Important exams</h2></div><button type="button" onClick={() => navigateToPath("/exams")} className="inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold" style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }}>All exams <ArrowRight size={14} /></button></div><div className="grid gap-3 md:grid-cols-2">{importantExamRows.map(({ assignment, test, startsAt, endsAt }) => { const graded = Boolean(assignment.gradedAt); const available = clockNow >= startsAt; const inProgress = Boolean(assignment.startedAt); const label = graded ? "Graded · Ready to review" : inProgress ? "In progress" : available ? "Ready to start" : "Upcoming"; const statusColor = graded ? (theme.dark ? "#9bd5a6" : "#27734a") : available ? theme.accent : theme.muted; return <article key={assignment.id} className="flex flex-col justify-between gap-4 rounded-2xl border p-4 sm:p-5" style={{ borderColor: graded ? statusColor + "66" : theme.border, background: theme.surface }}><div><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ background: statusColor + "18", color: statusColor }}>{label}</span><span className="text-xs" style={{ color: theme.muted }}>{assignment.durationMinutes} min</span></div><h3 className="mt-3 font-serif text-xl font-semibold">{test.title}</h3><p className="mt-1 text-sm" style={{ color: theme.muted }}>{graded ? `Score · ${assignment.score ?? 0}/${test.questions.length} points` : `${test.topic} · ${available ? `Due ${new Date(endsAt).toLocaleString()}` : `Opens ${new Date(startsAt).toLocaleString()}`}`}</p>{graded && assignment.teacherFeedback && <p className="mt-2 line-clamp-2 text-sm" style={{ color: theme.muted }}>{assignment.teacherFeedback}</p>}</div><button type="button" onClick={() => graded ? beginExam(assignment) : available ? beginExam(assignment) : navigateToPath("/exams")} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-bold sm:w-auto sm:self-start" style={{ background: available || graded ? theme.accent : theme.page, color: available || graded ? theme.onAccent : theme.ink }}>{graded ? "Review answers" : inProgress ? "Resume exam" : available ? "Start exam" : "View exam details"}<ArrowRight size={15} /></button></article>; })}</div></section>}
            {practiceStep === "home" && <section aria-label="Learning phases" className="mb-10"><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}>Your learning path</p><h2 className="mt-1 font-serif text-2xl font-semibold">Choose a phase</h2></div><span className="text-xs font-medium" style={{ color: theme.muted }}>{unlockedPhases.length} of 4 open for {selectedStudent?.name ?? "student"}</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{([1, 2, 3, 4] as const).map((phase) => { const unlocked = unlockedPhases.includes(phase); const selected = activePhase === phase; return <motion.button data-tactile="control" key={phase} type="button" disabled={!unlocked} onClick={() => setActivePhase(phase)} aria-current={selected ? "step" : undefined} whileHover={unlocked && !reduceMotion ? preferences.shadowMode === "hard-offset" ? { x: -3, y: -3 } : { y: -2 } : undefined} whileTap={unlocked && !reduceMotion ? preferences.shadowMode === "hard-offset" ? { x: 3, y: 3 } : { scale: 0.98 } : undefined} transition={{ type: "spring", stiffness: 420, damping: 30 }} className="flex min-h-16 items-center justify-between rounded-2xl border px-4 py-3 text-left font-semibold disabled:cursor-not-allowed disabled:opacity-35" style={{ borderColor: selected ? theme.accent : theme.border, background: selected ? theme.accent : theme.surface, color: selected ? theme.surface : unlocked ? theme.ink : theme.muted, boxShadow: selected ? "0 8px 24px " + theme.accent + "28" : undefined }}><span><span className="block text-xs opacity-75">{unlocked ? selected ? "Open now" : "Available" : "Locked"}</span><span className="mt-0.5 block">Phase {phase}</span></span>{selected ? <Check size={18} /> : unlocked ? <span className="h-4 w-4 rounded-full border" style={{ borderColor: theme.border }} /> : <LockKeyhole size={15} />}</motion.button>; })}</div></section>}
          {practiceStep === "home" && <ExamHistoryPreview rows={pastExams} theme={theme} onViewAll={() => navigateToPath("/exams")} />}
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




