export const SHARED_CLASSROOM_KEYS = [
  "libaria-students",
  "libaria-exam-assignments",
  "libaria-custom-reading-tests",
  "libaria-teaching-pointer",
] as const;

export function isSharedStateKey(key: string): boolean {
  return SHARED_CLASSROOM_KEYS.includes(key as typeof SHARED_CLASSROOM_KEYS[number])
    || /^libaria-progress-[\w-]+$/.test(key)
    || /^libaria-reading-notes-[\w-]+$/.test(key)
    || /^libaria-flashcards-[\w-]+$/.test(key);
}

export function isStudentOwnedStateKey(key: string, studentId: string): boolean {
  return key === `libaria-progress-${studentId}`
    || key === `libaria-reading-notes-${studentId}`
    || key.startsWith(`libaria-flashcards-${studentId}-`);
}
