import { addDays, diffDays } from "./dates";

export type PlanTopic = { id: string; title: string; mastery: number };
export type PlanSession = {
  kind: "learn" | "review" | "mixed" | "traps";
  minutes: number;
  topicIds: string[];
  label: string;
};
export type PlanDay = { date: string; sessions: PlanSession[]; isExamEve: boolean };
export type Plan = { days: PlanDay[]; daysLeft: number; note?: string };

const LEARNED = 80;

/**
 * Build a countdown plan of short sessions (≤ 30 min).
 * Early days: one new topic per session (Teach me → Quick Check) plus a short spaced review.
 * Final ~third: interleaved mixed rounds, weakest topics first.
 * Exam eve: one mixed round and the traps & look-alikes sheet.
 */
export function buildPlan(topics: PlanTopic[], today: string, examDate: string | null, sessionMinutes = 25): Plan {
  if (!examDate) return { days: [], daysLeft: -1, note: "Add an exam date to get a countdown plan." };
  const daysLeft = diffDays(today, examDate);
  if (daysLeft <= 0) return { days: [], daysLeft, note: daysLeft === 0 ? "Exam day. Good luck — you've got this." : "This exam has passed." };
  if (topics.length === 0) return { days: [], daysLeft, note: "Upload material to build a plan." };

  const studyDays = Array.from({ length: daysLeft }, (_, i) => addDays(today, i)); // today … exam eve
  const eve = studyDays[studyDays.length - 1];
  const before = studyDays.slice(0, -1);
  const mixedCount = before.length === 0 ? 0 : Math.max(1, Math.round(before.length * 0.3));
  const learnDays = before.slice(0, before.length - mixedCount);
  const mixedDays = before.slice(before.length - mixedCount);

  const toLearn = topics.filter((t) => t.mastery < LEARNED);
  const weakestFirst = [...topics].sort((a, b) => a.mastery - b.mastery);
  const mixedSet = (n: number) => weakestFirst.slice(0, Math.min(4, Math.max(2, n))).map((t) => t.id);

  const days: PlanDay[] = [];
  // If there's no room for a learn phase, new topics get folded into the mixed days.
  const learnSlots = learnDays.length > 0 ? learnDays : mixedDays.length > 0 ? mixedDays : [];
  const perDay = learnSlots.length ? Math.ceil(toLearn.length / learnSlots.length) : 0;
  let cursor = 0;

  for (const date of before) {
    const sessions: PlanSession[] = [];
    if (learnSlots.includes(date)) {
      for (let k = 0; k < perDay && cursor < toLearn.length; k++, cursor++) {
        const t = toLearn[cursor];
        sessions.push({ kind: "learn", minutes: sessionMinutes, topicIds: [t.id], label: `Learn: ${t.title}` });
      }
    }
    if (mixedDays.includes(date)) {
      sessions.push({ kind: "mixed", minutes: sessionMinutes, topicIds: mixedSet(topics.length), label: "Mixed round" });
    } else if (date !== before[0] || sessions.length === 0) {
      sessions.push({ kind: "review", minutes: 15, topicIds: [], label: "Spaced review" });
    }
    days.push({ date, sessions, isExamEve: false });
  }

  // Exam eve: anything still unlearned is squeezed in, then a light mixed round + traps sheet.
  const eveSessions: PlanSession[] = [];
  while (cursor < toLearn.length) {
    const t = toLearn[cursor++];
    eveSessions.push({ kind: "learn", minutes: 20, topicIds: [t.id], label: `Learn: ${t.title}` });
  }
  eveSessions.push({ kind: "mixed", minutes: 20, topicIds: mixedSet(topics.length), label: "Final mixed round" });
  eveSessions.push({ kind: "traps", minutes: 10, topicIds: [], label: "Traps & look-alikes" });
  days.push({ date: eve, sessions: eveSessions, isExamEve: true });

  return { days, daysLeft };
}
