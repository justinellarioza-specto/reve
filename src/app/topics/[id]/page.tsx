import Link from "next/link";
import { notFound } from "next/navigation";
import { Back } from "@/components/Back";
import { Ring } from "@/components/Ring";
import { userId } from "@/lib/auth";
import { getTopic, listConcepts, listTopics } from "@/lib/repo";

export const dynamic = "force-dynamic";

const MODES = [
  { mode: "teach", title: "Teach me", body: "Reve asks, you think it through. No lectures." },
  { mode: "quiz", title: "Quiz me", body: "Rapid recall, one question at a time." },
  { mode: "explain", title: "Explain it back", body: "You teach Reve; get feedback on gaps." },
] as const;

export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = await userId();
  const topic = await getTopic(uid, id);
  if (!topic) notFound();
  const [concepts, topics] = await Promise.all([listConcepts(uid, id), listTopics(uid, topic.subject_id)]);
  const stats = topics.find((t) => t.id === id)!;
  const started = stats.attempted;

  return (
    <div className="pt-4 space-y-8">
      <Back href={`/subjects/${topic.subject_id}`}>{topic.subject_name}</Back>
      <header className="flex items-start gap-5">
        <Ring value={stats.mastery} size={72} stroke={7} color={topic.subject_color} />
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight leading-tight">{topic.title}</h1>
          {topic.summary && <p className="text-ink-2 mt-2">{topic.summary}</p>}
        </div>
      </header>

      <section aria-label="Study this topic" className="space-y-3">
        <Link href={started ? `/topics/${id}/check` : `/topics/${id}/learn?mode=teach`} className="btn-primary w-full min-h-14 text-[1.05rem]">
          {started ? "Take the Quick Check" : "Start with Teach me"}
        </Link>
        <ul className="grid gap-2 sm:grid-cols-2">
          {[...MODES, { mode: "check", title: "Quick Check", body: "5–8 questions. Answer first, then see why." } as const]
            .filter((m) => (started ? m.mode !== "check" : m.mode !== "teach"))
            .map((m) => (
              <li key={m.mode}>
                <Link href={m.mode === "check" ? `/topics/${id}/check` : `/topics/${id}/learn?mode=${m.mode}`}
                  className="block h-full rounded-2xl bg-sunk px-4 py-3 hover:shadow-[inset_0_0_0_1px_var(--ink-2)]">
                  <span className="block font-semibold">{m.title}</span>
                  <span className="block text-sm text-ink-2">{m.body}</span>
                </Link>
              </li>
            ))}
        </ul>
      </section>

      <section aria-labelledby="concepts-h">
        <h2 id="concepts-h" className="text-lg font-bold mb-3">Concepts</h2>
        {concepts.length === 0 ? (
          <p className="text-ink-2">No concepts yet. <Link className="link" href={`/subjects/${topic.subject_id}/outline`}>Add some in the outline</Link>.</p>
        ) : (
          <ul className="space-y-4">
            {concepts.map((c) => (
              <li key={c.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-sm tabular-nums text-ink-2">{c.mastery}%</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-[var(--ring-track)] overflow-hidden" role="progressbar" aria-label={`${c.name} mastery`} aria-valuenow={c.mastery} aria-valuemin={0} aria-valuemax={100}>
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
