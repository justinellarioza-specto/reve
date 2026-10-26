import Link from "next/link";
import { NextCard } from "@/components/NextCard";
import { Ring } from "@/components/Ring";
import { currentUser, timeZone } from "@/lib/auth";
import { diffDays, formatDay, streakFrom } from "@/lib/dates";
import { nextStep, todaySummary } from "@/lib/next";
import { activityDays } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();
  const tz = await timeZone();
  const summary = await todaySummary(user.id, tz);
  const [step, days] = await Promise.all([nextStep(user.id, tz, summary), activityDays(user.id, tz)]);
  const streak = streakFrom(days, summary.today);
  const studiedToday = days.includes(summary.today);

  return (
    <div className="space-y-8 pt-4">
      <p className="text-[15px] text-ink-2">
        {formatDay(summary.today, { weekday: "long", month: "long", day: "numeric" })}
        {streak > 0 && (
          <> · <span className="font-semibold text-ink">{streak}-day streak</span>{!studiedToday && " — study today to keep it"}</>
        )}
      </p>

      <NextCard step={step} />

      <Link href="/review" className="flex items-center justify-between gap-4 rounded-2xl px-5 py-4 bg-sunk hover:bg-[color-mix(in_srgb,var(--sunk),var(--ink)_4%)]">
        <span>
          <span className="font-semibold">Today&apos;s review: </span>
          {summary.due.length === 0 ? (
            <span className="text-ink-2">nothing due</span>
          ) : (
            <span>
              {summary.due.length} {summary.due.length === 1 ? "item" : "items"} · ~{summary.minutes} min
            </span>
          )}
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden className="text-ink-2"><path d="M9 6l6 6-6 6" /></svg>
      </Link>

      <section aria-labelledby="subjects-h">
        <div className="flex items-baseline justify-between mb-2">
          <h2 id="subjects-h" className="text-lg font-bold">Subjects</h2>
          <Link href="/subjects/new" className="btn-ghost btn-sm">+ Add subject</Link>
        </div>
        {summary.subjects.length === 0 ? (
          <p className="text-ink-2 py-6">No subjects yet. Add one for each class with an exam coming up.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {summary.subjects.map((s) => {
              const left = s.exam_date ? diffDays(summary.today, s.exam_date) : null;
              return (
                <li key={s.id}>
                  <Link href={`/subjects/${s.id}`} className="flex items-center gap-4 py-4 group">
                    <Ring value={s.mastery} color={s.color} label={`${s.name}: ${s.mastery}% mastered`} />
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold truncate group-hover:underline underline-offset-4">{s.name}</span>
                      <span className="block text-sm text-ink-2">
                        {s.topic_count} {s.topic_count === 1 ? "topic" : "topics"}
                        {left !== null && (left > 1 ? ` · exam in ${left} days` : left === 1 ? " · exam tomorrow" : left === 0 ? " · exam today" : " · exam done")}
                        {s.due_count > 0 && ` · ${s.due_count} to review`}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
