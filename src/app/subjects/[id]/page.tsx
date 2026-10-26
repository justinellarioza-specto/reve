import Link from "next/link";
import { notFound } from "next/navigation";
import { Back } from "@/components/Back";
import { Chevron } from "@/components/Chevron";
import { NextCard } from "@/components/NextCard";
import { Ring } from "@/components/Ring";
import { timeZone, userId } from "@/lib/auth";
import { diffDays, formatDay } from "@/lib/dates";
import { nextStep, todaySummary } from "@/lib/next";
import { getSubject, listTopics } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = await userId();
  const tz = await timeZone();
  const subject = await getSubject(uid, id);
  if (!subject) notFound();
  const summary = await todaySummary(uid, tz);
  const [topics, step] = await Promise.all([listTopics(uid, id), nextStep(uid, tz, summary, id)]);
  const left = subject.exam_date ? diffDays(summary.today, subject.exam_date) : null;

  return (
    <div className="pt-2 space-y-8">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Back href="/">Today</Back>
          <Link href={`/subjects/${id}/edit`} className="text-sm text-ink-2 hover:text-ink px-2 py-1">Edit</Link>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{subject.name}</h1>
        <p className="text-sm text-ink-2">
          {subject.exam_date
            ? left! > 0
              ? `Exam ${formatDay(subject.exam_date)}, ${left === 1 ? "tomorrow" : `in ${left} days`}`
              : left === 0
                ? "Exam today"
                : `Exam was ${formatDay(subject.exam_date)}`
            : "No exam date"}
        </p>
      </div>

      <NextCard step={step} />

      <section aria-labelledby="topics-h">
        <div className="flex items-center justify-between">
          <h2 id="topics-h" className="text-sm font-medium text-ink-2">Topics</h2>
          {topics.length > 0 && <Link href={`/subjects/${id}/outline`} className="text-sm text-ink-2 hover:text-ink px-2 py-1">Edit</Link>}
        </div>
        {topics.length === 0 ? (
          <div className="py-6 space-y-4">
            <p className="text-ink-2">Upload slides, a PDF, a Word file or notes. Reve splits them into short topics.</p>
            <Link href={`/subjects/${id}/upload`} className="btn-quiet">Upload material</Link>
          </div>
        ) : (
          <ol className="divide-y divide-line">
            {topics.map((t) => (
              <li key={t.id}>
                <Link href={`/topics/${t.id}`} className="row">
                  <Ring value={t.mastery} color={subject.color} label={`${t.title}: ${t.mastery}% mastered`} />
                  <span className="flex-1 min-w-0 truncate">{t.title}</span>
                  <span className="text-sm text-ink-2 tabular-nums">{t.attempted ? `${t.mastery}%` : "New"}</span>
                  <Chevron />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="more-h">
        <h2 id="more-h" className="text-sm font-medium text-ink-2">More</h2>
        <ul className="divide-y divide-line">
          {[
            [`/subjects/${id}/plan`, "Exam plan"],
            [`/subjects/${id}/traps`, "Traps & look-alikes"],
            [`/subjects/${id}/upload`, "Add material"],
          ].map(([href, label]) => (
            <li key={href}>
              <Link href={href} className="row">
                <span className="flex-1">{label}</span>
                <Chevron />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
