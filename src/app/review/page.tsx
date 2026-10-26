import Link from "next/link";
import { Back } from "@/components/Back";
import { QuestionRunner, type ClientQuestion } from "@/components/QuestionRunner";
import { timeZone, userId } from "@/lib/auth";
import { endOfToday } from "@/lib/next";
import * as repo from "@/lib/repo";
import { reviewMinutes } from "@/lib/srs";
import { shuffle } from "@/lib/text";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review" };

type Pick = { concept_id: string; topic_id: string; topic_title: string; color: string };

async function toItems(uid: string, picks: Pick[]): Promise<ClientQuestion[]> {
  const items: ClientQuestion[] = [];
  for (const p of picks) {
    const q = await repo.questionForConcept(uid, p.concept_id);
    if (q) items.push({ id: q.id, type: q.type, prompt: q.prompt, options: q.options, hint: q.hint, topic_id: p.topic_id, topic_title: p.topic_title, color: p.color });
  }
  return items;
}

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ subject?: string; mixed?: string; weak?: string }> }) {
  const sp = await searchParams;
  const uid = await userId();
  const tz = await timeZone();
  const subject = sp.subject ? await repo.getSubject(uid, sp.subject) : null;

  let title = "Today's review";
  let intro = "";
  let mode: "review" | "mixed" = "review";
  let items: ClientQuestion[] = [];

  if (sp.mixed && subject) {
    // Interleaving: weakest concepts across all topics, shuffled together.
    mode = "mixed";
    title = `Mixed round: ${subject.name}`;
    intro = "Questions from different topics, shuffled. Telling them apart is exactly what the exam asks of you.";
    const concepts = (await repo.subjectConcepts(uid, subject.id)).sort((a, b) => a.mastery - b.mastery).slice(0, 10);
    items = shuffle(await toItems(uid, concepts.map((c) => ({ concept_id: c.id, topic_id: c.topic_id, topic_title: c.topic_title, color: subject.color })))).slice(0, 10);
  } else if (sp.weak) {
    title = "Your weak spots";
    intro = "One question for each concept you've been missing.";
    const weak = await repo.weakConcepts(uid, 10);
    const subjects = await repo.listSubjects(uid);
    const color = (sid: string) => subjects.find((s) => s.id === sid)?.color ?? "var(--accent)";
    items = shuffle(await toItems(uid, weak.map((w) => ({ concept_id: w.id, topic_id: w.topic_id, topic_title: w.topic_title, color: color(w.subject_id) }))));
  } else {
    const due = await repo.dueConcepts(uid, endOfToday(tz), subject?.id ?? null);
    if (subject) title = `Review: ${subject.name}`;
    intro = due.length
      ? `${due.length} ${due.length === 1 ? "item" : "items"} · ~${reviewMinutes(due.length)} min. Each idea comes back right before you'd forget it — misses come back sooner.`
      : "";
    items = shuffle(await toItems(uid, due.slice(0, 25).map((d) => ({ concept_id: d.concept_id, topic_id: d.topic_id, topic_title: d.topic_title, color: d.subject_color }))));
  }

  const back = subject ? `/subjects/${subject.id}` : "/";
  return (
    <div className="pt-4 space-y-4">
      <Back href={back}>{subject ? subject.name : "Today"}</Back>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {intro && <p className="text-ink-2 mt-2 max-w-[52ch]">{intro}</p>}
      </div>
      {items.length === 0 ? (
        <div className="py-6 space-y-4">
          <p className="text-lg">{mode === "mixed" ? "Take a Quick Check in a few topics first — then Reve can mix them." : "Nothing due right now. Nice."}</p>
          <p className="text-ink-2">Reviews appear after you answer questions in a Quick Check, spaced out over the next days.</p>
          <Link href={back} className="btn-quiet">{subject ? `Back to ${subject.name}` : "Back to today"}</Link>
        </div>
      ) : (
        <QuestionRunner items={items} mode={mode} title={title} doneHref={back} doneLabel="Done" />
      )}
    </div>
  );
}
