import "server-only";
import { getAI, type Excerpt, type GeneratedQuestion, type Mode } from "./ai";
import { config, isDemo } from "./config";
import { extractSections, type DocKind } from "./parse";
import * as repo from "./repo";
import { chunkSections, sectionsFromText, type Section } from "./text";

// ─── Ingestion ──────────────────────────────────────────────
export type IngestInput = { filename: string; kind: DocKind; data: Uint8Array };

export async function ingestDocument(uid: string, subjectId: string, input: IngestInput) {
  const subject = await repo.getSubject(uid, subjectId);
  if (!subject) throw new Error("Subject not found.");
  const sections = input.kind === "text" ? sectionsFromText(new TextDecoder().decode(input.data)) : await extractSections(input.kind, input.data);
  const charCount = sections.reduce((a, s) => a + s.text.length, 0);
  if (charCount < 40) {
    throw new Error(
      input.kind === "pdf"
        ? "No text found in that PDF. If it's scanned images, export it with text (OCR) or paste the notes instead."
        : "No text found in that file.",
    );
  }

  const storagePath = await storeOriginal(uid, input);
  const docId = await repo.createDocument(uid, subjectId, { filename: input.filename, kind: input.kind, storage_path: storagePath, char_count: charCount });

  const ai = await getAI();
  let topics = await ai.extractTopics(subject.name, sections);
  if (topics.length === 0) topics = [{ title: input.filename.replace(/\.\w+$/, ""), summary: "", labels: sections.map((s) => s.label), concepts: [] }];

  // Create topics (appended after any existing ones) and their concepts.
  let pos = (await repo.maxTopicPosition(uid, subjectId)) + 1;
  const labelToTopic = new Map<string, string>();
  const topicIds: string[] = [];
  for (const t of topics) {
    const id = await repo.createTopic(uid, subjectId, { title: t.title.slice(0, 120), summary: t.summary.slice(0, 400), position: pos++ });
    topicIds.push(id);
    for (const l of t.labels) if (!labelToTopic.has(l)) labelToTopic.set(l, id);
    for (const c of t.concepts.slice(0, 6)) await repo.createConcept(uid, id, { name: c.name.slice(0, 80), description: c.description.slice(0, 400) });
  }

  // Chunk, attach each chunk to its topic (unlabeled sections follow the previous one), embed, store.
  let current = topicIds[0];
  const assigned = sections.map((s) => {
    current = labelToTopic.get(s.label) ?? current;
    return { ...s, topicId: current };
  });
  const chunks = assigned.flatMap((s) => chunkSections([s]).map((c) => ({ ...c, topicId: s.topicId })));
  const vectors = await ai.embed(chunks.map((c) => `${c.label}\n${c.text}`), "document");
  await repo.insertChunks(
    uid,
    subjectId,
    docId,
    chunks.map((c, i) => ({ topic_id: c.topicId, source_label: c.label, content: c.text, position: i, embedding: vectors[i], model: ai.embedModel })),
  );
  return { documentId: docId, topicCount: topicIds.length, chunkCount: chunks.length };
}

async function storeOriginal(uid: string, input: IngestInput): Promise<string | null> {
  if (isDemo() || !config.supabaseServiceKey) return null;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(config.supabaseUrl, config.supabaseServiceKey, { auth: { persistSession: false } });
    const path = `${uid}/${Date.now()}-${input.filename.replace(/[^\w.-]+/g, "_")}`;
    const { error } = await admin.storage.from("uploads").upload(path, input.data, { upsert: false });
    return error ? null : path;
  } catch {
    return null;
  }
}

// ─── Retrieval ──────────────────────────────────────────────
export async function retrieve(uid: string, subjectId: string, topicId: string | null, query: string, k = 6): Promise<Excerpt[]> {
  const ai = await getAI();
  // Re-embed anything made by another model (e.g. you added a Gemini key after using demo mode).
  const stale = await repo.staleChunks(uid, subjectId, ai.embedModel);
  if (stale.length) {
    const vs = await ai.embed(stale.map((s) => s.content), "document");
    for (let i = 0; i < stale.length; i++) await repo.setChunkEmbedding(stale[i].id, vs[i], ai.embedModel);
  }
  const [v] = await ai.embed([query], "query");
  const rows = await repo.searchChunks(uid, subjectId, topicId, v, k);
  return rows.map((r) => ({ label: r.source_label, text: r.content, score: r.score }));
}

const toExcerpts = (chunks: repo.Chunk[]): Excerpt[] => chunks.map((c) => ({ label: c.source_label, text: c.content }));

