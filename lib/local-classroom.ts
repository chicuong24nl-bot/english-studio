export type StudentProfile = {
  id: string;
  name: string;
  joinCode?: string;
  createdAt: string;
  unlockedPhases: number[];
  groupName?: string;
};

export function createStudentJoinCode(existingCodes: string[] = []) {
  const used = new Set(existingCodes);
  let code = "";
  do {
    code = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join("");
  } while (used.has(code));
  return code;
}

export type MaterialStatus = "draft" | "published";

export function createLocalId(prefix = "") {
  const value = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return prefix + value;
}

export type ReadingTestDraft = {
  answers: Record<number, number | string>;
  activeSection: number | null;
  updatedAt: string;
};

export type TeachingPointer = {
  testId: string;
  section: number;
  paragraphIndex: number;
  x: number;
  y: number;
  teacherName: string;
  updatedAt: number;
};

export type StudentProgress = {
  read: string[];
  readsStarted: string[];
  saved: string[];
  testsDone: string[];
  testsCompletedAt: Record<string, string>;
  testsStarted: string[];
  testScores: Record<string, number>;
  testDrafts: Record<string, ReadingTestDraft>;
};

export type ExamAssignment = {
  id: string;
  studentId: string;
  testId: string;
  startsAt: string;
  durationMinutes: number;
  closesAt?: string;
  startedAt?: string;
  completedAt?: string;
  answers?: Record<number, number | string>;
  questionPoints?: Record<number, number>;
  gradedAt?: string;
  reviewedAt?: string;
  score?: number;
  teacherFeedback?: string;
};

export type ReadingNote = {
  id: string;
  studentId: string;
  testId: string;
  testTitle: string;
  context: string;
  quote?: string;
  text: string;
  createdAt: string;
};

export const STUDENTS_STORAGE_KEY = "libaria-students";
export const SELECTED_STUDENT_STORAGE_KEY = "libaria-selected-student";
export const EXAMS_STORAGE_KEY = "libaria-exam-assignments";
export const CUSTOM_TESTS_STORAGE_KEY = "libaria-custom-reading-tests";
export const READING_NOTES_STORAGE_KEY = "libaria-reading-notes";
export const TEACHING_POINTER_STORAGE_KEY = "libaria-teaching-pointer";
export const DEFAULT_STUDENT_ID = "student-default";

export function studentProgressKey(studentId: string) {
  return "libaria-progress-" + studentId;
}

export function studentNotesKey(studentId: string) {
  return READING_NOTES_STORAGE_KEY + "-" + studentId;
}

export const emptyStudentProgress: StudentProgress = {
  read: [],
  readsStarted: [],
  saved: [],
  testsDone: [],
  testsCompletedAt: {},
  testsStarted: [],
  testScores: {},
  testDrafts: {},
};

