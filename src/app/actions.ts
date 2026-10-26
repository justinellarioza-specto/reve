"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { userId } from "@/lib/auth";
import { isDemo } from "@/lib/config";
import { isCorrect } from "@/lib/grade";
import { kindFromName } from "@/lib/parse";
import * as repo from "@/lib/repo";
import { buildTraps, ensureQuestions, ingestDocument, openSession } from "@/lib/services";
import type { Mode } from "@/lib/ai";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const COLORS = ["#E36414", "#2563EB", "#0F766E", "#7C3AED", "#BE185D", "#B45309"];

function subjectFields(f: FormData) {
  const name = str(f, "name").slice(0, 80);
  const color = COLORS.includes(str(f, "color")) ? str(f, "color") : COLORS[0];
  const exam = str(f, "exam_date");
  return { name, color, exam_date: /^\d{4}-\d{2}-\d{2}$/.test(exam) ? exam : null };
}

export type FormState = { error?: string; ok?: string } | null;

// ─── Subjects ───────────────────────────────────────────────
export async function createSubjectAction(_: FormState, f: FormData): Promise<FormState> {
  const uid = await userId();
  const data = subjectFields(f);
  if (!data.name) return { error: "Give the subject a name." };
  const id = await repo.createSubject(uid, data);
  redirect(`/subjects/${id}/upload`);
}

export async function updateSubjectAction(id: string, _: FormState, f: FormData): Promise<FormState> {
  const uid = await userId();
  const data = subjectFields(f);
  if (!data.name) return { error: "Give the subject a name." };
  await repo.updateSubject(uid, id, data);
  redirect(`/subjects/${id}`);
}

export async function deleteSubjectAction(id: string) {
  await repo.deleteSubject(await userId(), id);
  redirect("/");
}

// ─── Uploads ────────────────────────────────────────────────
const MAX_BYTES = 20 * 1024 * 1024;

export async function uploadAction(subjectId: string, _: FormState, f: FormData): Promise<FormState> {
  const uid = await userId();
  const files = f.getAll("files").filter((x): x is File => x instanceof File && x.size > 0);
  const text = str(f, "text");
  if (files.length === 0 && !text) return { error: "Choose a file or paste some notes first." };

  let topics = 0;
  try {
    for (const file of files) {
      const kind = kindFromName(file.name, file.type);
      if (!kind) return { error: `${file.name}: Reve reads PDF, PPTX, DOCX and text files. Save older .ppt/.doc files in the newer format first.` };
      if (file.size > MAX_BYTES) return { error: `${file.name} is over 20 MB. Split it into smaller files.` };
      const res = await ingestDocument(uid, subjectId, { filename: file.name, kind, data: new Uint8Array(await file.arrayBuffer()) });
      topics += res.topicCount;
    }
    if (text) {
      const title = str(f, "title") || "Pasted notes";
      const res = await ingestDocument(uid, subjectId, { filename: title, kind: "text", data: new TextEncoder().encode(text) });
      topics += res.topicCount;
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong reading that file." };
  }
  revalidatePath(`/subjects/${subjectId}`);
  redirect(`/subjects/${subjectId}/outline?added=${topics}`);
}

// ─── Outline editing ────────────────────────────────────────
export async function updateTopicAction(subjectId: string, topicId: string, f: FormData) {
  const title = str(f, "title").slice(0, 120);
  if (title) await repo.updateTopic(await userId(), topicId, { title, summary: str(f, "summary").slice(0, 400) });
  revalidatePath(`/subjects/${subjectId}/outline`);
}
export async function moveTopicAction(subjectId: string, topicId: string, dir: -1 | 1) {
  await repo.moveTopic(await userId(), topicId, dir);
  revalidatePath(`/subjects/${subjectId}/outline`);
}
export async function deleteTopicAction(subjectId: string, topicId: string) {
  await repo.deleteTopic(await userId(), topicId);
  revalidatePath(`/subjects/${subjectId}/outline`);
}
export async function addTopicAction(subjectId: string, f: FormData) {
  const uid = await userId();
  const title = str(f, "title").slice(0, 120);
  if (title) await repo.createTopic(uid, subjectId, { title, summary: "", position: (await repo.maxTopicPosition(uid, subjectId)) + 1 });
  revalidatePath(`/subjects/${subjectId}/outline`);
}
export async function addConceptAction(subjectId: string, topicId: string, f: FormData) {
  const name = str(f, "name").slice(0, 80);
  if (name) await repo.createConcept(await userId(), topicId, { name, description: str(f, "description").slice(0, 400) });
  revalidatePath(`/subjects/${subjectId}/outline`);
}
export async function updateConceptAction(subjectId: string, conceptId: string, f: FormData) {
  const name = str(f, "name").slice(0, 80);
  if (name) await repo.updateConcept(await userId(), conceptId, { name, description: str(f, "description").slice(0, 400) });
  revalidatePath(`/subjects/${subjectId}/outline`);
}
export async function deleteConceptAction(subjectId: string, conceptId: string) {
  await repo.deleteConcept(await userId(), conceptId);
  revalidatePath(`/subjects/${subjectId}/outline`);
}

// ─── Quick Checks & reviews ─────────────────────────────────
export type GradeResult = { correct: boolean; answer: string; explanation: string; source_label: string; mastery: number | null };

export async function gradeAnswerAction(input: { questionId: string; given: string; hintsUsed: number; timeMs: number; mode: "check" | "review" | "mixed" }): Promise<GradeResult> {
  const uid = await userId();
  const q = await repo.getQuestion(uid, input.questionId);
  if (!q) throw new Error("Question not found.");
  const correct = isCorrect(q, input.given);
  const res = await repo.recordAttempt(uid, {
    question_id: q.id,
    concept_id: q.concept_id,
    correct,
    time_ms: input.timeMs,
    hints_used: Math.max(0, Math.min(5, input.hintsUsed)),
    mode: input.mode,
  });
  return { correct, answer: q.type === "tf" ? (q.answer === "true" ? "True" : "False") : q.answer, explanation: q.explanation, source_label: q.source_label, mastery: res?.mastery ?? null };
}

export async function regenerateQuestionsAction(topicId: string) {
  await ensureQuestions(await userId(), topicId, true);
  revalidatePath(`/topics/${topicId}`);
  redirect(`/topics/${topicId}/check`);
}

export async function regenerateTrapsAction(subjectId: string) {
  await buildTraps(await userId(), subjectId, true);
  revalidatePath(`/subjects/${subjectId}/traps`);
}

// ─── Chat ───────────────────────────────────────────────────
export async function newChatAction(topicId: string, mode: Mode) {
  await openSession(await userId(), topicId, mode, true);
  redirect(`/topics/${topicId}/learn?mode=${mode}`);
}

// ─── Auth ───────────────────────────────────────────────────
export async function signOutAction() {
  if (!isDemo()) {
    const { supabaseServer } = await import("@/lib/supabase/server");
    await (await supabaseServer()).auth.signOut();
  }
  redirect("/login");
}
