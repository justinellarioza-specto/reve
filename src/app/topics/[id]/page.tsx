import Link from "next/link";
import { notFound } from "next/navigation";
import { Back } from "@/components/Back";
import { Chevron } from "@/components/Chevron";
import { userId } from "@/lib/auth";
import { getTopic, listConcepts, listTopics } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = await userId();
  const topic = await getTopic(uid, id);
  if (!topic) notFound();
  const [concepts, topics] = await Promise.all([listConcepts(uid, id), listTopics(uid, topic.subject_id)]);
  const stats = topics.find((t) => t.id === id)!;
  const started = stats.attempted;

  const modes = [
    { href: `/topics/${id}/learn?mode=teach`, title: "Teach me", body: "Reve asks, you think it through" },
    { href: `/topics/${id}/learn?mode=quiz`, title: "Quiz me", body: "Quick recall questions" },
    { href: `/topics/${id}/learn?mode=explain`, title: "Explain it back", body: "You explain, Reve checks" },
    { href: `/topics/${id}/check`, title: "Quick Check", body: "5–8 questions, scored" },
  ];
  const primary = started ? modes[3] : modes[0];

  return (
    <div className="pt-2 space-y-8">
      <div className="space-y-2">
        <Back href={`/subjects/${topic.subject_id}`}>{topic.subject_name}</Back>
        <h1 className="text-2xl font-semibold tracking-tight leading-tight">{topic.title}</h1>
        {topic.summary && <p className="text-[15px] text-ink-2">{topic.summary}</p>}
      </div>

      <div className="space-y-2">
        <Link href={primary.href} className="btn-primary w-full">{started ? "Take the Quick Check" : "Start with Teach me"}</Link>
        <ul className="divide-y divide-line">
          {modes.filter((m) => m !== primary).map((m) => (
            <li key={m.title}>
              <Link href={m.href} className="row">
                <span className="flex-1">
                  {m.title}
                  <span className="block text-sm text-ink-2">{m.body}</span>
                </span>
                <Chevron />
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <section aria-labelledby="concepts-h">
        <h2 id="concepts-h" className="text-sm font-medium text-ink-2 mb-3">Concepts · {stats.mastery}% mastered</h2>
        {concepts.length === 0 ? (
          <p className="text-ink-2">No concepts yet. <Link className="link" href={`/subjects/${topic.subject_id}/outline`}>Add some in the outline</Link>.</p>
        ) : (
          <ul className="space-y-4">
            {concepts.map((c) => (
              <li key={c.id}>
                <div className="flex justify-between gap-3 text-[15px]">
                  <span>{c.name}</span>
                  <span className="tabular-nums text-ink-2">{c.mastery}%</span>
                </div>
                <div className="mt-1.5 h-1 rounded-full bg-[var(--ring-track)] overflow-hidden" role="progressbar" aria-label={`${c.name} mastery`} aria-valuenow={c.mastery} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full" style={{ width: `${c.mastery}%`, background: topic.subject_color }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