// ─── Tutor ──────────────────────────────────────────────────
export async function tutorTurn(uid: string, sessionId: string, userText: string | null) {
  const session = await repo.getSession(uid, sessionId);
  if (!session) throw new Error("Chat not found.");
  const topic = await repo.getTopic(uid, session.topic_id);
  if (!topic) throw new Error("Topic not found.");
  const [concepts, history, topicChunks] = await Promise.all([
    repo.listConcepts(uid, topic.id),
    repo.listMessages(uid, sessionId),
    repo.topicChunks(uid, topic.id),
  ]);
  if (userText !== null) await repo.addMessage(uid, sessionId, { role: "user", content: userText });

  const recent = history.slice(-2).map((m) => m.content).join("\n");
  const material = userText === null ? toExcerpts(topicChunks).slice(0, 6) : await retrieve(uid, topic.subject_id, topic.id, `${topic.title}\n${recent}\n${userText}`, 6);

  const ai = await getAI();
  const turn = await ai.tutor({
    mode: session.mode as Mode,
    topic: { title: topic.title, summary: topic.summary },
    concepts: concepts.map((c) => ({ name: c.name, description: c.description })),
    material,
    topicMaterial: toExcerpts(topicChunks),
    history: history.map((m) => ({ role: m.role, content: m.content, meta: m.meta })),
    userText,
  });
  // Only keep citations that point at real source labels.
  const known = new Set([...material, ...toExcerpts(topicChunks)].map((m) => m.label));
  const citations = [...new Set(turn.citations.filter((c) => known.has(c)))];
  return repo.addMessage(uid, sessionId, { role: "assistant", content: turn.reply, citations, meta: turn.state });
}

export async function openSession(uid: string, topicId: string, mode: Mode, fresh = false) {
  const existing = fresh ? null : await repo.latestSession(uid, topicId, mode);
  if (existing) return existing;
  const s = await repo.createSession(uid, topicId, mode);
  await tutorTurn(uid, s.id, null);
  return s;
}

// ─── Quick Checks ───────────────────────────────────────────
export async function ensureQuestions(uid: string, topicId: string, regenerate = false) {
  const existing = await repo.topicQuestions(uid, topicId);
  if (existing.length >= 5 && !regenerate) return existing;
  const topic = await repo.getTopic(uid, topicId);
  if (!topic) throw new Error("Topic not found.");
  const [concepts, chunks] = await Promise.all([repo.listConcepts(uid, topicId), repo.topicChunks(uid, topicId)]);
  if (chunks.length === 0) return existing;
  const ai = await getAI();
  const generated = await ai.generateQuestions({ topicTitle: topic.title, concepts: concepts.map((c) => c.name), material: toExcerpts(chunks), count: 7 });
  const valid = generated.filter(validQuestion).slice(0, 8);
  if (valid.length === 0) return existing;
  if (regenerate) await repo.deleteTopicQuestions(uid, topicId);

  // Make sure every question has a concept (create one from the topic if the outline has none).
  let fallbackConcept = concepts[0]?.id;
  if (!fallbackConcept) fallbackConcept = await repo.createConcept(uid, topicId, { name: topic.title, description: topic.summary });
  const byName = new Map(concepts.map((c) => [c.name.toLowerCase(), c.id]));
  for (const g of valid) {
    await repo.insertQuestion(uid, topicId, {
      concept_id: byName.get(g.concept.toLowerCase()) ?? fallbackConcept,
      type: g.type,
      prompt: g.prompt,
      options: g.type === "tf" ? ["true", "false"] : g.options,
      answer: g.type === "tf" ? g.answer.toLowerCase() : g.answer,
      accept: g.accept,
      hint: g.hint,
      explanation: g.explanation,
      source_label: g.source_label,
    });
  }
  return repo.topicQuestions(uid, topicId);
}

function validQuestion(g: GeneratedQuestion): boolean {
  if (!g.prompt.trim() || !g.answer.trim()) return false;
  if (g.type === "mcq" || g.type === "spot_error") return g.options.length >= 2 && g.options.some((o) => o.trim() === g.answer.trim());
  if (g.type === "tf") return ["true", "false"].includes(g.answer.toLowerCase());
  if (g.type === "fill") return g.prompt.includes("_____");
  return false;
}

// ─── Traps & look-alikes ────────────────────────────────────
export async function buildTraps(uid: string, subjectId: string, force = false) {
  const subject = await repo.getSubject(uid, subjectId);
  if (!subject) throw new Error("Subject not found.");
  if (subject.traps_md && !force) return subject.traps_md;
  const [concepts, missed, chunks] = await Promise.all([repo.subjectConcepts(uid, subjectId), repo.missedQuestions(uid, subjectId), repo.subjectChunks(uid, subjectId)]);
  const weak = concepts.filter((c) => c.mastery < 60).sort((a, b) => a.mastery - b.mastery).map((c) => c.name).slice(0, 6);
  const ai = await getAI();
  const md = await ai.traps({
    subjectName: subject.name,
    weak,
    missed: missed.map((m) => `${m.prompt} → correct: ${m.answer}. ${m.explanation}`),
    material: toExcerpts(chunks),
    concepts: concepts.map((c) => ({ topic: c.topic_title, name: c.name, description: c.description })),
  });
  await repo.saveTraps(uid, subjectId, md);
  return md;
}

export type { Section };
