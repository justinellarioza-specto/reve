import Link from "next/link";
import { notFound } from "next/navigation";
import { Back } from "@/components/Back";
import { timeZone, userId } from "@/lib/auth";
import { dayIn, formatDay } from "@/lib/dates";
import { buildPlan, type PlanSession } from "@/lib/planner";
import { getSubject, listTopics } from "@/lib/repo";

export const metadata = { title: "Exam plan" };
export const dynamic = "force-dynamic";

const KIND = {
  learn: "Teach me, then a Quick Check",
  review: "Spaced review of what's due",
  mixed: "Questions from several topics, shuffled",
  traps: "One-page summary of what trips people up",
};

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = await userId();
  const tz = await timeZone();
  const subject = await getSubject(uid, id);
  if (!subject) notFound();
  const topics = await listTopics(uid, id);
  const today = dayIn(tz);
  const plan = buildPlan(topics, today, subject.exam_date);
  const title = (ids: string[]) => topics.find((t) => t.id === ids[0])?.title;

  const href = (s: PlanSession) =>
    s.kind === "learn" ? `/topics/${s.topicIds[0]}` : s.kind === "review" ? `/review?subject=${id}` : s.kind === "mixed" ? `/review?subject=${id}&mixed=1` : `/subjects/${id}/traps`;

  return (
    <div className="pt-4 space-y-6">
      <Back href={`/subjects/${id}`}>{subject.name}</Back>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Exam plan</h1>
        <p className="text-ink-2 mt-2 max-w-[52ch]">
          {plan.days.length
            ? `${plan.daysLeft} days until ${formatDay(subject.exam_date!, { weekday: "long", month: "long", day: "numeric" })}. Short sessions: learn each topic first, then mix them up as the exam gets close. The plan adjusts as your mastery grows.`
            : plan.note}
        </p>
        {!subject.exam_date && <Link href={`/subjects/${id}/edit`} className="btn-quiet mt-4">Add exam date</Link>}
      </div>

      <ol className="relative space-y-6 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-line">
        {plan.days.map((d) => {
          const isToday = d.date === today;
          return (
            <li key={d.date} className="relative pl-8">
              <span aria-hidden className={`absolute left-0 top-1.5 size-[15px] rounded-full border-2 ${isToday ? "bg-accent border-accent" : "bg-paper border-line"}`} />
              <h2 className="font-bold">
                {isToday ? "Today" : formatDay(d.date)}
                {d.isExamEve && <span className="ml-2 font-semibold text-accent-ink">— night before the exam</span>}
              </h2>
              <ul className="mt-2 space-y-2">
                {d.sessions.map((s, i) => (
                  <li key={i}>
                    <Link href={href(s)} className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${isToday ? "bg-surface shadow-[inset_0_0_0_1px_var(--line)]" : "bg-sunk"} hover:shadow-[inset_0_0_0_1px_var(--ink-2)]`}>
                      <span className="flex-1">
                        <span className="block font-semibold">{s.kind === "learn" ? title(s.topicIds) : s.label}</span>
                        <span className="block text-sm text-ink-2">
                          {KIND[s.kind]}
                          {s.kind === "mixed" && `: ${s.topicIds.map((t) => topics.find((x) => x.id === t)?.title).filter(Boolean).join(", ")}`}
                        </span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-ink-2 shrink-0">{s.minutes} min</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
