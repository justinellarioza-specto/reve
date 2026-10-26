import Link from "next/link";
import { signOutAction } from "@/app/actions";
import { Ring } from "@/components/Ring";
import { currentUser, timeZone } from "@/lib/auth";
import { dayIn, addDays, streakFrom } from "@/lib/dates";
import * as repo from "@/lib/repo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Progress" };

export default async function ProgressPage() {
  const user = await currentUser();
  const tz = await timeZone();
  const today = dayIn(tz);
  const [days, totals, weak, subjects] = await Promise.all([repo.activityDays(user.id, tz), repo.attemptTotals(user.id), repo.weakConcepts(user.id, 8), repo.listSubjects(user.id)]);
  const topicsBySubject = await Promise.all(subjects.map((s) => repo.listTopics(user.id, s.id)));
  const streak = streakFrom(days, today);
  const week = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const active = new Set(days);

  return (
    <div className="pt-4 space-y-10">
      <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>

      <section aria-labelledby="streak-h" className="space-y-4">
        <div className="flex items-start gap-10">
          <div>
            <p id="streak-h" className="text-sm text-ink-2">Streak</p>
            <p className="text-3xl font-semibold tabular-nums leading-none mt-1">{streak}<span className="text-base font-normal text-ink-2 ml-1.5">{streak === 1 ? "day" : "days"}</span></p>
          </div>
          <div>
            <p className="text-sm text-ink-2">First-try accuracy</p>
            <p className="text-3xl font-semibold tabular-nums leading-none mt-1">
              {totals.total ? `${Math.round((totals.correct / totals.total) * 100)}%` : "—"}
              <span className="text-base font-normal text-ink-2 ml-1.5">of {totals.total}</span>
            </p>
          </div>
        </div>
        <ol className="flex gap-1.5" aria-label="Study days, last two weeks">
          {week.map((d) => (
            <li key={d} title={d} className={`h-6 flex-1 rounded ${active.has(d) ? "bg-accent" : "bg-[var(--ring-track)]"} ${d === today ? "ring-2 ring-inset ring-ink" : ""}`}>
              <span className="sr-only">{d}: {active.has(d) ? "studied" : "no study"}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="weak-h">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <h2 id="weak-h" className="text-sm font-medium text-ink-2">Weak spots</h2>
        </div>
        {weak.length === 0 ? (
          <p className="text-ink-2">None yet. Concepts you miss in Quick Checks show up here.</p>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {weak.map((w) => (
                <li key={w.id} className="flex items-center gap-4 py-3">
                  <Ring value={w.mastery} label={`${w.name}: ${w.mastery}%`} />
                  <span className="flex-1 min-w-0">
                    <span className="block">{w.name}</span>
                    <span className="block text-sm text-ink-2 truncate">{w.subject_name} · {w.topic_title}{w.misses > 0 && ` · missed ${w.misses}×`}</span>
                  </span>
                  <Link href={`/topics/${w.topic_id}/learn?mode=teach`} className="text-sm text-ink-2 hover:text-ink px-2 py-1 shrink-0" aria-label={`Talk ${w.name} through with Reve`}>Ask Reve</Link>
                </li>
              ))}
            </ul>
            <Link href="/review?weak=1" className="btn-primary mt-4 w-full sm:w-auto">Review these with Reve</Link>
          </>
        )}
      </section>

      <section aria-labelledby="mastery-h" className="space-y-6">
        <h2 id="mastery-h" className="text-sm font-medium text-ink-2">Mastery by topic</h2>
        {subjects.map((s, k) => (
          <div key={s.id}>
            <Link href={`/subjects/${s.id}`} className="flex items-center gap-2 hover:underline underline-offset-4">
              <span aria-hidden className="size-2.5 rounded-full" style={{ background: s.color }} />
              {s.name}
              <span className="text-ink-2 font-normal ml-auto tabular-nums">{s.mastery}%</span>
            </Link>
            <ul className="mt-3 space-y-3">
              {topicsBySubject[k].map((t) => (
                <li key={t.id}>
                  <Link href={`/topics/${t.id}`} className="block group">
                    <span className="flex justify-between text-[15px]"><span className="group-hover:underline underline-offset-4">{t.title}</span><span className="tabular-nums text-ink-2">{t.attempted ? `${t.mastery}%` : "not started"}</span></span>
                    <span className="mt-1 block h-1 rounded-full bg-[var(--ring-track)] overflow-hidden" role="progressbar" aria-label={`${t.title} mastery`} aria-valuenow={t.mastery} aria-valuemin={0} aria-valuemax={100}>
                      <span className="block h-full rounded-full" style={{ width: `${t.mastery}%`, background: s.color }} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {!user.demo && (
        <form action={signOutAction} className="pt-4 rule">
          <p className="text-sm text-ink-2 mt-4 mb-2">Signed in as {user.email}</p>
          <button className="btn-quiet btn-sm">Sign out</button>
        </form>
      )}
    </div>
  );
}
