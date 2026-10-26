import "server-only";
import { addDays, dayIn, diffDays } from "./dates";
import { buildPlan, type PlanSession } from "./planner";
import * as repo from "./repo";
import { reviewMinutes } from "./srs";

export type NextStep = { headline: string; detail: string; href: string; cta: string; color?: string };

/** End of the student's "today", as a Date — reviews due before then count as today's. */
export function endOfToday(tz: string) {
  const tomorrow = addDays(dayIn(tz), 1);
  // Find the UTC instant of local midnight by probing offsets (DST-safe enough for a daily boundary).
  for (let h = -14; h <= 14; h++) {
    const d = new Date(`${tomorrow}T00:00:00Z`);
    d.setUTCHours(d.getUTCHours() + h);
    if (dayIn(tz, d) === tomorrow && dayIn(tz, new Date(d.getTime() - 3600_000)) !== tomorrow) return d;
  }
  return new Date(Date.now() + 12 * 3600_000);
}

export async function todaySummary(uid: string, tz: string) {
  const today = dayIn(tz);
  const [subjects, due, done] = await Promise.all([repo.listSubjects(uid), repo.dueConcepts(uid, endOfToday(tz)), repo.todayActivity(uid, tz, today)]);
  return { today, subjects, due, done, minutes: reviewMinutes(due.length) };
}

export async function nextStep(uid: string, tz: string, s: Awaited<ReturnType<typeof todaySummary>>, subjectId?: string): Promise<NextStep> {
  const subjects = subjectId ? s.subjects.filter((x) => x.id === subjectId) : s.subjects;
  if (subjects.length === 0) return { headline: "Add your first subject", detail: "Upload your slides or notes and Reve turns them into short lessons.", href: "/subjects/new", cta: "Add a subject" };

  const checkedTopics = new Set(s.done.filter((d) => d.mode === "check").map((d) => d.topic_id));
  const mixedSubjects = new Set(s.done.filter((d) => d.mode === "mixed").map((d) => d.subject_id));
  const dueHere = subjectId ? s.due.filter((d) => d.subject_id === subjectId) : s.due;

  // 1. Today's session from the nearest exam's countdown plan.
  const upcoming = subjects.filter((x) => x.exam_date && diffDays(s.today, x.exam_date) > 0).sort((a, b) => a.exam_date!.localeCompare(b.exam_date!));
  for (const subj of upcoming) {
    const topics = await repo.listTopics(uid, subj.id);
    if (topics.length === 0) continue;
    const plan = buildPlan(topics, s.today, subj.exam_date);
    const todays = plan.days[0]?.date === s.today ? plan.days[0].sessions : [];
    const pending = todays.find((p: PlanSession) => {
      if (p.kind === "learn") return !checkedTopics.has(p.topicIds[0]) && !topics.find((t) => t.id === p.topicIds[0])?.attempted;
      if (p.kind === "review") return dueHere.some((d) => d.subject_id === subj.id);
      if (p.kind === "mixed") return !mixedSubjects.has(subj.id);
      return p.kind === "traps";
    });
    if (!pending) continue;
    const daysLeft = diffDays(s.today, subj.exam_date!);
    const when = daysLeft === 1 ? "Exam tomorrow" : `${daysLeft} days to your ${subj.name} exam`;
    if (pending.kind === "learn") {
      const t = topics.find((x) => x.id === pending.topicIds[0])!;
      return { headline: `${pending.minutes} minutes on ${t.title}`, detail: `${when}. Talk it through with Reve, then take the Quick Check.`, href: `/topics/${t.id}`, cta: "Start", color: subj.color };
    }
    if (pending.kind === "mixed")
      return { headline: `A mixed round of ${subj.name}`, detail: `${when}. Mixing topics now trains you to tell them apart on the exam.`, href: `/review?subject=${subj.id}&mixed=1`, cta: "Start mixed round", color: subj.color };
    if (pending.kind === "traps")
      return { headline: "Read your traps & look-alikes", detail: `${when}. One page of the things most likely to trip you up.`, href: `/subjects/${subj.id}/traps`, cta: "Open the sheet", color: subj.color };
  }

  // 2. Spaced review.
  if (dueHere.length > 0)
    return { headline: `${dueHere.length} ${dueHere.length === 1 ? "idea" : "ideas"} to review`, detail: `About ${reviewMinutes(dueHere.length)} min. Recalling them now, right before you'd forget, is what makes them stick.`, href: subjectId ? `/review?subject=${subjectId}` : "/review", cta: "Start review" };

  // 3. The first topic not studied yet.
  for (const subj of subjects) {
    const t = (await repo.listTopics(uid, subj.id)).find((x) => !x.attempted);
    if (t) return { headline: `Start ${t.title}`, detail: `${subj.name}. Reve asks, you answer — about 25 minutes.`, href: `/topics/${t.id}`, cta: "Start", color: subj.color };
    if ((await repo.listTopics(uid, subj.id)).length === 0)
      return { headline: `Upload material for ${subj.name}`, detail: "Slides, PDFs, Word files or pasted notes.", href: `/subjects/${subj.id}/upload`, cta: "Upload", color: subj.color };
  }

  return { headline: "You're all caught up", detail: "Nothing is due. A mixed round is the best use of extra time.", href: `/review?subject=${subjects[0].id}&mixed=1`, cta: "Do a mixed round" };
}
