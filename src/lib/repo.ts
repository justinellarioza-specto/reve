import "server-only";
import { getDb, toVector } from "./db";
import type { TutorState } from "./ai/types";
import { NEW_SCHEDULE, nextMastery, nextSchedule, qualityFrom, type Schedule } from "./srs";

// ─── Row types ──────────────────────────────────────────────
export type Subject = { id: string; name: string; color: string; exam_date: string | null; traps_md: string | null; created_at: Date };
export type SubjectWithStats = Subject & { topic_count: number; mastery: number; due_count: number };
export type Topic = { id: string; subject_id: string; title: string; summary: string; position: number };
export type TopicWithStats = Topic & { mastery: number; concept_count: number; question_count: number; attempted: boolean };
export type Concept = { id: string; topic_id: string; name: string; description: string; mastery: number };
export type Question = {
  id: string;
  topic_id: string;
  concept_id: string | null;
  type: "mcq" | "tf" | "fill" | "spot_error";
  prompt: string;
  options: string[];
  answer: string;
  accept: string[];
  hint: string;
  explanation: string;
  source_label: string;
};
export type Chunk = { id: string; topic_id: string | null; source_label: string; content: string; position: number };
export type Message = { id: string; role: "user" | "assistant"; content: string; citations: string[]; meta: TutorState; created_at: Date };
export type ChatSession = { id: string; topic_id: string; mode: "teach" | "quiz" | "explain"; created_at: Date };

const q = async <T>(sql: string, params: unknown[] = []) => (await getDb()).query<T>(sql, params);
const one = async <T>(sql: string, params: unknown[] = []) => (await q<T>(sql, params))[0] ?? null;

const SUBJECT_COLS = `s.id, s.name, s.color, to_char(s.exam_date, 'YYYY-MM-DD') as exam_date, s.traps_md, s.created_at`;

// ─── Users ──────────────────────────────────────────────────
export async function ensureUser(id: string, email: string | null) {
  // Atomic: only the request that actually inserts the row sees isNew (so seeding happens once).
  const inserted = await one<{ id: string }>(`insert into users (id, email) values ($1, $2) on conflict (id) do nothing returning id`, [id, email]);
  return { isNew: !!inserted };
}

// ─── Subjects ───────────────────────────────────────────────
export async function listSubjects(uid: string, now = new Date()): Promise<SubjectWithStats[]> {
  return q<SubjectWithStats>(
    `select ${SUBJECT_COLS},
       (select count(*)::int from topics t where t.subject_id = s.id) as topic_count,
       coalesce((select round(avg(c.mastery))::int from concepts c join topics t on t.id = c.topic_id where t.subject_id = s.id), 0) as mastery,
       (select count(*)::int from review_schedule r join concepts c on c.id = r.concept_id join topics t on t.id = c.topic_id
          where t.subject_id = s.id and r.due_at <= $2) as due_count
     from subjects s where s.user_id = $1
     order by s.exam_date asc nulls last, s.created_at asc`,
    [uid, now],
  );
}

export const getSubject = (uid: string, id: string) =>
  one<Subject>(`select ${SUBJECT_COLS} from subjects s where s.user_id = $1 and s.id = $2`, [uid, id]);

export async function createSubject(uid: string, data: { name: string; color: string; exam_date: string | null }) {
  return (await one<{ id: string }>(`insert into subjects (user_id, name, color, exam_date) values ($1, $2, $3, $4) returning id`, [
    uid,
    data.name,
    data.color,
    data.exam_date,
  ]))!.id;
}

export const updateSubject = (uid: string, id: string, data: { name: string; color: string; exam_date: string | null }) =>
  q(`update subjects set name = $3, color = $4, exam_date = $5 where user_id = $1 and id = $2`, [uid, id, data.name, data.color, data.exam_date]);

export const deleteSubject = (uid: string, id: string) => q(`delete from subjects where user_id = $1 and id = $2`, [uid, id]);

export const saveTraps = (uid: string, id: string, md: string) =>
  q(`update subjects set traps_md = $3, traps_at = now() where user_id = $1 and id = $2`, [uid, id, md]);

// ─── Documents & chunks ─────────────────────────────────────
export async function createDocument(uid: string, subjectId: string, d: { filename: string; kind: string; storage_path: string | null; char_count: number }) {
  return (await one<{ id: string }>(
    `insert into documents (user_id, subject_id, filename, kind, storage_path, char_count) values ($1,$2,$3,$4,$5,$6) returning id`,
    [uid, subjectId, d.filename, d.kind, d.storage_path, d.char_count],
  ))!.id;
}

export const listDocuments = (uid: string, subjectId: string) =>
  q<{ id: string; filename: string; kind: string; char_count: number; created_at: Date }>(
    `select id, filename, kind, char_count, created_at from documents where user_id = $1 and subject_id = $2 order by created_at`,
    [uid, subjectId],
  );

