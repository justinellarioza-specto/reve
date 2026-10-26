"use client";
import { useEffect, useRef, useState } from "react";

type Msg = { id: string; role: "user" | "assistant"; content: string; citations: string[] };

const CHIPS: Record<string, string[]> = {
  teach: ["Give me a hint", "Can you give an example?", "Just tell me"],
  quiz: ["Give me a hint", "Just tell me", "Harder one, please"],
  explain: ["I'm not sure where to start", "Can I try again?", "Next concept"],
};

/** Render **bold** only; everything else is plain text. */
const rich = (t: string) => t.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p));

export function Chat({ sessionId, mode, initial }: { sessionId: string; mode: string; initial: Msg[] }) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs.length, busy]);

  async function send(content: string) {
    const t = content.trim();
    if (!t || busy) return;
    setError("");
    setBusy(true);
    setText("");
    setMsgs((m) => [...m, { id: `tmp-${Date.now()}`, role: "user", content: t, citations: [] }]);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId, text: t }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reve couldn't reply.");
      setMsgs((m) => [...m, data.message]);
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Reve couldn't reply."} Your message was saved — try sending again.`);
    } finally {
      setBusy(false);
      box.current?.focus();
    }
  }

  return (
    <>
      <ol className="flex-1 space-y-5 py-4" aria-live="polite" aria-label="Conversation">
        {msgs.map((m) =>
          m.role === "assistant" ? (
            <li key={m.id} className="rise max-w-[40rem]">
              <p className="sr-only">Reve:</p>
              <p className="text-[1.06rem] leading-relaxed whitespace-pre-wrap">{rich(m.content)}</p>
              {m.citations.length > 0 && (
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {m.citations.map((c) => (
                    <span key={c} className="chip text-xs py-0.5" title="Source in your material">From {c}</span>
                  ))}
                </p>
              )}
            </li>
          ) : (
            <li key={m.id} className="rise flex justify-end">
              <p className="sr-only">You:</p>
              <p className="max-w-[85%] rounded-2xl rounded-br-lg bg-ink text-paper px-4 py-2.5 whitespace-pre-wrap">{m.content}</p>
            </li>
          ),
        )}
        {busy && (
          <li className="text-ink-2 flex items-center gap-2" aria-label="Reve is thinking">
            <span className="inline-flex gap-1" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-1.5 rounded-full bg-ink-2 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </span>
            thinking
          </li>
        )}
      </ol>
      {error && <p role="alert" className="text-bad text-sm mb-2">{error}</p>}
      <div ref={end} />

      <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] bg-paper/95 backdrop-blur border-t border-line">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" role="group" aria-label="Quick replies">
          {(CHIPS[mode] ?? CHIPS.teach).map((c) => (
            <button key={c} type="button" onClick={() => send(c)} disabled={busy} className="chip whitespace-nowrap hover:text-ink hover:border-ink-2">
              {c}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
          className="flex items-end gap-2"
        >
          <label htmlFor="msg" className="sr-only">Your answer</label>
          <textarea
            ref={box}
            id="msg"
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
            placeholder={mode === "explain" ? "Explain it in your words" : "Your answer (Taglish OK)"}
            className="field resize-none min-h-12 max-h-40 py-3"
            autoFocus
          />
          <button className="btn-primary px-5 shrink-0" disabled={busy || !text.trim()} aria-label="Send">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </form>
      </div>
    </>
  );
}
