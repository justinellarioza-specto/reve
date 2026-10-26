import { notFound } from "next/navigation";
import { regenerateTrapsAction } from "@/app/actions";
import { Back } from "@/components/Back";
import { Markdown } from "@/components/Markdown";
import { userId } from "@/lib/auth";
import { getSubject } from "@/lib/repo";
import { buildTraps } from "@/lib/services";

export const metadata = { title: "Traps & look-alikes" };
export const dynamic = "force-dynamic";

export default async function TrapsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = await userId();
  const subject = await getSubject(uid, id);
  if (!subject) notFound();
  let md = "";
  let error = "";
  try {
    md = await buildTraps(uid, id);
  } catch (e) {
    error = e instanceof Error ? e.message : "Couldn't build the sheet.";
  }

  return (
    <div className="pt-4 space-y-6">
      <Back href={`/subjects/${id}`}>{subject.name}</Back>
      <article className="rounded-2xl bg-surface p-6 sm:p-8 border border-line">
        <h1 className="text-2xl font-semibold tracking-tight leading-tight mb-1">Traps &amp; look-alikes</h1>
        <p className="text-ink-2 mb-6">{subject.name} — read this the night before. Then close it and sleep.</p>
        {error ? <p role="alert" className="text-bad">{error}</p> : <Markdown source={md} />}
      </article>
      <form action={regenerateTrapsAction.bind(null, id)} className="flex flex-wrap items-center gap-3">
        <button className="btn-quiet btn-sm">Rebuild from my latest mistakes</button>
        <span className="text-sm text-ink-2">Uses the questions you&apos;ve missed so far.</span>
      </form>
    </div>
  );
}
