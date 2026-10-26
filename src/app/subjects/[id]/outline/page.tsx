import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addConceptAction, addTopicAction, deleteConceptAction, deleteTopicAction, moveTopicAction, updateConceptAction, updateTopicAction,
} from "@/app/actions";
import { Back } from "@/components/Back";
import { ConfirmButton } from "@/components/ConfirmButton";
import { userId } from "@/lib/auth";
import { getSubject, listTopics, subjectConcepts } from "@/lib/repo";

export const metadata = { title: "Outline" };
export const dynamic = "force-dynamic";

const iconBtn = "size-10 grid place-items-center rounded-full text-ink-2 hover:bg-sunk hover:text-ink disabled:opacity-30";

export default async function OutlinePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ added?: string }> }) {
  const { id } = await params;
  const { added } = await searchParams;
  const uid = await userId();
  const subject = await getSubject(uid, id);
  if (!subject) notFound();
  const [topics, concepts] = await Promise.all([listTopics(uid, id), subjectConcepts(uid, id)]);

  return (
    <div className="pt-4 space-y-6">
      <Back href={`/subjects/${id}`}>{subject.name}</Back>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Outline</h1>
        {added ? (
          <p role="status" className="mt-3 rounded-2xl bg-good-bg text-good px-4 py-3 font-semibold">
            Added {added} {added === "1" ? "topic" : "topics"}. Check the outline below — rename, reorder or remove anything that&apos;s off.
          </p>
        ) : (
          <p className="text-ink-2 mt-2">Each topic is one study session. Concepts are what Reve tracks your mastery of.</p>
        )}
      </div>

      <ol className="space-y-3">
        {topics.map((t, i) => {
          const cs = concepts.filter((c) => c.topic_id === t.id);
          return (
            <li key={t.id} className="rounded-2xl bg-surface border border-line">
              <details open={!!added && i >= topics.length - Number(added)}>
                <summary className="flex items-center gap-3 px-5 py-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span className="text-ink-2 tabular-nums font-semibold w-6">{i + 1}</span>
                  <span className="flex-1 font-semibold">{t.title}</span>
                  <span className="text-sm text-ink-2">{cs.length} concepts</span>
                </summary>
                <div className="px-5 pb-5 space-y-5">
                  <form action={updateTopicAction.bind(null, id, t.id)} className="space-y-3">
                    <div>
                      <label className="label" htmlFor={`title-${t.id}`}>Topic title</label>
                      <input id={`title-${t.id}`} name="title" defaultValue={t.title} required className="field" />
                    </div>
                    <div>
                      <label className="label" htmlFor={`sum-${t.id}`}>Summary</label>
                      <textarea id={`sum-${t.id}`} name="summary" defaultValue={t.summary} rows={2} className="field" />
                    </div>
                    <button className="btn-quiet btn-sm">Save topic</button>
                  </form>

                  <div>
                    <h3 className="label">Concepts</h3>
                    <ul className="space-y-2">
                      {cs.map((c) => (
                        <li key={c.id} className="rounded-2xl bg-sunk p-3">
                          <form action={updateConceptAction.bind(null, id, c.id)} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] items-start">
                            <input aria-label="Concept name" name="name" defaultValue={c.name} required className="field py-2" />
                            <input aria-label="Concept description" name="description" defaultValue={c.description} className="field py-2" />
                            <div className="flex gap-1">
                              <button className="btn-ghost btn-sm">Save</button>
                              <button formAction={deleteConceptAction.bind(null, id, c.id)} className="btn-ghost btn-sm text-bad" aria-label={`Remove concept ${c.name}`}>Remove</button>
                            </div>
                          </form>
                        </li>
                      ))}
                    </ul>
                    <form action={addConceptAction.bind(null, id, t.id)} className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                      <input aria-label="New concept name" name="name" placeholder="New concept" className="field py-2" />
                      <input aria-label="New concept description" name="description" placeholder="One-line description" className="field py-2" />
                      <button className="btn-quiet btn-sm">Add</button>
                    </form>
                  </div>

                  <div className="flex items-center gap-1 pt-1 rule">
                    <form action={moveTopicAction.bind(null, id, t.id, -1)} className="mt-3">
                      <button className={iconBtn} disabled={i === 0} aria-label={`Move ${t.title} up`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 15l6-6 6 6" /></svg>
                      </button>
                    </form>
                    <form action={moveTopicAction.bind(null, id, t.id, 1)} className="mt-3">
                      <button className={iconBtn} disabled={i === topics.length - 1} aria-label={`Move ${t.title} down`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
                      </button>
                    </form>
                    <form action={deleteTopicAction.bind(null, id, t.id)} className="mt-3 ml-auto">
                      <ConfirmButton className="btn-ghost btn-sm text-bad" message={`Delete "${t.title}" with its questions and progress?`}>Delete topic</ConfirmButton>
                    </form>
                  </div>
                </div>
              </details>
            </li>
          );
        })}
      </ol>

      <form action={addTopicAction.bind(null, id)} className="flex gap-2">
        <input aria-label="New topic title" name="title" placeholder="Add a topic" className="field" />
        <button className="btn-quiet shrink-0">Add</button>
      </form>

      <Link href={`/subjects/${id}`} className="btn-primary w-full sm:w-auto">Looks good</Link>
    </div>
  );
}
