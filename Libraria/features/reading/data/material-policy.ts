import type { ExamAssignment } from "@/features/classroom/data-model";

type PublishableMaterial = { status?: string };
type AudienceMaterial = { visibility?: "all" | "students" | "groups"; studentId?: string; studentIds?: string[]; groupNames?: string[] };
type StudentAudience = { id: string; groupName?: string };

export function isPublishedMaterial(material: PublishableMaterial): boolean {
  return material.status === "published";
}

export function canStudentAccessMaterial(material: AudienceMaterial, studentId: string, student?: StudentAudience): boolean {
  if (material.visibility === "all") return true;
  if (material.visibility === "groups") return Boolean(student?.groupName && material.groupNames?.includes(student.groupName));
  if (material.visibility === "students") return Boolean(material.studentIds?.includes(studentId));
  return !material.studentId || material.studentId === studentId;
}

export function canStudentOpenExam(assignment: ExamAssignment, studentId: string, material: PublishableMaterial, now: number): boolean {
  if (assignment.studentId !== studentId || !isPublishedMaterial(material)) return false;
  if (assignment.gradedAt) return true;
  if (assignment.completedAt) return false;
  const startsAt = new Date(assignment.startsAt).getTime();
  const endsAt = Math.min(
    startsAt + assignment.durationMinutes * 60_000,
    assignment.closesAt ? new Date(assignment.closesAt).getTime() : Number.POSITIVE_INFINITY,
  );
  return Number.isFinite(startsAt) && now >= startsAt && now < endsAt;
}
