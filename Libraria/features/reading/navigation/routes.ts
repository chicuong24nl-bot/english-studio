export type PracticeStep = "home" | "test" | "section" | "setup";

export const teacherTabs = ["students", "materials", "teach", "exams", "settings"] as const;

export type PracticeLocation = { step: PracticeStep; path: string; testId: string; sections: number[]; count: number };

const staticPaths = new Set([
  "/", "/library", "/profile", "/settings", "/teacher", "/teacher/style",
  "/exams", "/demo", "/practice", "/practice/tests", "/practice/sections",
  "/practice/setup", "/flashcards",
]);

export function decodeRouteSegments(path: string): string[] | null {
  try {
    return path.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  } catch {
    return null;
  }
}

export function isKnownAppPath(path: string, segments: string[], testIds: ReadonlySet<string>, assignmentIds: ReadonlySet<string>): boolean {
  if (staticPaths.has(path)) return true;
  if (segments[0] === "teacher" && segments.length === 2 && teacherTabs.includes(segments[1] as typeof teacherTabs[number])) return true;
  if (segments.length === 2 && segments[0] === "reading" && testIds.has(segments[1])) return true;
  return segments.length === 2 && segments[0] === "exam" && assignmentIds.has(segments[1]);
}

export function practicePath(step: PracticeStep): string {
  return ({ home: "/practice", test: "/practice/tests", section: "/practice/sections", setup: "/practice/setup" })[step];
}

export function parsePracticeLocation(pathname: string, search: string): PracticeLocation {
  const path = pathname.replace(/\/+$/, "") || "/";
  const params = new URLSearchParams(search);
  const legacyStep = ({ "choose-test": "test", "choose-section": "section", "deck-setup": "setup" } as const)[params.get("practice") as "choose-test" | "choose-section" | "deck-setup"];
  const pathStep: Record<string, PracticeStep> = { "/practice/tests": "test", "/practice/sections": "section", "/practice/setup": "setup" };
  const rawSections = params.get("sections");
  const sections = rawSections === null ? [1] : rawSections.split(",").map(Number).filter((section) => Number.isInteger(section) && section > 0);
  const count = Number(params.get("count"));
  return {
    step: pathStep[path] ?? legacyStep ?? "home",
    path,
    testId: params.get("test") ?? "",
    sections: [...new Set(sections)],
    count: Number.isInteger(count) && count > 0 ? count : 12,
  };
}
