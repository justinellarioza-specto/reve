import Link from "next/link";
import { notFound } from "next/navigation";
import { newChatAction } from "@/app/actions";
import { Back } from "@/components/Back";
import { Chat } from "@/components/Chat";
import { userId } from "@/lib/auth";
import type { Mode } from "@/lib/ai";
import { getTopic, listMessages } from "@/lib/repo";
import { openSession } from "@/lib/services";

export const dynamic = "force-dynamic";

const MODES: { mode: Mode; label: string }[] = [
  { mode: "teach", label: "Teach me" },
  { mode: "quiz", label: "Quiz me" },
  { mode: "explain", label: "Explain it back" },
];

export default async function LearnPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const mode: Mode = MODES.some((m) => m.mode === sp.mode) ? (sp.mode as Mode) : "teach";
  const uid = await userId();
  const topic = await getTopic(uid, id);
  if (!topic) notFound();

  let error = "";
  let session = null;
  let messages: Awaited<ReturnType<typeof listMessages>> = [];
  try {
    session = await openSession(uid, id, mode);
    messages = await listMessages(uid, session.id);
  } catch (e) {
    error = e instanceof Error ? e.message : "Reve couldn't start the session.";
  }

  return (
    <div className="pt-4 flex flex-col min-h-[calc(100dvh-5rem)]">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1"><Back href={`/topics/${id}`}>{topic.title}</Back></div>
          <div className="flex items-center shrink-0 whitespace-nowrap">
            <Link href={`/topics/${id}/check`} className="btn-ghost btn-sm">Quick Check</Link>
            <form action={newChatAction.bind(null, id, mode)}>
              <button className="btn-ghost btn-sm">New chat</button>
            </form>
          </div>
        </div>
        <nav aria-label="Mode" className="inline-flex rounded-full bg-sunk p-1">
          {MODES.map((m) => (
            <Link key={m.mode} href={`/topics/${id}/learn?mode=${m.mode}`} aria-current={m.mode === mode ? "page" : undefined}
              className={`rounded-full px-4 py-1.5 text-[15px] font-semibold ${m.mode === mode ? "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--line)]" : "text-ink-2"}`}>
              {m.label}
            </Link>
          ))}
        </nav>
      </div>
      {error || !session ? (
        <p role="alert" className="mt-8 text-bad">{error}</p>
      ) : (
        <Chat key={session.id} sessionId={session.id} mode={mode} initial={messages.map((m) => ({ id: m.id, role: m.role, content: m.content, citations: m.citations }))} />
      )}
    </div>
  );
}
