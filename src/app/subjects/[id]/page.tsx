import Link from "next/link";
import { notFound } from "next/navigation";
import { Back } from "@/components/Back";
import { NextCard } from "@/components/NextCard";
import { Ring } from "@/components/Ring";
import { timeZone, userId } from "@/lib/auth";
import { diffDays, formatDay } from "@/lib/dates";
import { nextStep, todaySummary } from "@/lib/next";
import { getSubject, listDocuments, listTopics } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = await userId();
  const tz = await timeZone();
  const subject = await getSubject(uid, id);
  if (!subject) notFound();
  const summary = await todaySummary(uid, tz);
  const [topics, docs, step] = await Promise.all([listTopics(uid, id), listDocuments(uid, id), nextStep(uid, tz, summary, id)]);
  const left = subject.exam_date ? diffDays(summary.today, subject.exam_date) : null;

  return (
    <div className="pt-4 space-y-8">
      <div className="space-y-3">
        <Back href="/">Today</Back>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <span aria-hidden className="size-3.5 rounded-full shrink-0" style={{ background: subject.color }} />
              {subject.name}
            </h1>
            <p className="text-ink-2 mt-1">
              {subject.exam_date
                ? left! > 0
                  ? `Exam ${formatDay(subject.exam_date)} — ${left === 1 ? "tomorrow" : `in ${left} days`}`
                  : left === 0
                    ? "Exam today"
                    : `Exam was ${formatDay(subject.exam_date)}`
                : "No exam date yet"}
            </p>
          </div>
          <Link href={`/subjects/${id}/edit`} className="btn-ghost btn-sm shrink-0">Edit</Link>
        </div>
      </div>

      <NextCard step={step} eyebrow="Next in this subject" />

      <nav aria-label="Subject tools" className="grid grid-cols-3 gap-2">
        {[
          [`/subjects/${id}/plan`, "Exam plan"],
          [`/subjects/${id}/traps`, "Traps sheet"],
          [`/subjects/${id}/upload`, "Add material"],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="rounded-2xl bg-sunk px-3 py-3 text-center text-[15px] font-semibold hover:bg-[color-mix(in_srgb,var(--sunk),var(--ink)_5%)]">
            {label}
          </Link>
        ))}
      </nav>

      <section aria-labelledby="topics-h">
        <div className="flex items-baseline justify-between mb-2">
          <h2 id="topics-h" className="text-lg font-bold">Topics</h2>
          {topics.length > 0 && <Link href={`/subjects/${id}/outline`} className="btn-ghost btn-sm">Edit outline</Link>}
        </div>
        {topics.length === 0 ? (
          <div className="py-6 space-y-4">
            <p className="text-ink-2">Upload slides, a PDF, a Word file or paste your notes. Reve splits them into short topics you can study one at a time.</p>
            <Link href={`/subjects/${id}/upload`} className="btn-quiet">Upload material</Link>
          </div>
        ) : (
          <ol className="divide-y divide-line border-y border-line">
            {topics.map((t, i) => (
              <li key={t.id}>
                <Link href={`/topics/${t.id}`} className="flex items-center gap-4 py-4 group">
                  <Ring value={t.mastery} color={subject.color} label={`${t.title}: ${t.mastery}% mastered`} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold group-hover:underline underline-offset-4">
                      <span className="text-ink-2 tabular-nums mr-2">{i + 1}.</span>
                      {t.title}
                    </span>
                    <span className="block text-sm text-ink-2 truncate">{t.attempted ? `${t.concept_count} concepts` : "Not started"}{t.summary && ` — ${t.summary}`}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      {docs.length > 0 && (
        <section aria-labelledby="docs-h">
          <h2 id="docs-h" className="text-sm font-semibold text-ink-2 mb-2">Material</h2>
          <ul className="text-sm text-ink-2 space-y-1">
            {docs.map((d) => (
              <li key={d.id} className="truncate">{d.filename}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
