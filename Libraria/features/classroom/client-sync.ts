import { isSharedStateKey, SHARED_CLASSROOM_KEYS } from "@/features/classroom/state-keys";

export { SHARED_CLASSROOM_KEYS };

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
    if (!key || !isSharedStateKey(key) || SHARED_CLASSROOM_KEYS.includes(key as typeof SHARED_CLASSROOM_KEYS[number])) continue;
    const value = localStorage.getItem(key);
    if (value !== null) data[key] = value;
  }
  return data;
}