export async function insertChunks(
  uid: string,
  subjectId: string,
  documentId: string | null,
  rows: { topic_id: string | null; source_label: string; content: string; position: number; embedding: number[]; model: string }[],
) {
  for (const r of rows) {
    await q(
      `insert into chunks (user_id, subject_id, document_id, topic_id, source_label, content, position, embedding, embedding_model)
       values ($1,$2,$3,$4,$5,$6,$7,$8::vector,$9)`,
      [uid, subjectId, documentId, r.topic_id, r.source_label, r.content, r.position, toVector(r.embedding), r.model],
    );
  }
}

export const topicChunks = (uid: string, topicId: string) =>
  q<Chunk>(`select id, topic_id, source_label, content, position from chunks where user_id = $1 and topic_id = $2 order by position`, [uid, topicId]);

export const subjectChunks = (uid: string, subjectId: string) =>
  q<Chunk>(`select id, topic_id, source_label, content, position from chunks where user_id = $1 and subject_id = $2 order by position`, [uid, subjectId]);

/** Chunks whose embedding was made by a different model (e.g. demo → Gemini switch). */
export const staleChunks = (uid: string, subjectId: string, model: string) =>
  q<{ id: string; content: string }>(
    `select id, content from chunks where user_id = $1 and subject_id = $2 and (embedding_model is distinct from $3 or embedding is null)`,
    [uid, subjectId, model],
  );

export const setChunkEmbedding = (id: string, v: number[], model: string) =>
  q(`update chunks set embedding = $2::vector, embedding_model = $3 where id = $1`, [id, toVector(v), model]);

/** Vector search within a subject; chunks of the current topic get a small boost. */
export const searchChunks = (uid: string, subjectId: string, topicId: string | null, v: number[], k = 6) =>
  q<Chunk & { score: number }>(
    `select id, topic_id, source_label, content, position,
       (1 - (embedding <=> $3::vector))::float8 + case when topic_id = $4 then 0.05 else 0 end as score
     from chunks where user_id = $1 and subject_id = $2 and embedding is not null
     order by score desc limit $5`,
    [uid, subjectId, toVector(v), topicId, k],
  );

// ─── Topics & concepts ──────────────────────────────────────
export const listTopics = (uid: string, subjectId: string) =>
  q<TopicWithStats>(
    `select t.id, t.subject_id, t.title, t.summary, t.position,
       coalesce((select round(avg(c.mastery))::int from concepts c where c.topic_id = t.id), 0) as mastery,
       (select count(*)::int from concepts c where c.topic_id = t.id) as concept_count,
       (select count(*)::int from questions x where x.topic_id = t.id) as question_count,
       exists(select 1 from attempts a join questions x on x.id = a.question_id where x.topic_id = t.id) as attempted
     from topics t where t.user_id = $1 and t.subject_id = $2 order by t.position, t.created_at`,
    [uid, subjectId],
  );

export const getTopic = (uid: string, id: string) =>
  one<Topic & { subject_name: string; subject_color: string }>(
    `select t.id, t.subject_id, t.title, t.summary, t.position, s.name as subject_name, s.color as subject_color
     from topics t join subjects s on s.id = t.subject_id where t.user_id = $1 and t.id = $2`,
    [uid, id],
  );

export async function createTopic(uid: string, subjectId: string, d: { title: string; summary: string; position: number }) {
  return (await one<{ id: string }>(`insert into topics (user_id, subject_id, title, summary, position) values ($1,$2,$3,$4,$5) returning id`, [
    uid,
    subjectId,
    d.title,
    d.summary,
    d.position,
  ]))!.id;
}

export const updateTopic = (uid: string, id: string, d: { title: string; summary: string }) =>
  q(`update topics set title = $3, summary = $4 where user_id = $1 and id = $2`, [uid, id, d.title, d.summary]);

export const deleteTopic = (uid: string, id: string) => q(`delete from topics where user_id = $1 and id = $2`, [uid, id]);

export async function moveTopic(uid: string, id: string, dir: -1 | 1) {
  const t = await getTopic(uid, id);
  if (!t) return;
  const list = await listTopics(uid, t.subject_id);
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  for (let k = 0; k < list.length; k++) await q(`update topics set position = $2 where id = $1`, [list[k].id, k]);
}

export const maxTopicPosition = async (uid: string, subjectId: string) =>
  (await one<{ p: number }>(`select coalesce(max(position), -1)::int as p from topics where user_id = $1 and subject_id = $2`, [uid, subjectId]))!.p;

export const listConcepts = (uid: string, topicId: string) =>
  q<Concept>(`select id, topic_id, name, description, mastery from concepts where user_id = $1 and topic_id = $2 order by created_at, name`, [uid, topicId]);

