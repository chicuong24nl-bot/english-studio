export const SHARED_CLASSROOM_KEYS = [
  "libaria-students",
  "libaria-exam-assignments",
  "libaria-custom-reading-tests",
  "libaria-teaching-pointer",
] as const;

export function persistSharedClassroomValue(key: string, value: string) {
  localStorage.setItem(key, value);
  window.dispatchEvent(new CustomEvent("libaria:shared-classroom-write", { detail: { key, value } }));
}

export function collectLocalClassroomState() {
  const data: Record<string, string> = {};
  for (const key of SHARED_CLASSROOM_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) data[key] = value;
  }
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) continue;
    if (/^libaria-progress-[\w-]+$/.test(key) || /^libaria-reading-notes-[\w-]+$/.test(key) || /^libaria-flashcards-[\w-]+$/.test(key)) {
      const value = localStorage.getItem(key);
      if (value !== null) data[key] = value;
    }
  }
  return data;
}
