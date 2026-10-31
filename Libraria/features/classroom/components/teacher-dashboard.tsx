"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowLeft, BookOpen, CalendarClock, Check, Clock3, Copy, Eye, LockKeyhole, Plus, Presentation, Search, Settings2, StickyNote, Trash2, Users, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { getReadingParagraphs, type ReadingFlashcard, type ReadingQuestion, type ReadingTest } from "@/features/reading/data/reading-tests";
import { IELTSTestWizard } from "@/features/reading/components/test-builder";
import { studentProgressKey, createLocalId, emptyStudentProgress, type ExamAssignment, type StudentProfile, type StudentProgress, type TeachingPointer } from "@/features/classroom/data-model";
import { readingVocabularyDecks } from "@/features/reading/data/vocabulary-decks";

type Theme = { page: string; surface: string; ink: string; muted: string; border: string; accent: string; onAccent: string };
type TeacherSettings = { classroomName: string; defaultMaterialPhase: 1 | 2 | 3 | 4; defaultExamMinutes: number; defaultMaterialVisibility: "all" | "students" | "groups" };
const TEACHER_SETTINGS_KEY = "libaria-teacher-settings";
const DEFAULT_TEACHER_SETTINGS: TeacherSettings = { classroomName: "My classroom", defaultMaterialPhase: 1, defaultExamMinutes: 30, defaultMaterialVisibility: "all" };