export const subjectConcepts = (uid: string, subjectId: string) =>
  q<Concept & { topic_title: string }>(
    `select c.id, c.topic_id, c.name, c.description, c.mastery, t.title as topic_title
     from concepts c join topics t on t.id = c.topic_id where c.user_id = $1 and t.subject_id = $2 order by t.position, c.created_at`,
    [uid, subjectId],
  );

export async function createConcept(uid: string, topicId: string, d: { name: string; description: string }) {
  return (await one<{ id: string }>(`insert into concepts (user_id, topic_id, name, description) values ($1,$2,$3,$4) returning id`, [uid, topicId, d.name, d.description]))!.id;
}
export const updateConcept = (uid: string, id: string, d: { name: string; description: string }) =>
  q(`update concepts set name = $3, description = $4 where user_id = $1 and id = $2`, [uid, id, d.name, d.description]);
export const deleteConcept = (uid: string, id: string) => q(`delete from concepts where user_id = $1 and id = $2`, [uid, id]);

// ─── Questions ──────────────────────────────────────────────
const QCOLS = `id, topic_id, concept_id, type, prompt, options, answer, accept, hint, explanation, source_label`;

export const topicQuestions = (uid: string, topicId: string) =>
  q<Question>(`select ${QCOLS} from questions where user_id = $1 and topic_id = $2 order by created_at`, [uid, topicId]);

export const getQuestion = (uid: string, id: string) => one<Question>(`select ${QCOLS} from questions where user_id = $1 and id = $2`, [uid, id]);

export async function insertQuestion(uid: string, topicId: string, x: Omit<Question, "id" | "topic_id">) {
  return (await one<{ id: string }>(
    `insert into questions (user_id, topic_id, concept_id, type, prompt, options, answer, accept, hint, explanation, source_label)
     values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,$9,$10,$11) returning id`,
    [uid, topicId, x.concept_id, x.type, x.prompt, JSON.stringify(x.options), x.answer, JSON.stringify(x.accept), x.hint, x.explanation, x.source_label],
  ))!.id;
}

export const deleteTopicQuestions = (uid: string, topicId: string) => q(`delete from questions where user_id = $1 and topic_id = $2`, [uid, topicId]);

/** One question per concept, least-recently attempted first (for reviews and mixed rounds). */
export async function questionForConcept(uid: string, conceptId: string) {
  return one<Question>(
    `select ${QCOLS.split(", ").map((c) => "x." + c).join(", ")} from questions x
     left join lateral (select max(created_at) as last from attempts a where a.question_id = x.id) a on true
     where x.user_id = $1 and x.concept_id = $2
     order by a.last asc nulls first, random() limit 1`,
    [uid, conceptId],
  );
}

// ─── Attempts, mastery, schedule ────────────────────────────
export async function recordAttempt(
  uid: string,
  a: { question_id: string; concept_id: string | null; correct: boolean; time_ms: number; hints_used: number; mode: "check" | "review" | "mixed" },
  now = new Date(),
) {
  await q(`insert into attempts (user_id, question_id, concept_id, correct, time_ms, hints_used, mode) values ($1,$2,$3,$4,$5,$6,$7)`, [
    uid,
    a.question_id,
    a.concept_id,
    a.correct,
    Math.max(0, Math.round(a.time_ms)),
    a.hints_used,
    a.mode,
  ]);
  if (!a.concept_id) return null;
  const c = await one<{ mastery: number; exam_date: string | null }>(
    `select c.mastery, to_char(s.exam_date, 'YYYY-MM-DD') as exam_date from concepts c join topics t on t.id = c.topic_id join subjects s on s.id = t.subject_id
     where c.user_id = $1 and c.id = $2`,
    [uid, a.concept_id],
  );
  if (!c) return null;
  const mastery = nextMastery(c.mastery, a.correct, a.hints_used);
  await q(`update concepts set mastery = $2 where id = $1`, [a.concept_id, mastery]);
  const prev = await one<Schedule>(`select interval_days, ease, reps, lapses, due_at from review_schedule where concept_id = $1`, [a.concept_id]);
  const exam = c.exam_date ? new Date(c.exam_date + "T08:00:00") : null;
  const next = nextSchedule(prev ?? NEW_SCHEDULE(now), qualityFrom(a.correct, a.hints_used, a.time_ms), now, exam);
  await q(
    `insert into review_schedule (user_id, concept_id, due_at, interval_days, ease, reps, lapses, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,now())
     on conflict (concept_id) do update set due_at = $3, interval_days = $4, ease = $5, reps = $6, lapses = $7, updated_at = now()`,
    [uid, a.concept_id, next.due_at, next.interval_days, next.ease, next.reps, next.lapses],
  );
  return { mastery, due_at: next.due_at };
}

