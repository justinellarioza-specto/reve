import Link from "next/link";
import { Chevron } from "@/components/Chevron";
import { NextCard } from "@/components/NextCard";
import { currentUser, timeZone } from "@/lib/auth";
import { isDemo, isMockAI } from "@/lib/config";
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

  return (
    <div className="space-y-8 pt-2">
      <div className="space-y-1">
      <p className="text-sm text-ink-2">
        {formatDay(summary.today, { weekday: "long", month: "long", day: "numeric" })}
        {streak > 0 && ` · ${streak}-day streak`}
      </p>

      <NextCard step={step} />
      </div>

      {!step.href.startsWith("/review") || step.href.includes("mixed") ? (
      <ul className="divide-y divide-line border-y border-line">
        <li>
          <Link href="/review" className="row">
            <span className="flex-1">Today&apos;s review</span>
            <span className="text-ink-2 text-[15px]">{summary.due.length === 0 ? "Nothing due" : `${summary.due.length} items · ~${summary.minutes} min`}</span>
            <Chevron />
          </Link>
        </li>
      </ul>
      ) : null}

      <section aria-labelledby="subjects-h" className="pt-2">
        <div className="flex items-center justify-between">
          <h2 id="subjects-h" className="text-sm font-medium text-ink-2">Subjects</h2>
          <Link href="/subjects/new" className="text-sm text-ink-2 hover:text-ink px-2 py-1">+ Add</Link>
        </div>
        {summary.subjects.length === 0 ? (
          <p className="text-ink-2 py-6">No subjects yet. Add one for each class with an exam coming up.</p>
        ) : (
          <ul className="divide-y divide-line">
            {summary.subjects.map((s) => {
              const left = s.exam_date ? diffDays(summary.today, s.exam_date) : null;
              return (
                <li key={s.id}>
                  <Link href={`/subjects/${s.id}`} className="row">
                    <span aria-hidden className="size-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate">{s.name}</span>
                      <span className="block text-sm text-ink-2">
                        {left === null ? `${s.topic_count} topics` : left > 1 ? `Exam in ${left} days` : left === 1 ? "Exam tomorrow" : left === 0 ? "Exam today" : "Exam done"}
                      </span>
                    </span>
                    <span className="text-sm tabular-nums text-ink-2">{s.mastery}%</span>
                    <Chevron />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {(isDemo() || isMockAI()) && (
        <p className="text-xs text-ink-2 pt-4">
          Demo mode{isMockAI() && " · offline tutor"}. <a className="underline underline-offset-2" href="https://github.com/justinellarioza-specto/reve#setup">Set up Gemini & Supabase</a>
        </p>
      )}
    </div>
  );
}