export function TeacherDashboard({
  students,
  assignments,
  tests,
  theme,
  onAddStudent,
  onDeleteStudent,
  onUpdateStudentCode,
  onToggleStudentPhase,
  onCreateAssignments,
  onCreateTest,
  onPublishMaterial,
  onUnpublishMaterial,
  onUpdateMaterial,
  onGradeAssignment,
  onTeachPointer,
  onBack,
  initialTab = "students",
  onTabChange,
}: {
  students: StudentProfile[];
  assignments: ExamAssignment[];
  tests: ReadingTest[];
  theme: Theme;
  onAddStudent: (name: string) => StudentProfile;
  onDeleteStudent: (studentId: string) => void;
  onUpdateStudentCode: (studentId: string, code: string) => boolean;
  onToggleStudentPhase: (studentId: string, phase: number) => void;
  onCreateAssignments: (assignments: ExamAssignment[]) => void;
  onCreateTest: (test: ReadingTest) => void;
  onPublishMaterial: (testId: string) => void;
  onUnpublishMaterial: (testId: string) => void;
  onUpdateMaterial: (testId: string, updates: Partial<Pick<ReadingTest, "visibility" | "studentIds" | "groupNames">>) => void;
  onGradeAssignment: (assignmentId: string, questionPoints: Record<number, number>, feedback?: string) => void;
  onTeachPointer: (pointer: TeachingPointer | null) => void;
  onBack: () => void;
  initialTab?: "students" | "materials" | "teach" | "exams" | "settings";
  onTabChange?: (tab: "students" | "materials" | "teach" | "exams" | "settings") => void;
}) {
  const reduceMotion = useReducedMotion();
  const [newName, setNewName] = useState("");
  const [activeTab, setActiveTab] = useState(initialTab);
  const [examFilter, setExamFilter] = useState<"all" | "not-done" | "needs-review" | "graded">("all");
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [examNotice, setExamNotice] = useState("");
  const [teacherSettings, setTeacherSettings] = useState<TeacherSettings>(DEFAULT_TEACHER_SETTINGS);
  const [settingsNotice, setSettingsNotice] = useState("");
  const [studentNotice, setStudentNotice] = useState("");
  const [studentCodeDrafts, setStudentCodeDrafts] = useState<Record<string, string>>({});
  const [draftNotice, setDraftNotice] = useState("");
  const [publishNotice, setPublishNotice] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>(students[0]?.id ? [students[0].id] : []);
  const [studentSearch, setStudentSearch] = useState("");
  const [assignmentSuccess, setAssignmentSuccess] = useState("");
  const [selectedTest, setSelectedTest] = useState(tests[0]?.id ?? "");
  const [startsAt, setStartsAt] = useState("");
  const [duration, setDuration] = useState(30);
  const [materialPhase, setMaterialPhase] = useState<1 | 2 | 3 | 4>(1);
  const [materialKind, setMaterialKind] = useState<"reading" | "vocabulary" | "quiz" | "exam">("reading");
  const [examDuration, setExamDuration] = useState(30);
  const [materialVisibility, setMaterialVisibility] = useState<"all" | "students" | "groups">("all");
  const [materialStudentIds, setMaterialStudentIds] = useState<string[]>([]);
  const [materialGroupNames, setMaterialGroupNames] = useState<string[]>([]);
  const [materialSearch, setMaterialSearch] = useState("");
  const [visibilityDraft, setVisibilityDraft] = useState<{ testId: string; visibility: "all" | "students" | "groups"; studentIds: string[]; groupNames: string[] } | null>(null);
  const [showTestBuilder, setShowTestBuilder] = useState(false);
  const [showIELTSBuilder, setShowIELTSBuilder] = useState(false);

  useEffect(() => { setActiveTab(initialTab); }, [initialTab]);
  const [testTitle, setTestTitle] = useState("");
  const [testTopic, setTestTopic] = useState("");
  const [testMinutes, setTestMinutes] = useState(8);
  const [testPassage, setTestPassage] = useState("");
  const [draftQuestions, setDraftQuestions] = useState<Array<{ prompt: string; options: string[]; answer: number; explanation: string }>>([{ prompt: "", options: ["", "", "", ""], answer: 0, explanation: "" }]);
  const [draftFlashcards, setDraftFlashcards] = useState<ReadingFlashcard[]>([]);
  const [progressByStudent, setProgressByStudent] = useState<Record<string, StudentProgress>>({});
  const [flashcardProgress, setFlashcardProgress] = useState<Record<string, Record<string, string[]>>>({});
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [reviewingAssignmentId, setReviewingAssignmentId] = useState<string | null>(null);
  const [selectedExamTestId, setSelectedExamTestId] = useState<string | null>(null);
  const [examDetailTab, setExamDetailTab] = useState<"students" | "content" | "review">("students");
  const [draftPoints, setDraftPoints] = useState<Record<number, number>>({});
  const [draftFeedback, setDraftFeedback] = useState("");
  const [selectedTeachTestId, setSelectedTeachTestId] = useState("");
  const [selectedTeachSection, setSelectedTeachSection] = useState(1);
  const lastTeachPointerAt = useRef(0);
  const groupNames = Array.from(new Set(students.map((student) => student.groupName?.trim()).filter((name): name is string => Boolean(name)))).sort((a, b) => a.localeCompare(b));
  const teachableTests = tests.filter((test) => test.kind !== "exam" && test.kind !== "quiz" && test.kind !== "vocabulary" && !test.timedExam);
  const selectedTeachingTest = teachableTests.find((test) => test.id === selectedTeachTestId) ?? teachableTests[0] ?? null;
  const teachingPassages = selectedTeachingTest?.passages?.length ? selectedTeachingTest.passages : selectedTeachingTest ? [{ title: "Reading passage", text: selectedTeachingTest.passage }] : [];
  const teachingSections = teachingPassages.map((passage, index) => ({ passage, section: passage.section ?? index + 1 }));
  const selectedTeachingSection = teachingSections.find((item) => item.section === selectedTeachSection) ?? teachingSections[0] ?? null;
  const sectionVocabulary = selectedTeachingTest?.flashcards?.length ? selectedTeachingTest.flashcards : readingVocabularyDecks.find((deck) => deck.title.trim().toLocaleLowerCase() === selectedTeachingSection?.passage.title.trim().toLocaleLowerCase())?.cards ?? (selectedTeachingTest?.id === "ielts-reading-test-1" ? readingVocabularyDecks.find((deck) => deck.section === selectedTeachingSection?.section)?.cards ?? [] : []);
  const materialAudienceIds = students.filter((student) => materialVisibility === "all" || materialVisibility === "students" && materialStudentIds.includes(student.id) || materialVisibility === "groups" && Boolean(student.groupName && materialGroupNames.includes(student.groupName))).map((student) => student.id);
  const getAudienceIds = (test: ReadingTest) => students.filter((student) => {
    if (test.visibility === "all") return true;
    if (test.visibility === "groups") return Boolean(student.groupName && test.groupNames?.includes(student.groupName));
    if (test.visibility === "students") return Boolean(test.studentIds?.includes(student.id));
    return !test.studentId || test.studentId === student.id;
  }).map((student) => student.id);

  const publishPointerFromPassage = (event: ReactPointerEvent<HTMLDivElement>, paragraphIndex: number) => {
    const now = Date.now();
    if (now - lastTeachPointerAt.current < 75 || !selectedTeachingTest || !selectedTeachingSection) return;
    lastTeachPointerAt.current = now;
    const rect = event.currentTarget.getBoundingClientRect();
    onTeachPointer({ testId: selectedTeachingTest.id, section: selectedTeachingSection.section, paragraphIndex, x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / Math.max(1, rect.width)) * 100)), y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / Math.max(1, rect.height)) * 100)), teacherName: "Teacher", updatedAt: now });
  };

  useEffect(() => {
    if (!students.length) return;
    const next: Record<string, StudentProgress> = {};
    for (const student of students) {
      try {
        const raw = localStorage.getItem(studentProgressKey(student.id));
        next[student.id] = raw ? { ...emptyStudentProgress, ...JSON.parse(raw) } : emptyStudentProgress;
      } catch {
        next[student.id] = emptyStudentProgress;
      }
    }
    setProgressByStudent(next);
    const flashcards: Record<string, Record<string, string[]>> = {};
    for (const student of students) {
      flashcards[student.id] = {};
      for (const test of tests) {
        if (!test.flashcards?.length) continue;
        try {
          const saved = JSON.parse(localStorage.getItem("libaria-flashcards-" + student.id + "-" + test.id) ?? "[]");
          flashcards[student.id][test.id] = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
        } catch {
          flashcards[student.id][test.id] = [];
        }
      }
    }
    setFlashcardProgress(flashcards);
    const validSelection = selectedStudents.filter((id) => students.some((student) => student.id === id));
    if (!validSelection.length && students.length) setSelectedStudents([students[0].id]);
    else if (validSelection.length !== selectedStudents.length) setSelectedStudents(validSelection);
  }, [students, selectedStudents, tests]);

  useEffect(() => {
    const updateStudentActivity = (key: string) => {
      const progressStudent = students.find((student) => key === studentProgressKey(student.id));
      if (progressStudent) {
        try {
          const raw = localStorage.getItem(key);
          setProgressByStudent((current) => ({ ...current, [progressStudent.id]: raw ? { ...emptyStudentProgress, ...JSON.parse(raw) } : emptyStudentProgress }));
        } catch { setProgressByStudent((current) => ({ ...current, [progressStudent.id]: emptyStudentProgress })); }
        return;
      }
      const flashcardPrefix = "libaria-flashcards-";
      if (!key.startsWith(flashcardPrefix)) return;
      const cardOwner = students.find((student) => tests.some((test) => key === flashcardPrefix + student.id + "-" + test.id));
      const cardTest = cardOwner && tests.find((test) => key === flashcardPrefix + cardOwner.id + "-" + test.id);
      if (!cardOwner || !cardTest) return;
      try {
        const raw = localStorage.getItem(key);
        const cards = raw ? JSON.parse(raw) : [];
        setFlashcardProgress((current) => ({ ...current, [cardOwner.id]: { ...current[cardOwner.id], [cardTest.id]: Array.isArray(cards) ? cards.filter((id): id is string => typeof id === "string") : [] } }));
      } catch { /* A malformed saved list should not break the teacher dashboard. */ }
    };
    const onStorage = (event: StorageEvent) => { if (event.key) updateStudentActivity(event.key); };
    const onSharedWrite = (event: Event) => {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key;
      if (key) updateStudentActivity(key);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("libaria:shared-classroom-write", onSharedWrite);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("libaria:shared-classroom-write", onSharedWrite); };
  }, [students, tests]);

  const canStudentSeeTest = (test: ReadingTest, studentId: string) => {
    const student = students.find((item) => item.id === studentId);
    if (test.visibility === "all") return true;
    if (test.visibility === "groups") return Boolean(student?.groupName && test.groupNames?.includes(student.groupName));
    if (test.visibility === "students") return Boolean(test.studentIds?.includes(studentId));
    return !test.studentId || test.studentId === studentId;
  };
  const assignableTests = selectedStudents.length ? tests.filter((test) => test.status !== "draft" && selectedStudents.every((id) => canStudentSeeTest(test, id))) : [];
  const reviewingAssignment = assignments.find((assignment) => assignment.id === reviewingAssignmentId);
  const reviewingTest = tests.find((test) => test.id === reviewingAssignment?.testId);
  const examTests = tests.filter((test) => assignments.some((assignment) => assignment.testId === test.id));
  const filteredExamTests = examTests.filter((test) => {
    const rows = assignments.filter((assignment) => assignment.testId === test.id);
    if (examFilter === "not-done") return rows.some((assignment) => !assignment.completedAt);
    if (examFilter === "needs-review") return rows.some((assignment) => assignment.completedAt && !assignment.gradedAt);
    if (examFilter === "graded") return rows.some((assignment) => assignment.gradedAt);
    return true;
  });
  const selectedExamTest = tests.find((test) => test.id === selectedExamTestId);
  const selectedExamAssignments = assignments.filter((assignment) => assignment.testId === selectedExamTestId).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const startReview = (assignment: ExamAssignment) => {
    setReviewingAssignmentId(assignment.id);
    setDraftPoints(assignment.questionPoints ?? {});
    setDraftFeedback(assignment.teacherFeedback ?? "");
    setSelectedExamTestId(assignment.testId);
    setExamDetailTab("review");
  };
  const saveGrade = () => {
    if (!reviewingAssignment || !reviewingTest || Object.keys(draftPoints).length !== reviewingTest.questions.length) return;
    onGradeAssignment(reviewingAssignment.id, draftPoints, draftFeedback.trim());
    setReviewingAssignmentId(null);
    setSelectedExamTestId(null);
    setExamDetailTab("students");
    setActiveTab("exams");
    setExamFilter("graded");
    setExamNotice(`Grade published for ${students.find((student) => student.id === reviewingAssignment.studentId)?.name ?? "student"}.`);
  };

  useEffect(() => {
    if (assignableTests.length && !assignableTests.some((test) => test.id === selectedTest)) setSelectedTest(assignableTests[0].id);
  }, [assignableTests, selectedTest]);

  const addStudent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (students.some((student) => student.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) { setStudentNotice("A student with this name already exists."); return; }
    try { const student = onAddStudent(name); setSelectedStudents((current) => current.includes(student.id) ? current : [...current, student.id]); setNewName(""); setStudentNotice(`${student.name} added · student code ${student.joinCode}. Share this code so they can open their profile.`); } catch { setStudentNotice("Could not save student. Please try again."); }
  };

  const createAssignment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!students.length || !selectedStudents.length || !selectedTest) return;
    const scheduledDate = startsAt ? new Date(startsAt) : new Date();
    if (Number.isNaN(scheduledDate.getTime())) return;
    onCreateAssignments(selectedStudents.map((studentId) => ({ id: createLocalId(), studentId, testId: selectedTest, startsAt: scheduledDate.toISOString(), durationMinutes: duration })));
    setStartsAt("");
    setAssignmentSuccess(`Exam assigned to ${selectedStudents.length} ${selectedStudents.length === 1 ? "student" : "students"}.`);
    setExamNotice(`Exam assigned to ${selectedStudents.length} ${selectedStudents.length === 1 ? "student" : "students"}.`);
    setShowAssignmentForm(false);
  };

  const createTest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const questions: ReadingQuestion[] = draftQuestions.map((question) => ({
      prompt: question.prompt.trim(),
      options: [question.options[0].trim(), question.options[1].trim(), question.options[2].trim(), question.options[3].trim()] as [string, string, string, string],
      answer: question.answer,
      explanation: question.explanation.trim() || "Review the passage to find evidence for this answer.",
    }));
    const testId = "custom-" + createLocalId();
    onCreateTest({
      id: testId,
      status: "draft",
      title: testTitle.trim(),
      topic: testTopic.trim() || "Reading comprehension",
      minutes: materialKind === "exam" ? examDuration : testMinutes,
      passage: testPassage.trim(),
      questions,
      flashcards: draftFlashcards.filter((card) => card.term.trim() && card.meaning.trim()).map((card) => ({ ...card, term: card.term.trim(), meaning: card.meaning.trim(), example: card.example?.trim() || undefined })),
      phase: materialPhase,
      kind: materialKind,
      visibility: materialVisibility,
      studentIds: materialVisibility === "students" ? materialStudentIds : undefined,
      groupNames: materialVisibility === "groups" ? materialGroupNames : undefined,
    });
    setTestTitle("");
    setTestTopic("");
    setTestMinutes(8);
    setTestPassage("");
    setDraftQuestions([{ prompt: "", options: ["", "", "", ""], answer: 0, explanation: "" }]);
    setDraftFlashcards([]);
    setMaterialKind("reading");
    setExamDuration(teacherSettings.defaultExamMinutes);
    setMaterialVisibility(teacherSettings.defaultMaterialVisibility);
    setMaterialStudentIds([]);
    setMaterialGroupNames([]);
    setShowTestBuilder(false);
    setDraftNotice("Draft saved on this device. It is hidden from students until you publish it.");
  };

  const editVisibility = (test: ReadingTest) => setVisibilityDraft({
    testId: test.id,
    visibility: test.visibility ?? (test.studentId ? "students" : "all"),
    studentIds: test.studentIds ?? (test.studentId ? [test.studentId] : []),
    groupNames: test.groupNames ?? [],
  });
  const saveVisibility = () => {
    if (!visibilityDraft) return;
    onUpdateMaterial(visibilityDraft.testId, {
      visibility: visibilityDraft.visibility,
      studentIds: visibilityDraft.visibility === "students" ? visibilityDraft.studentIds : undefined,
      groupNames: visibilityDraft.visibility === "groups" ? visibilityDraft.groupNames : undefined,
    });
    setVisibilityDraft(null);
  };

  const updateQuestion = (questionIndex: number, update: Partial<(typeof draftQuestions)[number]>) => {
    setDraftQuestions((current) => current.map((question, index) => index === questionIndex ? { ...question, ...update } : question));
  };
  const canCreateTest = testTitle.trim() && testPassage.trim() && draftQuestions.every((question) => question.prompt.trim() && question.options.every((option) => option.trim()));

  const cardStyle = { borderColor: theme.border, background: theme.surface };
  const inputStyle = { borderColor: theme.border, background: theme.page, color: theme.ink };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TEACHER_SETTINGS_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<TeacherSettings>;
      const next = { ...DEFAULT_TEACHER_SETTINGS, ...parsed };
      setTeacherSettings(next);
      setMaterialPhase(next.defaultMaterialPhase);
      setMaterialVisibility(next.defaultMaterialVisibility);
      setDuration(next.defaultExamMinutes);
      setExamDuration(next.defaultExamMinutes);
    } catch {
      setSettingsNotice("Saved settings could not be read. You can set them again here.");
    }
  }, []);

  const saveTeacherSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = { ...teacherSettings, classroomName: teacherSettings.classroomName.trim() || DEFAULT_TEACHER_SETTINGS.classroomName };
    try {
      localStorage.setItem(TEACHER_SETTINGS_KEY, JSON.stringify(next));
      setTeacherSettings(next);
      setMaterialPhase(next.defaultMaterialPhase);
      setMaterialVisibility(next.defaultMaterialVisibility);
      setDuration(next.defaultExamMinutes);
      setExamDuration(next.defaultExamMinutes);
      setSettingsNotice("Teacher settings saved on this device.");
    } catch {
      setSettingsNotice("Could not save settings in this browser. Check available storage and try again.");
    }
  };

  return (
    <motion.main
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 280, damping: 30 }}
      className="mx-auto w-full max-w-6xl space-y-8 pb-16 pt-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[.18em]" style={{ color: theme.accent }}>Teacher workspace</p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Classroom</h1>
          <p className="mt-3 max-w-2xl leading-7" style={{ color: theme.muted }}>Manage {teacherSettings.classroomName}, assign individual reading exams, and review completed work.</p>
        </div>
        <button onClick={onBack} className="inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition hover:shadow-sm" style={{ borderColor: theme.border, background: theme.surface }}><ArrowLeft size={16} />Student view</button>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-2xl border p-1.5 sm:grid-cols-5" style={{ borderColor: theme.border, background: theme.page }} role="tablist" aria-label="Teacher workspace">
        {([{ id: "students", label: "Students", count: students.length }, { id: "materials", label: "Materials", count: tests.length }, { id: "teach", label: "Teach", count: teachableTests.length }, { id: "exams", label: "Exams & review", count: assignments.length }, { id: "settings", label: "Settings" }] as const).map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => { setActiveTab(tab.id); onTabChange?.(tab.id); }} className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors" style={{ background: activeTab === tab.id ? theme.surface : "transparent", color: activeTab === tab.id ? theme.accent : theme.muted }}>{tab.id === "settings" && <Settings2 size={15} />}{tab.id === "teach" && <Presentation size={15} />}{tab.label}{"count" in tab && <span className="text-xs opacity-75">{tab.count}</span>}</button>)}
      </div>
      {activeTab === "teach" && <section className="rounded-3xl border p-5 sm:p-7" style={cardStyle}>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}>Live reading lesson</p><h2 className="mt-1 font-serif text-2xl font-semibold">Teach a passage</h2><p className="mt-1 max-w-2xl text-sm leading-6" style={{ color: theme.muted }}>Choose a reading test and section. Move your cursor over the passage to point it out to students viewing that section.</p></div><button type="button" onClick={() => onTeachPointer(null)} className="rounded-full border px-3 py-2 text-xs font-semibold" style={{ borderColor: theme.border, color: theme.ink }}>Stop sharing cursor</button></div>
        {teachableTests.length === 0 ? <p className="rounded-xl border p-4 text-sm" style={{ borderColor: theme.border, color: theme.muted }}>Create a reading test to start a lesson.</p> : <>
          <div className="grid gap-2 sm:grid-cols-2">{teachableTests.map((test) => { const selected = selectedTeachingTest?.id === test.id; return <button key={test.id} type="button" aria-pressed={selected} onClick={() => { setSelectedTeachTestId(test.id); setSelectedTeachSection(test.passages?.[0]?.section ?? 1); onTeachPointer(null); }} className="flex min-h-16 items-center justify-between gap-3 rounded-xl border p-3 text-left" style={{ borderColor: selected ? theme.accent : theme.border, background: selected ? theme.accent + "12" : theme.page }}><span className="min-w-0"><span className="block truncate text-sm font-semibold">{test.title}</span><span className="mt-1 block text-xs" style={{ color: theme.muted }}>{test.passages?.length ?? 1} {(test.passages?.length ?? 1) === 1 ? "section" : "sections"} · {test.status === "draft" ? "Draft" : "Published"}</span></span>{selected && <Check size={17} style={{ color: theme.accent }} />}</button>; })}</div>
          {selectedTeachingTest && selectedTeachingSection && <>
            <div className="mt-4 flex flex-wrap items-center gap-2"><span className="mr-1 text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Section</span>{teachingSections.map(({ section, passage }) => <button key={section} type="button" aria-pressed={selectedTeachSection === section} onClick={() => { setSelectedTeachSection(section); onTeachPointer(null); }} className="rounded-full border px-4 py-2 text-xs font-bold" style={{ borderColor: selectedTeachSection === section ? theme.accent : theme.border, background: selectedTeachSection === section ? theme.accent : theme.page, color: selectedTeachSection === section ? theme.onAccent : theme.ink }}>Section {section} · {passage.title}</button>)}</div>
            <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
              <article className="rounded-2xl border p-4 sm:p-6" style={{ borderColor: theme.border, background: theme.page }}><div className="mb-4 border-b pb-3" style={{ borderColor: theme.border }}><p className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.accent }}>Section {selectedTeachingSection.section}</p><h3 className="mt-1 font-serif text-xl font-semibold">{selectedTeachingSection.passage.title}</h3><p className="mt-1 text-xs" style={{ color: theme.muted }}>Move your cursor over a paragraph to share its position.</p></div><div className="space-y-4 text-sm leading-7">{getReadingParagraphs(selectedTeachingSection.passage).map((paragraph, index) => { const label = paragraph.match(/^\(([A-H])\)\s*([\s\S]*)$/); return <div key={index} onPointerMove={(event) => publishPointerFromPassage(event, index)} onPointerDown={(event) => publishPointerFromPassage(event, index)} className="relative cursor-crosshair rounded-lg px-2 py-1 transition-colors hover:bg-white/60" style={{ color: theme.ink }}>{label && <span className="mr-2 inline-grid h-7 w-7 place-items-center rounded-lg border text-xs font-bold" style={{ borderColor: theme.border, color: theme.accent }}>{label[1]}</span>}{label ? label[2] : paragraph}</div>; })}</div></article>
              <aside className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: theme.border, background: theme.page }}><div className="mb-4 flex items-start gap-2"><BookOpen size={17} style={{ color: theme.accent }} /><div><p className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.accent }}>Teacher notes</p><h3 className="mt-1 font-serif text-lg font-semibold">Words & collocations</h3><p className="mt-1 text-xs" style={{ color: theme.muted }}>Key language for this reading section.</p></div></div>{sectionVocabulary.length ? <div className="max-h-[34rem] space-y-2 overflow-y-auto">{sectionVocabulary.map((item, index) => <article key={`${item.term}-${index}`} className="rounded-xl border p-3" style={{ borderColor: theme.border, background: theme.surface }}><div className="flex items-start justify-between gap-2"><h4 className="font-semibold">{item.term}</h4><span className="shrink-0 rounded-full px-2 py-1 text-[9px] font-bold uppercase" style={{ background: theme.accent + "15", color: theme.accent }}>{item.kind}</span></div><p className="mt-1 text-sm leading-5" style={{ color: theme.muted }}>{item.meaning}</p>{item.example && <p className="mt-2 border-l-2 pl-2 text-xs italic leading-5" style={{ borderColor: theme.accent, color: theme.ink }}>{item.example}</p>}</article>)}</div> : <p className="rounded-xl border p-3 text-sm" style={{ borderColor: theme.border, color: theme.muted }}>No word notes yet for this section. Add flashcards to this reading test to build its vocabulary notes.</p>}</aside>
            </div>
          </>}
        </>}
        <p className="mt-4 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: theme.border, color: theme.muted }}>Cursor sharing works between Libraria tabs in this browser. Cross-device live sync needs a shared realtime database.</p>
      </section>}
      {activeTab === "settings" && <section className="rounded-3xl border p-5 sm:p-7" style={cardStyle}>
        <div className="mb-6 flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: theme.accent + "18", color: theme.accent }}><Settings2 size={19} /></span><div><p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}>Teacher settings</p><h2 className="mt-1 font-serif text-2xl font-semibold">Classroom defaults</h2><p className="mt-1 text-sm" style={{ color: theme.muted }}>Set the starting values used when you create materials and schedule exams.</p></div></div>
        <form onSubmit={saveTeacherSettings} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">Classroom name<input value={teacherSettings.classroomName} onChange={(event) => setTeacherSettings((current) => ({ ...current, classroomName: event.target.value }))} maxLength={60} placeholder="e.g. Grade 8A English" className="mt-2 block h-12 w-full rounded-xl border px-3 font-normal outline-none focus:ring-2 focus:ring-emerald-600/30" style={inputStyle} /></label>
            <label className="text-sm font-semibold">Default phase for new materials<select value={teacherSettings.defaultMaterialPhase} onChange={(event) => setTeacherSettings((current) => ({ ...current, defaultMaterialPhase: Number(event.target.value) as TeacherSettings["defaultMaterialPhase"] }))} className="mt-2 block h-12 w-full rounded-xl border px-3 font-normal" style={inputStyle}>{([1, 2, 3, 4] as const).map((phase) => <option key={phase} value={phase}>Phase {phase}</option>)}</select></label>
            <label className="text-sm font-semibold">Default exam time<select value={teacherSettings.defaultExamMinutes} onChange={(event) => setTeacherSettings((current) => ({ ...current, defaultExamMinutes: Number(event.target.value) }))} className="mt-2 block h-12 w-full rounded-xl border px-3 font-normal" style={inputStyle}>{[10, 15, 20, 30, 45, 60, 90].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select><span className="mt-1 block text-xs font-normal" style={{ color: theme.muted }}>Used as the initial time limit for a scheduled exam.</span></label>
          </div>
          <fieldset><legend className="text-sm font-semibold">Default material visibility</legend><p className="mt-1 text-xs" style={{ color: theme.muted }}>You can still change this for each material before publishing.</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{([{ id: "all", label: "All students", description: "Visible to the class" }, { id: "students", label: "Specific students", description: "Choose people per material" }, { id: "groups", label: "Groups / classes", description: "Choose groups per material" }] as const).map((choice) => <label key={choice.id} className="flex min-h-20 cursor-pointer items-start gap-3 rounded-xl border p-3" style={{ borderColor: teacherSettings.defaultMaterialVisibility === choice.id ? theme.accent : theme.border, background: teacherSettings.defaultMaterialVisibility === choice.id ? theme.accent + "10" : theme.surface }}><input type="radio" name="default-material-visibility" value={choice.id} checked={teacherSettings.defaultMaterialVisibility === choice.id} onChange={() => setTeacherSettings((current) => ({ ...current, defaultMaterialVisibility: choice.id }))} className="mt-1 accent-emerald-700" /><span><span className="block text-sm font-semibold">{choice.label}</span><span className="mt-1 block text-xs" style={{ color: theme.muted }}>{choice.description}</span></span></label>)}</div></fieldset>
          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: theme.border }}><p role="status" className="text-sm" style={{ color: settingsNotice.includes("could not") || settingsNotice.includes("Could not") ? "#b45309" : theme.muted }}>{settingsNotice || "Settings are saved in this browser on this device."}</p><button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold" style={{ background: theme.accent, color: theme.onAccent }}><Check size={16} />Save settings</button></div>
        </form>
      </section>}
      {activeTab === "students" && <div className="grid gap-3 sm:grid-cols-3">{[{ label: "Students", value: students.length }, { label: "Published materials", value: tests.filter((test) => test.status === "published").length }, { label: "Needs review", value: assignments.filter((assignment) => assignment.completedAt && !assignment.gradedAt).length }].map((item) => <div key={item.label} className="rounded-2xl border p-4" style={{ borderColor: theme.border, background: theme.surface }}><p className="text-xs font-semibold uppercase tracking-wider" style={{ color: theme.muted }}>{item.label}</p><p className="mt-1 text-2xl font-semibold" style={{ color: theme.ink }}>{item.value}</p></div>)}</div>}

      {activeTab === "students" && <section className="rounded-3xl border p-5 sm:p-7" style={cardStyle}>
        <div className="mb-4 flex items-center gap-2"><Users size={18} style={{ color: theme.accent }} /><h2 className="font-serif text-2xl font-semibold">Students</h2><span className="ml-auto text-sm" style={{ color: theme.muted }}>{students.length} profiles</span></div>
        <form onSubmit={addStudent} className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="student-name">Student name</label>
          <input id="student-name" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Add a student name" maxLength={60} className="min-h-12 flex-1 rounded-xl border px-4 text-sm outline-none focus:ring-2 focus:ring-emerald-600/30" style={inputStyle} />
          <button type="submit" disabled={!newName.trim()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold disabled:opacity-50" style={{ background: theme.accent, color: theme.onAccent }}><Plus size={17} />Add student</button>
        </form>
        {studentNotice && <p role="status" className="mt-3 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: theme.border, color: theme.accent }}>{studentNotice}</p>}
        {students.length === 0 && <p className="mt-4 text-sm" style={{ color: theme.muted }}>Add student profile to start tracking reading.</p>}
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {students.map((student) => {
            const progress = progressByStudent[student.id] ?? emptyStudentProgress;
            const assigned = assignments.filter((assignment) => assignment.studentId === student.id);
            const availableTests = tests.filter((test) => test.status !== "draft" && test.kind !== "exam" && !test.timedExam && canStudentSeeTest(test, student.id));
            const finishedCount = progress.read.length + progress.testsDone.length;
            const completion = Math.min(100, Math.round(finishedCount / Math.max(1, 13 + availableTests.length) * 100));
            const startedTests = availableTests.filter((test) => progress.testsStarted.includes(test.id) && !progress.testsDone.includes(test.id));
            const assignedForStudent = assigned.map((assignment) => ({ assignment, test: tests.find((test) => test.id === assignment.testId) })).filter((item): item is { assignment: ExamAssignment; test: ReadingTest } => Boolean(item.test));
            const flashcardTests = tests.filter((test) => test.status !== "draft" && test.flashcards?.length && canStudentSeeTest(test, student.id));
            const knownFlashcards = flashcardTests.reduce((count, test) => count + (flashcardProgress[student.id]?.[test.id]?.length ?? 0), 0);
            const totalFlashcards = flashcardTests.reduce((count, test) => count + (test.flashcards?.length ?? 0), 0);
            const expanded = expandedStudentId === student.id;
            return <article key={student.id} className="flex min-h-[330px] flex-col rounded-2xl border p-5" style={cardStyle}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h3 className="font-serif text-2xl font-semibold">{student.name}</h3><p className="mt-1 text-xs" style={{ color: theme.muted }}>Added {new Date(student.createdAt).toLocaleDateString()}</p><div className="mt-2 flex flex-wrap items-center gap-2"><label className="inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5" style={{ borderColor: theme.border, background: theme.page }}><span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.muted }}>9-digit code</span><input aria-label={`${student.name} 9-digit student code`} inputMode="numeric" autoComplete="off" maxLength={9} value={studentCodeDrafts[student.id] ?? student.joinCode ?? ""} onChange={(event) => setStudentCodeDrafts((current) => ({ ...current, [student.id]: event.target.value.replace(/\D/g, "").slice(0, 9) }))} className="w-[6.5rem] bg-transparent font-mono text-xs font-bold tracking-[.12em] outline-none" /></label><button type="button" onClick={() => { const code = studentCodeDrafts[student.id] ?? student.joinCode ?? ""; if (!/^\d{9}$/.test(code)) { setStudentNotice("Student code must contain exactly 9 digits."); return; } if (!onUpdateStudentCode(student.id, code)) { setStudentNotice("That code is already used by another student. Choose a different code."); return; } setStudentCodeDrafts((current) => { const next = { ...current }; delete next[student.id]; return next; }); setStudentNotice(`${student.name}'s student code saved.`); }} className="inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold" style={{ borderColor: theme.border, color: theme.ink }}><Check size={13} />Save code</button>{student.joinCode && <button type="button" aria-label={`Copy ${student.name}'s student code`} title="Copy student code" onClick={async () => { try { await navigator.clipboard.writeText(student.joinCode ?? ""); setStudentNotice(`${student.name}'s code copied: ${student.joinCode}`); } catch { setStudentNotice(`Student code for ${student.name}: ${student.joinCode}`); } }} className="rounded p-1" style={{ color: theme.accent }}><Copy size={13} /></button>}</div></div>
                <div className="flex gap-2 text-xs font-semibold"><span className="rounded-full px-3 py-1.5" style={{ background: theme.accent + "18", color: theme.accent }}>{progress.read.length} reads</span><span className="rounded-full px-3 py-1.5" style={{ background: theme.accent + "18", color: theme.accent }}>{progress.testsDone.length} tests</span></div>
              </div>
              <div className="mt-4"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold" style={{ color: theme.muted }}>Learning progress</span><span className="text-xs font-semibold" style={{ color: theme.accent }}>{completion}%</span></div><div className="h-1.5 overflow-hidden rounded-full" style={{ background: theme.border }}><div className="h-full rounded-full transition-[width] duration-500" style={{ width: completion + "%", background: theme.accent }} /></div></div>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: theme.border }}><span className="mr-1 text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Unlocked phases</span>{([1, 2, 3, 4] as const).map((phase) => { const unlocked = (student.unlockedPhases ?? [1]).includes(phase); return <button key={phase} type="button" disabled={phase === 1} onClick={() => onToggleStudentPhase(student.id, phase)} aria-pressed={unlocked} title={phase === 1 ? "Phase 1 is always open" : unlocked ? "Lock Phase " + phase : "Unlock Phase " + phase} className="rounded-full border px-3 py-1.5 text-xs font-semibold disabled:cursor-default" style={{ borderColor: unlocked ? theme.accent : theme.border, background: unlocked ? theme.accent + "22" : "transparent", color: unlocked ? theme.accent : theme.muted }}>Phase {phase}{phase === 1 ? " · always open" : ""}</button>; })}</div>
              <div className="mt-auto border-t pt-3" style={{ borderColor: theme.border }}>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Reading tests</p>
                {tests.filter((test) => progress.testsDone.includes(test.id)).length > 0 ? tests.filter((test) => progress.testsDone.includes(test.id)).map((test) => <div key={test.id} className="flex items-center justify-between gap-2 py-1.5 text-sm"><span className="truncate">{test.title}</span><span className="shrink-0 font-bold" style={{ color: theme.accent }}>{progress.testScores[test.id] ?? 0}/{test.questions.length}</span></div>) : <p className="text-sm" style={{ color: theme.muted }}>No tests completed yet.</p>}
                <button type="button" aria-expanded={expanded} onClick={() => setExpandedStudentId(expanded ? null : student.id)} className="mt-3 inline-flex min-h-10 w-full items-center justify-between rounded-xl border px-3 text-left text-sm font-semibold" style={{ borderColor: theme.border, color: theme.ink }}><span>Detailed progress</span><span style={{ color: theme.muted }}>{expanded ? "Hide" : "View"}</span></button>
                {expanded && <div className="mt-3 space-y-4 rounded-xl border p-3" style={{ borderColor: theme.border, background: theme.page }}>
                  <div><p className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Reading tests · activity</p>{availableTests.length ? <div className="mt-2 space-y-2">{availableTests.map((test) => { const done = progress.testsDone.includes(test.id); const started = progress.testsStarted.includes(test.id); const draft = progress.testDrafts[test.id]; const answered = draft ? Object.keys(draft.answers ?? {}).length : 0; const percent = done ? 100 : Math.round(answered / Math.max(1, test.questions.length) * 100); const lastActivity = done ? progress.testsCompletedAt?.[test.id] : draft?.updatedAt; const status = done ? `Completed · ${progress.testScores[test.id] ?? 0}/${test.questions.length}` : started ? `In progress · ${answered}/${test.questions.length} answered` : "Not started"; return <article key={test.id} className="rounded-lg border p-2.5" style={{ borderColor: theme.border, background: theme.surface }}><div className="flex items-start justify-between gap-2"><span className="min-w-0 text-xs font-semibold">{test.title}</span><span className="shrink-0 text-[11px] font-bold" style={{ color: done ? theme.accent : theme.muted }}>{status}</span></div><div className="mt-2 h-1 overflow-hidden rounded-full" style={{ background: theme.border }}><div className="h-full rounded-full" style={{ width: `${percent}%`, background: done ? theme.accent : theme.muted }} /></div><div className="mt-1 flex flex-wrap justify-between gap-x-2 text-[10px]" style={{ color: theme.muted }}><span>{draft?.activeSection ? `Last section: ${draft.activeSection}` : `${percent}% complete`}</span><span>{lastActivity ? `${done ? "Completed" : "Last active"} ${new Date(lastActivity).toLocaleString()}` : "No activity yet"}</span></div></article>; })}</div> : <p className="mt-2 text-xs" style={{ color: theme.muted }}>No published reading tests are visible to this student.</p>}
                    {startedTests.length > 0 && <p className="mt-2 text-[11px]" style={{ color: theme.muted }}>Saved work is available to continue.</p>}
                  </div>
                  <div><p className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Assigned exams</p>{assignedForStudent.length ? <div className="mt-2 space-y-2">{assignedForStudent.map(({ assignment, test }) => { const status = assignment.gradedAt ? `Graded · ${assignment.score ?? 0}/${test.questions.length}` : assignment.completedAt ? "Submitted · needs review" : assignment.startedAt ? "In progress" : "Not started"; return <div key={assignment.id} className="flex items-start justify-between gap-2 text-xs"><span className="min-w-0 truncate">{test.title}</span><span className="shrink-0 font-semibold" style={{ color: assignment.gradedAt ? theme.accent : theme.muted }}>{status}</span></div>; })}</div> : <p className="mt-2 text-xs" style={{ color: theme.muted }}>No exams assigned.</p>}</div>
                  <div><p className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Vocabulary review</p><p className="mt-2 text-xs" style={{ color: theme.ink }}>{totalFlashcards ? `${knownFlashcards} of ${totalFlashcards} cards marked known` : "No flashcard sets assigned."}</p>{flashcardTests.map((test) => <p key={test.id} className="mt-1 truncate text-[11px]" style={{ color: theme.muted }}>{test.title}: {flashcardProgress[student.id]?.[test.id]?.length ?? 0}/{test.flashcards?.length ?? 0} known</p>)}</div>
                </div>}
                <p className="mt-2 text-xs" style={{ color: theme.muted }}>{assigned.length} exam{assigned.length === 1 ? "" : "s"} assigned</p>
                <button type="button" onClick={() => { setSelectedStudents([student.id]); setAssignmentSuccess(""); setExamNotice(""); setActiveTab("exams"); setShowAssignmentForm(true); window.setTimeout(() => document.getElementById("assign-exam-form")?.scrollIntoView({ behavior: "smooth", block: "center" }), 40); }} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold shadow-sm transition hover:brightness-105" style={{ background: theme.accent, color: "#14201a" }}><CalendarClock size={16} />Assign exam</button>
                <button type="button" onClick={() => onDeleteStudent(student.id)} className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition hover:bg-red-50/10" style={{ borderColor: theme.border, color: "#b54747" }}><Trash2 size={15} />Delete profile</button>
              </div>
            </article>;
          })}
        </div>
      </section>}

      {activeTab === "materials" && <section className="rounded-3xl border p-5 sm:p-7" style={cardStyle}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}>Class materials</p><h2 className="mt-1 font-serif text-2xl font-semibold">Add material</h2><p className="mt-1 text-sm" style={{ color: theme.muted }}>Save reading materials privately, then publish them when ready for students.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setShowIELTSBuilder((open) => !open)} className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-bold" style={{ background: theme.accent, color: theme.onAccent }}><BookOpen size={16} />{showIELTSBuilder ? "Close IELTS builder" : "Create IELTS Reading test"}</button><button type="button" onClick={() => setShowTestBuilder(!showTestBuilder)} className="inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold" style={{ borderColor: theme.border, background: theme.surface }}><Plus size={16} />{showTestBuilder ? "Close editor" : "Add material"}</button></div></div>
        {showIELTSBuilder && <div className="mt-6 border-t pt-5" style={{ borderColor: theme.border }}><IELTSTestWizard students={students} groups={groupNames} theme={theme} defaultPhase={teacherSettings.defaultMaterialPhase} defaultVisibility={teacherSettings.defaultMaterialVisibility} onCreateTest={onCreateTest} onClose={() => setShowIELTSBuilder(false)} /></div>}
        {showTestBuilder && <form onSubmit={createTest} className="mt-6 space-y-5 border-t pt-5" style={{ borderColor: theme.border }}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Material type
              <select value={materialKind} onChange={(event) => setMaterialKind(event.target.value as "reading" | "vocabulary" | "quiz" | "exam")} className="mt-2 block h-12 w-full rounded-xl border px-3 text-sm font-medium normal-case outline-none focus:ring-2 focus:ring-emerald-600/30" style={inputStyle}><option value="reading">Reading</option><option value="vocabulary">Vocabulary practice</option><option value="quiz">Quiz</option><option value="exam">Timed exam</option></select>
            </label>
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Phase
              <select value={materialPhase} onChange={(event) => setMaterialPhase(Number(event.target.value) as 1 | 2 | 3 | 4)} className="mt-2 block h-12 w-full rounded-xl border px-3 text-sm font-medium normal-case outline-none focus:ring-2 focus:ring-emerald-600/30" style={inputStyle}>{([1, 2, 3, 4] as const).map((phase) => <option key={phase} value={phase}>Phase {phase}</option>)}</select>
            </label>
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Test title<input required value={testTitle} onChange={(event) => setTestTitle(event.target.value)} maxLength={100} placeholder="e.g. A Day at the Museum" className="mt-2 block h-12 w-full rounded-xl border px-3 text-sm font-medium normal-case outline-none focus:ring-2 focus:ring-emerald-600/30" style={inputStyle} /></label>
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Topic<input value={testTopic} onChange={(event) => setTestTopic(event.target.value)} maxLength={80} placeholder="History, science, daily life..." className="mt-2 block h-12 w-full rounded-xl border px-3 text-sm font-medium normal-case outline-none focus:ring-2 focus:ring-emerald-600/30" style={inputStyle} /></label>
            {materialKind === "exam" ? <label className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Exam time limit<select value={examDuration} onChange={(event) => setExamDuration(Number(event.target.value))} className="mt-2 block h-12 w-full rounded-xl border px-3 text-sm font-medium normal-case outline-none focus:ring-2 focus:ring-emerald-600/30" style={inputStyle}>{[10, 15, 20, 30, 45, 60, 90].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></label> : <label className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Read time<input type="number" min="1" max="180" required value={testMinutes} onChange={(event) => setTestMinutes(Number(event.target.value))} className="mt-2 block h-12 w-full rounded-xl border px-3 text-sm font-medium normal-case outline-none focus:ring-2 focus:ring-emerald-600/30" style={inputStyle} /></label>}
          </div>
          
          <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Reading material<div className="mt-2 flex flex-wrap items-center gap-3"><span className="text-xs font-normal normal-case">Paste your text or upload a .txt / .md file.</span><input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={async (event) => { const file = event.currentTarget.files?.[0]; if (file) setTestPassage(await file.text()); }} className="max-w-full text-xs font-medium normal-case file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-2 file:font-semibold" /></div><textarea required value={testPassage} onChange={(event) => setTestPassage(event.target.value)} rows={8} placeholder="Paste or write reading passage here..." className="mt-3 block w-full rounded-xl border px-4 py-3 text-base font-normal normal-case leading-7 outline-none focus:ring-2 focus:ring-emerald-600/30" style={inputStyle} /></label>
          <div className="space-y-4"><div className="flex items-center justify-between gap-3"><h3 className="font-serif text-xl font-semibold">{materialKind === "vocabulary" ? "Vocabulary questions" : materialKind === "exam" ? "Exam questions" : materialKind === "quiz" ? "Quiz questions" : "Reading questions"}</h3><span className="text-xs" style={{ color: theme.muted }}>Choose correct answer with radio circle.</span></div>
            {draftQuestions.map((question, questionIndex) => <fieldset key={questionIndex} className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: theme.border }}><legend className="px-1 text-sm font-bold">Question {questionIndex + 1}</legend><div className="space-y-3"><input required value={question.prompt} onChange={(event) => updateQuestion(questionIndex, { prompt: event.target.value })} placeholder="Write your question" className="h-11 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-600/30" style={inputStyle} /><div className="grid gap-2 sm:grid-cols-2">{question.options.map((option, optionIndex) => <label key={optionIndex} className="flex items-center gap-2 rounded-lg border px-3" style={{ borderColor: question.answer === optionIndex ? theme.accent : theme.border }}><input type="radio" name={"correct-answer-" + questionIndex} checked={question.answer === optionIndex} onChange={() => updateQuestion(questionIndex, { answer: optionIndex })} aria-label={"Mark option " + (optionIndex + 1) + " correct"} className="accent-emerald-700" /><input required value={option} onChange={(event) => { const options = [...question.options]; options[optionIndex] = event.target.value; updateQuestion(questionIndex, { options }); }} placeholder={"Answer choice " + (optionIndex + 1)} className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>)}</div><input value={question.explanation} onChange={(event) => updateQuestion(questionIndex, { explanation: event.target.value })} placeholder="Answer explanation (optional)" className="h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-600/30" style={inputStyle} /></div>{draftQuestions.length > 1 && <button type="button" onClick={() => setDraftQuestions((current) => current.filter((_, index) => index !== questionIndex))} className="mt-3 text-xs font-semibold text-rose-600">Remove question</button>}</fieldset>)}
            <button type="button" onClick={() => setDraftQuestions((current) => [...current, { prompt: "", options: ["", "", "", ""], answer: 0, explanation: "" }])} className="rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: theme.border }}>+ Add question</button>
          </div>
          <section className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: theme.border, background: theme.page }}><div className="mb-3 flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}>Optional practice</p><h3 className="mt-1 font-serif text-lg font-semibold">Flashcards after the reading</h3><p className="mt-1 text-sm" style={{ color: theme.muted }}>Add vocabulary or collocations. Students see these when they finish the test.</p></div><button type="button" onClick={() => setDraftFlashcards((cards) => [...cards, { term: "", meaning: "", example: "", kind: "vocabulary" }])} className="shrink-0 rounded-full border px-3 py-2 text-sm font-semibold" style={{ borderColor: theme.border }}>+ Add card</button></div>{draftFlashcards.map((card,index)=><div key={index} className="mb-3 grid gap-2 rounded-xl border p-3 sm:grid-cols-[130px_1fr_1fr_auto]" style={{ borderColor: theme.border, background: theme.surface }}><select aria-label="Flashcard type" value={card.kind ?? "vocabulary"} onChange={(event)=>setDraftFlashcards((cards)=>cards.map((item,i)=>i===index?{...item,kind:event.target.value as ReadingFlashcard["kind"]}:item))} className="h-10 rounded-lg border px-2 text-sm" style={inputStyle}><option value="vocabulary">Vocabulary</option><option value="collocation">Collocation</option></select><input aria-label="Flashcard word or phrase" value={card.term} onChange={(event)=>setDraftFlashcards((cards)=>cards.map((item,i)=>i===index?{...item,term:event.target.value}:item))} placeholder="Word / phrase" className="h-10 min-w-0 rounded-lg border px-3 text-sm" style={inputStyle}/><input aria-label="Flashcard meaning" value={card.meaning} onChange={(event)=>setDraftFlashcards((cards)=>cards.map((item,i)=>i===index?{...item,meaning:event.target.value}:item))} placeholder="Meaning" className="h-10 min-w-0 rounded-lg border px-3 text-sm" style={inputStyle}/><button type="button" aria-label="Remove flashcard" onClick={()=>setDraftFlashcards((cards)=>cards.filter((_,i)=>i!==index))} className="rounded-lg px-2 text-rose-600">×</button><input aria-label="Example sentence" value={card.example ?? ""} onChange={(event)=>setDraftFlashcards((cards)=>cards.map((item,i)=>i===index?{...item,example:event.target.value}:item))} placeholder="Example sentence (optional)" className="h-10 min-w-0 rounded-lg border px-3 text-sm sm:col-start-2 sm:col-span-2" style={inputStyle}/></div>)}</section>
          <section className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: theme.border, background: theme.page }}><div className="mb-3"><p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}>Assignment control</p><h3 className="mt-1 font-serif text-xl font-semibold">Who can see this?</h3></div><div className="grid gap-2 sm:grid-cols-3">{(["all", "students", "groups"] as const).map((choice) => <button key={choice} type="button" onClick={() => setMaterialVisibility(choice)} aria-pressed={materialVisibility === choice} className="rounded-xl border px-3 py-3 text-left text-sm font-semibold" style={{ borderColor: materialVisibility === choice ? theme.accent : theme.border, background: materialVisibility === choice ? theme.accent + "12" : theme.surface, color: materialVisibility === choice ? theme.accent : theme.ink }}>{choice === "all" ? "All students" : choice === "students" ? "Specific students" : "Specific groups / classes"}</button>)}</div>{materialVisibility === "students" && <div className="mt-4"><label className="flex h-10 items-center gap-2 rounded-xl border px-3" style={{ borderColor: theme.border, background: theme.surface }}><Search size={15} style={{ color: theme.muted }} /><input value={materialSearch} onChange={(event) => setMaterialSearch(event.target.value)} placeholder="Search students" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label><div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl border p-2" style={{ borderColor: theme.border, background: theme.surface }}>{students.filter((student) => student.name.toLowerCase().includes(materialSearch.toLowerCase())).map((student) => <label key={student.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-black/5"><input type="checkbox" checked={materialStudentIds.includes(student.id)} onChange={(event) => setMaterialStudentIds((current) => event.target.checked ? [...current, student.id] : current.filter((id) => id !== student.id))} className="accent-emerald-700" />{student.name}{student.groupName && <span className="ml-auto text-xs" style={{ color: theme.muted }}>{student.groupName}</span>}</label>)}</div><div className="mt-2 flex flex-wrap gap-1.5">{materialStudentIds.map((id) => { const student = students.find((item) => item.id === id); return student && <button key={id} type="button" onClick={() => setMaterialStudentIds((current) => current.filter((selectedId) => selectedId !== id))} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: theme.accent + "18", color: theme.accent }}>{student.name}<X size={12} /></button>; })}</div></div>}{materialVisibility === "groups" && <div className="mt-4">{groupNames.length ? <div className="flex flex-wrap gap-2">{groupNames.map((group) => <label key={group} className="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold" style={{ borderColor: materialGroupNames.includes(group) ? theme.accent : theme.border, background: materialGroupNames.includes(group) ? theme.accent + "12" : theme.surface }}><input type="checkbox" checked={materialGroupNames.includes(group)} onChange={(event) => setMaterialGroupNames((current) => event.target.checked ? [...current, group] : current.filter((name) => name !== group))} className="accent-emerald-700" />{group}</label>)}</div> : <p className="text-sm" style={{ color: theme.muted }}>Add a class / group name to student profiles above to assign a whole class.</p>}</div>}<p className="mt-3 text-sm font-semibold" style={{ color: theme.ink }}>Visible to {materialAudienceIds.length} {materialAudienceIds.length === 1 ? "student" : "students"}</p></section>
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs" style={{ color: theme.muted }}>{materialKind === "exam" ? "Exam settings are saved in this draft. Publishing assigns it to the selected students." : "Draft saves privately on this device. Publish when ready."}</p><button type="submit" disabled={!canCreateTest} className="inline-flex h-12 items-center gap-2 rounded-xl px-5 text-sm font-bold disabled:opacity-50" style={{ background: theme.accent, color: theme.onAccent }}><Check size={17} />Save draft</button></div>
        </form>}
      </section>}

      {activeTab === "materials" && <section className="rounded-3xl border p-5 sm:p-7" style={cardStyle}>
        <div className="mb-4 flex items-center gap-2"><StickyNote size={18} style={{ color: theme.accent }} /><div><h2 className="font-serif text-2xl font-semibold">Material assignments</h2><p className="mt-1 text-sm" style={{ color: theme.muted }}>Update visibility and see student activity.</p></div></div>
        {publishNotice && <p role="status" className="mb-3 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: theme.accent, color: theme.accent }}>{publishNotice}</p>}
        {draftNotice && <p role="status" className="mb-3 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: theme.border, color: theme.accent }}>{draftNotice}</p>}
        {tests.length === 0 ? <p className="text-sm" style={{ color: theme.muted }}>Materials you add will appear here.</p> : <div className="space-y-3">{tests.map((test) => {
          const audienceIds = getAudienceIds(test);
          const startedCount = audienceIds.filter((id) => (progressByStudent[id]?.testsStarted ?? []).includes(test.id) || (progressByStudent[id]?.testsDone ?? []).includes(test.id) || assignments.some((assignment) => assignment.testId === test.id && assignment.studentId === id && Boolean(assignment.startedAt))).length;
          const editorOpen = visibilityDraft?.testId === test.id;
          const draftAudienceIds = visibilityDraft ? students.filter((student) => visibilityDraft.visibility === "all" || visibilityDraft.visibility === "students" && visibilityDraft.studentIds.includes(student.id) || visibilityDraft.visibility === "groups" && Boolean(student.groupName && visibilityDraft.groupNames.includes(student.groupName))).map((student) => student.id) : [];
          const visibilitySummary = test.visibility === "groups" ? (test.groupNames ?? []).join(", ") || "No groups" : test.visibility === "students" || test.studentId ? students.filter((student) => audienceIds.includes(student.id)).map((student) => student.name).join(", ") || "No students" : "All students";
          return <article key={test.id} className="rounded-2xl border p-4" style={{ borderColor: theme.border }}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{test.title}</h3><span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ background: test.status === "draft" ? theme.border : theme.accent + "18", color: test.status === "draft" ? theme.muted : theme.accent }}>{test.status === "draft" ? "Draft" : "Published"} · {test.kind ?? "reading"} · Phase {test.phase ?? 1}</span></div><p className="mt-1 text-sm" style={{ color: theme.muted }}>{test.status === "draft" ? "Draft · planned for " + audienceIds.length + (audienceIds.length === 1 ? " student" : " students") : "Assigned to " + audienceIds.length + (audienceIds.length === 1 ? " student" : " students") + " · " + startedCount + " have started"}</p><p className="mt-1 text-xs" style={{ color: theme.muted }}>Visible to: {visibilitySummary}</p><p className="mt-1 text-xs" style={{ color: theme.muted }}>{test.status === "draft" ? "Saved privately · Not visible to students" : "Published · Visible to selected students"}</p></div><div className="flex flex-wrap gap-2">{test.status === "draft" ? <button type="button" disabled={editorOpen || (test.visibility === "students" && !test.studentIds?.length) || (test.visibility === "groups" && !test.groupNames?.length)} onClick={() => { onPublishMaterial(test.id); setPublishNotice(`${test.title} published.`); }} className="rounded-full px-4 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40" style={{ background: theme.accent, color: theme.onAccent }}>Publish</button> : <button type="button" onClick={() => { onUnpublishMaterial(test.id); if (visibilityDraft?.testId === test.id) setVisibilityDraft(null); setPublishNotice(`${test.title} unpublished.`); }} className="rounded-full border px-4 py-2 text-xs font-bold" style={{ borderColor: theme.border, color: theme.ink }}>Unpublish</button>}<button type="button" onClick={() => editorOpen ? setVisibilityDraft(null) : editVisibility(test)} className="rounded-full border px-3 py-2 text-xs font-bold" style={{ borderColor: theme.border, color: theme.accent }}>{editorOpen ? "Close" : "Edit visibility"}</button></div></div>{editorOpen && visibilityDraft && <div className="mt-4 space-y-4 border-t pt-4" style={{ borderColor: theme.border }}><p className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Who can see this?</p><div className="grid gap-2 sm:grid-cols-3">{(["all", "students", "groups"] as const).map((choice) => <button key={choice} type="button" onClick={() => setVisibilityDraft((draft) => draft ? { ...draft, visibility: choice } : draft)} className="rounded-xl border px-3 py-2.5 text-left text-sm font-semibold" style={{ borderColor: visibilityDraft.visibility === choice ? theme.accent : theme.border, color: visibilityDraft.visibility === choice ? theme.accent : theme.ink }}>{choice === "all" ? "All students" : choice === "students" ? "Specific students" : "Specific groups / classes"}</button>)}</div>{visibilityDraft.visibility === "students" && <div><label className="flex h-10 items-center gap-2 rounded-xl border px-3" style={{ borderColor: theme.border }}><Search size={15} style={{ color: theme.muted }} /><input value={materialSearch} onChange={(event) => setMaterialSearch(event.target.value)} placeholder="Search students" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label><div className="mt-2 max-h-40 overflow-y-auto rounded-xl border p-2" style={{ borderColor: theme.border }}>{students.filter((student) => student.name.toLowerCase().includes(materialSearch.toLowerCase())).map((student) => <label key={student.id} className="flex cursor-pointer items-center gap-2 px-2 py-2 text-sm"><input type="checkbox" checked={visibilityDraft.studentIds.includes(student.id)} onChange={(event) => setVisibilityDraft((draft) => draft ? { ...draft, studentIds: event.target.checked ? [...draft.studentIds, student.id] : draft.studentIds.filter((id) => id !== student.id) } : draft)} className="accent-emerald-700" />{student.name}</label>)}</div><div className="mt-2 flex flex-wrap gap-1.5">{visibilityDraft.studentIds.map((id) => { const student = students.find((item) => item.id === id); return student && <button key={id} type="button" onClick={() => setVisibilityDraft((draft) => draft ? { ...draft, studentIds: draft.studentIds.filter((item) => item !== id) } : draft)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: theme.accent + "18", color: theme.accent }}>{student.name}<X size={12} /></button>; })}</div></div>}{visibilityDraft.visibility === "groups" && <div className="flex flex-wrap gap-2">{groupNames.length ? groupNames.map((group) => <label key={group} className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm" style={{ borderColor: visibilityDraft.groupNames.includes(group) ? theme.accent : theme.border }}><input type="checkbox" checked={visibilityDraft.groupNames.includes(group)} onChange={(event) => setVisibilityDraft((draft) => draft ? { ...draft, groupNames: event.target.checked ? [...draft.groupNames, group] : draft.groupNames.filter((name) => name !== group) } : draft)} className="accent-emerald-700" />{group}</label>) : <p className="text-sm" style={{ color: theme.muted }}>Add class / group names to student profiles first.</p>}</div>}<p className="text-sm font-semibold">Visible to {draftAudienceIds.length} {draftAudienceIds.length === 1 ? "student" : "students"}</p><p className="rounded-xl border p-3 text-sm" style={{ borderColor: theme.border, background: theme.page, color: theme.muted }}>Use {tests.find((item) => item.id === visibilityDraft.testId)?.status === "published" ? "Unpublish" : "Publish"} on this material card to control whether students can see it.</p><div className="flex justify-end gap-2"><button type="button" onClick={() => setVisibilityDraft(null)} className="rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: theme.border }}>Cancel</button><button type="button" disabled={visibilityDraft.visibility === "students" && !visibilityDraft.studentIds.length || visibilityDraft.visibility === "groups" && !visibilityDraft.groupNames.length} onClick={saveVisibility} className="rounded-full px-4 py-2 text-sm font-bold disabled:opacity-45" style={{ background: theme.accent, color: theme.onAccent }}>Save visibility</button></div></div>}</article>;
        })}</div>}
      </section>}



      {activeTab === "exams" && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[{ id: "all" as const, label: "All exams", value: assignments.length, color: theme.accent }, { id: "not-done" as const, label: "Not done", value: assignments.filter((assignment) => !assignment.completedAt).length, color: "#286283" }, { id: "needs-review" as const, label: "Needs review", value: assignments.filter((assignment) => assignment.completedAt && !assignment.gradedAt).length, color: "#a95e18" }, { id: "graded" as const, label: "Graded", value: assignments.filter((assignment) => Boolean(assignment.gradedAt)).length, color: "#27734a" }].map((item) => <button key={item.id} type="button" aria-pressed={examFilter === item.id} onClick={() => setExamFilter(item.id)} className="rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm" style={{ borderColor: examFilter === item.id ? item.color : theme.border, background: examFilter === item.id ? item.color + "12" : theme.surface }}><p className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>{item.label}</p><p className="mt-1 text-3xl font-semibold tabular-nums" style={{ color: item.color }}>{item.value}</p><p className="mt-1 text-xs" style={{ color: theme.muted }}>student exam{item.value === 1 ? "" : "s"}</p></button>)}</div>}
      {activeTab === "exams" && examNotice && <p role="status" className="rounded-xl border px-4 py-3 text-sm font-semibold" style={{ borderColor: theme.accent, background: theme.accent + "12", color: theme.accent }}>{examNotice}</p>}
      {activeTab === "exams" && <section id="exam-schedule" className="rounded-3xl border p-5 sm:p-7" style={cardStyle}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}>Exam workspace</p><h2 className="mt-1 font-serif text-2xl font-semibold">Exam overview</h2><p className="mt-1 text-sm" style={{ color: theme.muted }}>Choose an exam to see student progress, schedule, questions, and grading.</p></div><button type="button" onClick={() => { const nextOpen = !showAssignmentForm; setShowAssignmentForm(nextOpen); setExamNotice(""); if (nextOpen) window.setTimeout(() => document.getElementById("assign-exam-form")?.scrollIntoView({ behavior: "smooth", block: "center" }), 40); }} className="rounded-full px-4 py-2.5 text-sm font-bold" style={{ background: theme.accent, color: theme.onAccent }}>{showAssignmentForm ? "Close assignment form" : "Assign exam"}</button></div>
        {examTests.length === 0 ? <p className="rounded-xl border p-4 text-sm" style={{ borderColor: theme.border, color: theme.muted }}>No exams have been assigned yet.</p> : filteredExamTests.length === 0 ? <p className="rounded-xl border p-4 text-sm" style={{ borderColor: theme.border, color: theme.muted }}>No exams match this status.</p> : <div className="grid gap-3 lg:grid-cols-2">{filteredExamTests.map((test) => { const rows = assignments.filter((assignment) => assignment.testId === test.id); const notDone = rows.filter((assignment) => !assignment.completedAt).length; const waiting = rows.filter((assignment) => assignment.completedAt && !assignment.gradedAt).length; const graded = rows.filter((assignment) => Boolean(assignment.gradedAt)).length; return <button key={test.id} type="button" onClick={() => { setSelectedExamTestId(test.id); setExamDetailTab("students"); setReviewingAssignmentId(null); }} className="rounded-2xl border p-4 text-left transition hover:shadow-sm" style={{ borderColor: theme.border, background: theme.page }}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.accent }}>Phase {test.phase ?? 1} · {test.kind ?? "exam"}</p><h3 className="mt-1 font-serif text-xl font-semibold">{test.title}</h3><p className="mt-1 text-xs" style={{ color: theme.muted }}>{rows.length} assigned · {test.questions.length} questions</p></div><Eye size={17} style={{ color: theme.accent }} /></div><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: "#28628318", color: "#286283" }}>{notDone} not done</span><span className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: "#a95e1818", color: "#a95e18" }}>{waiting} needs review</span><span className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: "#27734a18", color: "#27734a" }}>{graded} graded</span></div></button>; })}</div>}
      </section>}
      {activeTab === "exams" && showAssignmentForm && <section id="assign-exam-form" className="rounded-3xl border p-5 sm:p-7" style={cardStyle}>
        <div className="mb-5 flex items-center gap-2"><CalendarClock size={18} style={{ color: theme.accent }} /><div><h2 className="font-serif text-2xl font-semibold">Assign an exam</h2><p className="mt-1 text-sm" style={{ color: theme.muted }}>Choose the students, test, and exam window.</p></div></div>
        <form onSubmit={createAssignment} className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-2xl border p-4" style={{ borderColor: theme.border, background: theme.page }}><p className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.accent }}>1 · Who</p><h3 className="mt-1 font-serif text-lg font-semibold">Select students</h3><label className="mt-3 flex h-10 items-center gap-2 rounded-xl border px-3" style={{ borderColor: theme.border, background: theme.surface }}><Search size={15} style={{ color: theme.muted }} /><input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Search students" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label><div className="mt-2 max-h-36 space-y-1 overflow-y-auto">{students.filter((student) => student.name.toLowerCase().includes(studentSearch.toLowerCase()) || student.groupName?.toLowerCase().includes(studentSearch.toLowerCase())).map((student) => <label key={student.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-white/5"><input type="checkbox" checked={selectedStudents.includes(student.id)} onChange={(event) => { setSelectedStudents((current) => event.target.checked ? [...current, student.id] : current.filter((id) => id !== student.id)); setAssignmentSuccess(""); }} className="accent-emerald-400" />{student.name}{student.groupName && <span className="ml-auto text-xs" style={{ color: theme.muted }}>{student.groupName}</span>}</label>)}</div><div className="mt-2 flex min-h-7 flex-wrap gap-1.5">{selectedStudents.map((id) => { const student = students.find((item) => item.id === id); return student && <button key={id} type="button" onClick={() => setSelectedStudents((current) => current.filter((item) => item !== id))} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: theme.accent + "24", color: theme.accent }}>{student.name}<X size={12} /></button>; })}</div><p className="mt-1 text-xs" style={{ color: theme.muted }}>{selectedStudents.length} selected</p></section>
            <section className="rounded-2xl border p-4" style={{ borderColor: theme.border, background: theme.page }}><p className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.accent }}>2 · What</p><h3 className="mt-1 font-serif text-lg font-semibold">Choose reading test</h3><label className="mt-3 block text-xs font-semibold" style={{ color: theme.muted }}>Assigned test<select required value={selectedTest} onChange={(event) => { setSelectedTest(event.target.value); setAssignmentSuccess(""); }} disabled={!assignableTests.length} className="mt-2 block h-12 w-full rounded-xl border px-3 text-sm font-medium outline-none" style={inputStyle}>{assignableTests.map((test) => <option key={test.id} value={test.id}>{test.title} · Phase {test.phase ?? 1}</option>)}</select></label>{!assignableTests.length && <p className="mt-2 text-xs" style={{ color: theme.muted }}>No test is visible to every selected student. Update its visibility or choose a different group.</p>}</section>
            <section className="rounded-2xl border p-4" style={{ borderColor: theme.border, background: theme.page }}><p className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.accent }}>3 · When</p><h3 className="mt-1 font-serif text-lg font-semibold">Set exam time</h3><label className="mt-3 block text-xs font-semibold" style={{ color: theme.muted }}>Start date and time<input type="datetime-local" value={startsAt} onChange={(event) => { setStartsAt(event.target.value); setAssignmentSuccess(""); }} className="mt-2 block h-12 w-full rounded-xl border px-3 text-sm font-medium" style={inputStyle} /></label><label className="mt-3 block text-xs font-semibold" style={{ color: theme.muted }}>Time limit<select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="mt-2 block h-12 w-full rounded-xl border px-3 text-sm font-medium" style={inputStyle}>{[10, 15, 20, 30, 45, 60, 90].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></label></section>
          </div>
          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: theme.border }}><p className="inline-flex items-center gap-2 text-sm" style={{ color: theme.muted }}><Clock3 size={15} />Blank start means available now. The exam timer begins at its scheduled time.</p><button type="submit" disabled={!selectedStudents.length || !selectedTest || !assignableTests.length} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-7 text-base font-bold shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45" style={{ background: theme.accent, color: theme.onAccent }}><Check size={18} />Assign to students</button></div>
          {assignmentSuccess && <p role="status" className="rounded-xl border px-4 py-3 text-sm font-semibold" style={{ borderColor: theme.accent, background: theme.accent + "20", color: theme.accent }}>{assignmentSuccess}</p>}
        </form>
      </section>}

      {activeTab === "exams" && selectedExamTest && <div role="presentation" className="fixed inset-0 z-50 bg-black/45" onClick={() => { setSelectedExamTestId(null); setReviewingAssignmentId(null); }}><aside role="dialog" aria-modal="true" aria-label={selectedExamTest.title + " exam details"} className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col overflow-y-auto border-l p-5 shadow-2xl sm:p-7" style={{ borderColor: theme.border, background: theme.surface, color: theme.ink }} onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: theme.accent }}>Exam details · Phase {selectedExamTest.phase ?? 1}</p><h2 className="mt-1 font-serif text-2xl font-semibold">{selectedExamTest.title}</h2><p className="mt-1 text-sm" style={{ color: theme.muted }}>{selectedExamTest.questions.length} questions · {(selectedExamTest.passages?.length ?? 1)} reading passage{(selectedExamTest.passages?.length ?? 1) === 1 ? "" : "s"}</p></div><button type="button" aria-label="Close exam details" onClick={() => { setSelectedExamTestId(null); setReviewingAssignmentId(null); }} className="rounded-full border p-2" style={{ borderColor: theme.border, color: theme.muted }}><X size={18} /></button></div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{[{ label: "Assigned", value: selectedExamAssignments.length }, { label: "Not done", value: selectedExamAssignments.filter((assignment) => !assignment.completedAt).length }, { label: "Needs review", value: selectedExamAssignments.filter((assignment) => assignment.completedAt && !assignment.gradedAt).length }, { label: "Graded", value: selectedExamAssignments.filter((assignment) => Boolean(assignment.gradedAt)).length }].map((item) => <div key={item.label} className="rounded-xl p-3" style={{ background: theme.page }}><p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.muted }}>{item.label}</p><p className="mt-1 text-xl font-bold tabular-nums">{item.value}</p></div>)}</div>
        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl border p-1" style={{ borderColor: theme.border, background: theme.page }}><button type="button" onClick={() => setExamDetailTab("students")} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: examDetailTab === "students" ? theme.surface : "transparent", color: examDetailTab === "students" ? theme.accent : theme.muted }}>Students</button><button type="button" onClick={() => { setExamDetailTab("content"); setReviewingAssignmentId(null); }} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: examDetailTab === "content" ? theme.surface : "transparent", color: examDetailTab === "content" ? theme.accent : theme.muted }}>Test content</button></div>
        {examDetailTab === "students" && <div className="mt-4 space-y-2"><h3 className="mb-2 text-sm font-bold">Student progress</h3>{selectedExamAssignments.map((assignment) => { const student = students.find((item) => item.id === assignment.studentId); const end = Math.min(new Date(assignment.startsAt).getTime() + assignment.durationMinutes * 60_000, assignment.closesAt ? new Date(assignment.closesAt).getTime() : Number.POSITIVE_INFINITY); const status = assignment.gradedAt ? `Graded · ${assignment.score ?? 0}/${selectedExamTest.questions.length}` : assignment.completedAt ? "Submitted · needs review" : Date.now() >= end ? "Missed / expired" : assignment.startedAt ? "In progress" : "Not started"; const color = assignment.gradedAt ? "#27734a" : assignment.completedAt ? "#a95e18" : assignment.startedAt ? "#286283" : theme.muted; return <article key={assignment.id} className="rounded-xl border p-3" style={{ borderColor: theme.border, background: theme.page }}><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{student?.name ?? "Unknown student"}</p><p className="mt-1 text-xs" style={{ color: theme.muted }}>Starts {new Date(assignment.startsAt).toLocaleString()} · {assignment.durationMinutes} min</p>{assignment.completedAt && <p className="mt-1 text-xs" style={{ color: theme.muted }}>Submitted {new Date(assignment.completedAt).toLocaleString()}</p>}</div><div className="flex items-center gap-2"><span className="rounded-full px-3 py-1.5 text-[11px] font-bold text-white" style={{ background: color }}>{status}</span>{assignment.completedAt && <button type="button" onClick={() => startReview(assignment)} className="rounded-full border px-3 py-2 text-xs font-bold" style={{ borderColor: theme.border, color: theme.accent }}>{assignment.gradedAt ? "View grade" : "Review answers"}</button>}</div></div></article>; })}{!selectedExamAssignments.length && <p className="text-sm" style={{ color: theme.muted }}>No students assigned to this exam.</p>}</div>}
        {examDetailTab === "content" && <div className="mt-4 space-y-4"><h3 className="text-sm font-bold">Passages and questions</h3>{(selectedExamTest.passages?.length ? selectedExamTest.passages : [{ title: "Reading passage", text: selectedExamTest.passage }]).map((passage, index) => <article key={index} className="rounded-xl border p-4" style={{ borderColor: theme.border, background: theme.page }}><h4 className="font-serif text-lg font-semibold">{passage.title}</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{passage.text}</p></article>)}<div className="space-y-2">{selectedExamTest.questions.map((question, index) => <article key={index} className="rounded-xl border p-3" style={{ borderColor: theme.border, background: theme.page }}><p className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Question {(selectedExamTest.questionNumberStart ?? 1) + index}</p><p className="mt-1 text-sm font-semibold">{question.prompt}</p><p className="mt-2 text-xs" style={{ color: theme.muted }}>Answer: {typeof question.answer === "number" ? question.options[question.answer] : question.answer}</p>{question.explanation && <p className="mt-1 text-xs leading-5" style={{ color: theme.muted }}>Explanation: {question.explanation}</p>}</article>)}</div></div>}
        {examDetailTab === "review" && reviewingAssignment && reviewingTest && <div className="mt-4 space-y-4"><div><button type="button" onClick={() => { setReviewingAssignmentId(null); setExamDetailTab("students"); }} className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: theme.muted }}><ArrowLeft size={15} />Student list</button><p className="mt-3 text-xs font-bold uppercase tracking-wider" style={{ color: theme.accent }}>Review submission</p><h3 className="mt-1 font-serif text-xl font-semibold">{students.find((student) => student.id === reviewingAssignment.studentId)?.name} · {reviewingTest.title}</h3><p className="mt-1 text-sm" style={{ color: theme.muted }}>Review each response and award points before publishing the grade.</p></div><div className="space-y-3">{reviewingTest.questions.map((question, index) => { const questionNumber = (reviewingTest.questionNumberStart ?? (reviewingTest.id === "ielts-hiv-pandemic" ? 13 : 1)) + index; const answer = reviewingAssignment.answers?.[index]; const studentAnswer = answer === undefined ? "No answer" : typeof answer === "number" ? question.options[answer] ?? "No answer" : answer; const correctAnswer = typeof question.answer === "number" ? question.options[question.answer] ?? "" : question.answer; return <article key={question.prompt} className="rounded-xl border p-4" style={{ borderColor: theme.border, background: theme.page }}><p className="font-semibold">{questionNumber}. {question.prompt}</p><p className="mt-2 text-sm" style={{ color: theme.muted }}>Student answer: <strong style={{ color: theme.ink }}>{studentAnswer}</strong></p><p className="mt-1 text-sm" style={{ color: theme.muted }}>Correct answer: <strong style={{ color: theme.accent }}>{correctAnswer}</strong></p>{question.explanation && <p className="mt-1 text-sm" style={{ color: theme.muted }}>Explanation: {question.explanation}</p>}<div className="mt-3 flex gap-2"><button type="button" onClick={() => setDraftPoints((current) => ({ ...current, [index]: 1 }))} aria-pressed={draftPoints[index] === 1} className="rounded-full border px-3 py-1.5 text-xs font-bold" style={{ borderColor: draftPoints[index] === 1 ? theme.accent : theme.border, background: draftPoints[index] === 1 ? theme.accent + "18" : "transparent", color: draftPoints[index] === 1 ? theme.accent : theme.muted }}>Award 1 point</button><button type="button" onClick={() => setDraftPoints((current) => ({ ...current, [index]: 0 }))} aria-pressed={draftPoints[index] === 0} className="rounded-full border px-3 py-1.5 text-xs font-bold" style={{ borderColor: draftPoints[index] === 0 ? theme.muted : theme.border, background: draftPoints[index] === 0 ? theme.muted + "18" : "transparent", color: theme.muted }}>Award 0 points</button></div></article>; })}</div><label className="block text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted }}>Teacher feedback<textarea value={draftFeedback} onChange={(event) => setDraftFeedback(event.target.value)} rows={3} placeholder="Add feedback for the student (optional)" className="mt-2 w-full rounded-xl border p-3 text-sm font-normal normal-case" style={{ borderColor: theme.border, background: theme.page, color: theme.ink }} /></label><div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: theme.border }}><span className="text-sm font-semibold" style={{ color: theme.muted }}>Points: {Object.values(draftPoints).reduce((sum, value) => sum + value, 0)} / {reviewingTest.questions.length}</span><button type="button" onClick={saveGrade} disabled={Object.keys(draftPoints).length !== reviewingTest.questions.length} className="rounded-full px-4 py-2.5 text-sm font-bold disabled:opacity-45" style={{ background: theme.accent, color: theme.onAccent }}>{reviewingAssignment.gradedAt ? "Update grade" : "Publish grade"}</button></div></div>}
        {examDetailTab === "review" && !reviewingAssignment && <p className="mt-4 text-sm" style={{ color: theme.muted }}>Choose a submitted student from the Students tab to review answers.</p>}
      </aside></div>}      <div className="flex items-center gap-2 rounded-2xl border p-4 text-xs leading-relaxed" style={{ borderColor: theme.border, color: theme.muted }}><LockKeyhole size={15} className="shrink-0" />Local classroom mode: profiles, exams, and progress live in this browser on this device.</div>
    </motion.main>
  );
}

