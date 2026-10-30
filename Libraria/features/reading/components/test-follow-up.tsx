"use client";

import { useState } from "react";
import { Clipboard, Eye, Users } from "lucide-react";
import type { ReadingTest } from "@/features/reading/data/reading-tests";
import type { ExamAssignment, StudentProfile } from "@/features/classroom/data-model";

type Theme = { page: string; surface: string; ink: string; muted: string; border: string; accent: string; onAccent: string };

export function IELTSTestFollowUp({ tests, assignments, students, theme, onReview }: {
  tests: ReadingTest[];
  assignments: ExamAssignment[];
  students: StudentProfile[];
  theme: Theme;
  onReview: (assignment: ExamAssignment) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const ieltsTests = tests.filter((test) => test.kind === "ielts" && test.status !== "draft" && assignments.some((assignment) => assignment.testId === test.id));
  if (!ieltsTests.length) return null;

  const copyReminder = async (test: ReadingTest) => {
    const due = test.closesAt ? ` Please complete it before ${new Date(test.closesAt).toLocaleString()}.` : " Please complete it soon.";
    try {
      await navigator.clipboard.writeText(`A new IELTS Reading test is available: ${test.title}.${due}`);
      setCopiedId(test.id);
      window.setTimeout(() => setCopiedId((current) => current === test.id ? null : current), 2200);
    } catch {
      setCopiedId(null);
    }
  };
  const card = { borderColor: theme.border, background: theme.surface };
  const buttonStyle = { borderColor: theme.border, color: theme.accent };

  return <section className="rounded-3xl border p-5 sm:p-7" style={card}>
    <div className="mb-5 flex items-center gap-2"><Users size={18} style={{ color: theme.accent }} /><div><h2 className="font-serif text-2xl font-semibold">IELTS test follow-up</h2><p className="mt-1 text-sm" style={{ color: theme.muted }}>Preview, track submissions, and review scores for each test.</p></div></div>
    <div className="space-y-3">{ieltsTests.map((test) => {
      const submissions = assignments.filter((assignment) => assignment.testId === test.id);
      const started = submissions.filter((assignment) => Boolean(assignment.startedAt || assignment.completedAt));
      const submitted = submissions.filter((assignment) => Boolean(assignment.completedAt));
      const graded = submitted.filter((assignment) => Boolean(assignment.gradedAt));
      const expanded = expandedId === test.id;
      const preview = previewId === test.id;
      return <article key={test.id} className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: theme.border }}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-serif text-xl font-semibold">{test.title}</h3><p className="mt-1 text-xs font-semibold uppercase tracking-wider" style={{ color: theme.muted }}>Phase {test.phase ?? 1} · {test.minutes > 0 ? `${test.minutes} minutes · ` : "No time limit · "}{test.passages?.length ?? 1} passage{(test.passages?.length ?? 1) === 1 ? "" : "s"} · {test.questions.length} questions</p><p className="mt-2 text-sm font-semibold" style={{ color: theme.ink }}>{started.length} started · {submitted.length} submitted · {graded.length} graded</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setPreviewId(preview ? null : test.id)} className="inline-flex min-h-10 items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold" style={buttonStyle}><Eye size={14} />{preview ? "Close preview" : "Preview as student"}</button><button type="button" onClick={() => setExpandedId(expanded ? null : test.id)} className="rounded-full border px-3 py-2 text-xs font-bold" style={buttonStyle}>{expanded ? "Hide progress" : "Monitor progress"}</button><button type="button" onClick={() => void copyReminder(test)} className="inline-flex min-h-10 items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold" style={buttonStyle}><Clipboard size={14} />{copiedId === test.id ? "Reminder copied" : "Copy reminder"}</button></div></div>
        {preview && <div className="mt-4 space-y-3 rounded-2xl p-4" style={{ background: theme.page, color: theme.ink }}><p className="text-sm font-semibold">Student preview · {test.minutes > 0 ? `${test.minutes} minutes` : "No time limit"} · {test.questions.length} questions</p><p className="text-xs leading-5" style={{ color: theme.muted }}>Read each passage and answer every question. A time limit applies only if this test is assigned as an exam.</p>{(test.passages ?? [{ title: "Reading passage", text: test.passage }]).map((passage, index) => <div key={index} className="rounded-xl border p-3" style={{ borderColor: theme.border, background: theme.surface }}><p className="font-serif text-lg font-semibold">{passage.title}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{passage.text}</p></div>)}<div className="space-y-2">{test.questions.map((question, index) => <div key={index} className="rounded-xl border p-3" style={{ borderColor: theme.border, background: theme.surface }}><p className="text-sm font-semibold">{(test.questionNumberStart ?? 1) + index}. {question.prompt}</p>{question.options.length > 0 && <ul className="mt-2 list-inside list-disc space-y-1 text-sm" style={{ color: theme.muted }}>{question.options.map((option) => <li key={option}>{option}</li>)}</ul>}</div>)}</div></div>}
        {expanded && <div className="mt-4 space-y-4 border-t pt-4" style={{ borderColor: theme.border }}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[["Assigned", submissions.length], ["Started", started.length], ["Submitted", submitted.length], ["Awaiting review", submitted.length - graded.length]].map(([label, value]) => <div key={label} className="rounded-xl p-3" style={{ background: theme.page }}><p className="text-xs" style={{ color: theme.muted }}>{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>)}</div>
          <div className="space-y-2">{submissions.map((assignment) => { const student = students.find((item) => item.id === assignment.studentId); const status = assignment.gradedAt ? `Graded · ${assignment.score ?? 0}/${test.questions.length}` : assignment.completedAt ? "Submitted · needs review" : assignment.startedAt ? "In progress" : "Not started"; return <div key={assignment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3" style={{ borderColor: theme.border }}><div><p className="text-sm font-semibold">{student?.name ?? "Student"}</p><p className="text-xs" style={{ color: theme.muted }}>{status}</p></div>{assignment.completedAt && <button type="button" onClick={() => onReview(assignment)} className="rounded-full border px-3 py-2 text-xs font-bold" style={buttonStyle}>{assignment.gradedAt ? "View grade" : "Review & grade"}</button>}</div>; })}{!submissions.length && <p className="text-sm" style={{ color: theme.muted }}>No student assignments yet.</p>}</div>
          {graded.length > 0 && <div><h4 className="mb-2 text-sm font-bold">Questions students missed most</h4><div className="space-y-2">{test.questions.map((question, index) => { const missed = graded.filter((assignment) => (assignment.questionPoints?.[index] ?? 0) === 0).length; return <div key={index} className="flex items-center justify-between gap-3 text-sm"><span>{(test.questionNumberStart ?? 1) + index}. {question.prompt}</span><span className="shrink-0 font-semibold" style={{ color: theme.muted }}>{missed}/{graded.length} missed</span></div>; })}</div></div>}
        </div>}
      </article>;
    })}</div>
  </section>;
}