export type DueItem = { concept_id: string; concept_name: string; topic_id: string; topic_title: string; subject_id: string; subject_name: string; subject_color: string; due_at: Date; mastery: number };

export const dueConcepts = (uid: string, until: Date, subjectId: string | null = null) =>
  q<DueItem>(
    `select c.id as concept_id, c.name as concept_name, t.id as topic_id, t.title as topic_title, s.id as subject_id, s.name as subject_name,
       s.color as subject_color, r.due_at, c.mastery
     from review_schedule r join concepts c on c.id = r.concept_id join topics t on t.id = c.topic_id join subjects s on s.id = t.subject_id
     where r.user_id = $1 and r.due_at <= $2 and ($3::uuid is null or s.id = $3::uuid)
       and exists (select 1 from questions x where x.concept_id = c.id)
     order by r.due_at asc`,
    [uid, until, subjectId],
  );

/** Days (in the student's time zone) with any study activity. */
export const activityDays = async (uid: string, tz: string) =>
  (
    await q<{ d: string }>(
      `select distinct to_char(created_at at time zone $2, 'YYYY-MM-DD') as d from attempts where user_id = $1
       union
       select distinct to_char(created_at at time zone $2, 'YYYY-MM-DD') from messages where user_id = $1 and role = 'user'`,
      [uid, tz],
    )
  ).map((r) => r.d);

export const weakConcepts = (uid: string, limit = 8) =>
  q<Concept & { topic_title: string; subject_id: string; subject_name: string; misses: number }>(
    `select c.id, c.topic_id, c.name, c.description, c.mastery, t.title as topic_title, s.id as subject_id, s.name as subject_name,
       (select count(*)::int from attempts a where a.concept_id = c.id and not a.correct) as misses
     from concepts c join topics t on t.id = c.topic_id join subjects s on s.id = t.subject_id
     where c.user_id = $1 and exists (select 1 from attempts a where a.concept_id = c.id) and c.mastery < 70
     order by c.mastery asc, misses desc limit $2`,
    [uid, limit],
  );

export const missedQuestions = (uid: string, subjectId: string, limit = 10) =>
  q<{ prompt: string; answer: string; explanation: string }>(
    `select distinct on (x.id) x.prompt, x.answer, x.explanation from attempts a join questions x on x.id = a.question_id join topics t on t.id = x.topic_id
     where a.user_id = $1 and t.subject_id = $2 and not a.correct order by x.id, a.created_at desc limit $3`,
    [uid, subjectId, limit],
  );

export const attemptTotals = async (uid: string) =>
  (await one<{ total: number; correct: number }>(`select count(*)::int as total, count(*) filter (where correct)::int as correct from attempts where user_id = $1`, [uid]))!;

// ─── Chat ───────────────────────────────────────────────────
export const latestSession = (uid: string, topicId: string, mode: string) =>
  one<ChatSession>(`select id, topic_id, mode, created_at from chat_sessions where user_id = $1 and topic_id = $2 and mode = $3 order by created_at desc limit 1`, [
    uid,
    topicId,
    mode,
  ]);

export const getSession = (uid: string, id: string) =>
  one<ChatSession>(`select id, topic_id, mode, created_at from chat_sessions where user_id = $1 and id = $2`, [uid, id]);

export async function createSession(uid: string, topicId: string, mode: string) {
  return (await one<ChatSession>(`insert into chat_sessions (user_id, topic_id, mode) values ($1,$2,$3) returning id, topic_id, mode, created_at`, [uid, topicId, mode]))!;
}

export const listMessages = (uid: string, sessionId: string) =>
  q<Message>(`select id, role, content, citations, meta, created_at from messages where user_id = $1 and session_id = $2 order by created_at, id`, [uid, sessionId]);

export async function addMessage(uid: string, sessionId: string, m: { role: "user" | "assistant"; content: string; citations?: string[]; meta?: TutorState }) {
  return (await one<Message>(
    `insert into messages (user_id, session_id, role, content, citations, meta) values ($1,$2,$3,$4,$5::jsonb,$6::jsonb)
     returning id, role, content, citations, meta, created_at`,
    [uid, sessionId, m.role, m.content, JSON.stringify(m.citations ?? []), JSON.stringify(m.meta ?? {})],
  ))!;
}

/** What the student already did today: topics checked and subjects with a mixed round. */
export const todayActivity = (uid: string, tz: string, today: string) =>
  q<{ topic_id: string; subject_id: string; mode: string }>(
    `select distinct x.topic_id, t.subject_id, a.mode from attempts a join questions x on x.id = a.question_id join topics t on t.id = x.topic_id
     where a.user_id = $1 and to_char(a.created_at at time zone $2, 'YYYY-MM-DD') = $3`,
    [uid, tz, today],
  );
