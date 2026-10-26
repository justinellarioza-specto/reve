"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { gradeAnswerAction, type GradeResult } from "@/app/actions";

export type ClientQuestion = {
  id: string;
  type: "mcq" | "tf" | "fill" | "spot_error";
  prompt: string;
  options: string[];
  hint: string;
  topic_id: string;
  topic_title: string;
  color: string;
};

type Outcome = { q: ClientQuestion; correct: boolean; answer: string };

/** Retrieval practice: the student always commits to an answer before seeing it. */
export function QuestionRunner({
  items,
  mode,
  doneHref,
  doneLabel,
  title,
}: {
  items: ClientQuestion[];
  mode: "check" | "review" | "mixed";
  doneHref: string;
  doneLabel: string;
  title: string;
}) {
  const [i, setI] = useState(0);
  const [given, setGiven] = useState("");
  const [hints, setHints] = useState(0);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const started = useRef(Date.now());
  const nextBtn = useRef<HTMLButtonElement>(null);
  const q = items[i];

  useEffect(() => {
    started.current = Date.now();
  }, [i]);
  useEffect(() => {
    if (result) nextBtn.current?.focus();
  }, [result]);

  const check = useCallback(async () => {
    if (!q || !given.trim() || busy || result) return;
    setBusy(true);
    setError("");
    try {
      const r = await gradeAnswerAction({ questionId: q.id, given, hintsUsed: hints, timeMs: Date.now() - started.current, mode });
      setResult(r);
      setOutcomes((o) => [...o, { q, correct: r.correct, answer: r.answer }]);
    } catch {
      setError("Couldn't check that answer. Try again.");
    } finally {
      setBusy(false);
    }
  }, [q, given, busy, result, hints, mode]);

  const next = () => {
    setI((x) => x + 1);
    setGiven("");
    setHints(0);
    setResult(null);
  };

  // Keyboard: 1–4 pick an option, Enter checks / continues.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!q || (e.target as HTMLElement)?.tagName === "INPUT") return;
      const opts = q.type === "tf" ? ["true", "false"] : q.options;
      const n = Number(e.key);
      if (!result && n >= 1 && n <= opts.length) setGiven(opts[n - 1]);
      if (e.key === "Enter" && !result && given && (e.target as HTMLElement)?.tagName !== "BUTTON") check();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, result, given, check]);

  if (items.length === 0) {
    return (
      <div className="py-10 space-y-4">
        <p className="text-lg">Nothing to answer right now.</p>
        <Link href={doneHref} className="btn-quiet">{doneLabel}</Link>
      </div>
    );
  }

  // ── Summary
  if (!q) {
    const right = outcomes.filter((o) => o.correct).length;
    const missed = outcomes.filter((o) => !o.correct);
    const missedTopics = [...new Map(missed.map((m) => [m.q.topic_id, m.q.topic_title])).entries()];
    return (
      <div className="pt-6 space-y-8">
        <div>
          <p className="text-ink-2 font-semibold">{title} — done</p>
          <h2 className="text-[2.2rem] font-bold tracking-tight leading-tight mt-1">
            {right} of {outcomes.length} on the first try
          </h2>
          <p className="text-ink-2 mt-2 max-w-[48ch]">
            {missed.length === 0
              ? "Clean round. Reve will space these out so they stay fresh."
              : "The ones you missed come back sooner — that's on purpose. Getting them wrong now is how they stick."}
          </p>
        </div>
        {missed.length > 0 && (
          <section aria-labelledby="missed-h">
            <h3 id="missed-h" className="font-bold mb-2">Worth another look</h3>
            <ul className="divide-y divide-line border-y border-line">
              {missed.map((m) => (
                <li key={m.q.id} className="py-3">
                  <p>{m.q.prompt}</p>
                  <p className="text-sm text-ink-2 mt-1">Answer: <span className="font-semibold text-ink">{m.answer}</span></p>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              {missedTopics.map(([tid, tt]) => (
                <Link key={tid} href={`/topics/${tid}/learn?mode=teach`} className="btn-quiet btn-sm">Talk {tt} through with Reve</Link>
              ))}
            </div>
          </section>
        )}
        <Link href={doneHref} className="btn-primary w-full sm:w-auto sm:px-8">{doneLabel}</Link>
      </div>
    );
  }

  const opts = q.type === "tf" ? ["true", "false"] : q.options;
  const label = (o: string) => (q.type === "tf" ? (o === "true" ? "True" : "False") : o);

  return (
    <div className="pt-4 space-y-6">
      <div className="flex items-center gap-3" aria-label={`Question ${i + 1} of ${items.length}`}>
        <div className="flex-1 flex gap-1" aria-hidden>
          {items.map((_, k) => (
            <span key={k} className="h-1.5 flex-1 rounded-full" style={{ background: k < i ? q.color : k === i ? "var(--ink-2)" : "var(--ring-track)" }} />
          ))}
        </div>
        <span className="text-sm tabular-nums text-ink-2">{i + 1}/{items.length}</span>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink-2">
          {q.topic_title} · {q.type === "mcq" ? "Choose one" : q.type === "tf" ? "True or false?" : q.type === "fill" ? "Fill in the blank" : "Spot the error"}
        </p>
        {q.type === "spot_error" && <p className="mt-2 text-ink-2">Which part of this statement is wrong?</p>}
        <h2 className={`mt-2 text-[1.45rem] leading-snug font-semibold text-balance ${q.type === "spot_error" ? "rounded-2xl bg-sunk px-4 py-3 font-normal" : ""}`}>
          {q.type === "fill"
            ? q.prompt.split("_____").map((part, k, arr) => (
                <span key={k}>
                  {part}
                  {k < arr.length - 1 && <span className="inline-block min-w-16 border-b-2 border-ink-2 mx-1 align-baseline" aria-label="blank">&nbsp;</span>}
                </span>
              ))
            : q.prompt}
        </h2>
      </div>

      {q.type === "fill" ? (
        <form onSubmit={(e) => { e.preventDefault(); check(); }}>
          <label htmlFor="ans" className="sr-only">Your answer</label>
          <input id="ans" value={given} onChange={(e) => setGiven(e.target.value)} disabled={!!result} autoFocus autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="Type your answer" className="field text-lg" />
        </form>
      ) : (
        <div role="radiogroup" aria-label="Options" className={`grid gap-2 ${q.type === "tf" ? "grid-cols-2" : ""}`}>
          {opts.map((o, k) => {
            const chosen = given === o;
            const isAnswer = result && (q.type === "tf" ? label(o) === result.answer : o === result.answer);
            const state = result ? (isAnswer ? "border-good bg-good-bg" : chosen ? "border-bad bg-bad-bg" : "border-line opacity-60") : chosen ? "border-ink bg-surface shadow-[inset_0_0_0_1px_var(--ink)]" : "border-line bg-surface hover:border-ink-2";
            return (
              <button key={o} type="button" role="radio" aria-checked={chosen} disabled={!!result} onClick={() => setGiven(o)}
                className={`flex items-center gap-3 text-left rounded-2xl border px-4 py-3.5 min-h-14 ${state}`}>
                <span className="size-6 shrink-0 grid place-items-center rounded-full border border-line text-xs font-semibold tabular-nums text-ink-2" aria-hidden>{k + 1}</span>
                <span className="flex-1">{label(o)}</span>
              </button>
            );
          })}
        </div>
      )}

      {!result && (
        <div className="space-y-3">
          {hints > 0 && q.hint && <p className="rounded-2xl bg-sunk px-4 py-3"><span className="font-semibold">Hint: </span>{q.hint}</p>}
          {error && <p role="alert" className="text-bad">{error}</p>}
          <div className="flex items-center gap-2">
            <button onClick={check} disabled={!given.trim() || busy} className="btn-primary flex-1 sm:flex-none sm:px-10">{busy ? "Checking…" : "Check"}</button>
            {q.hint && hints === 0 && <button onClick={() => setHints(1)} className="btn-ghost">Hint</button>}
          </div>
          <p className="text-sm text-ink-2">Commit to an answer first — even a guess helps you remember.</p>
        </div>
      )}

      {result && (
        <div role="status" className={`rise rounded-3xl px-5 py-4 ${result.correct ? "bg-good-bg" : "bg-bad-bg"}`}>
          <p className={`font-bold ${result.correct ? "text-good" : "text-bad"}`}>{result.correct ? (hints ? "Right — with a hint." : "Right.") : "Not quite."}</p>
          {!result.correct && <p className="mt-1">Answer: <span className="font-semibold">{result.answer}</span></p>}
          {result.explanation && <p className="mt-2"><span className="font-semibold">Why: </span>{result.explanation}</p>}
          {result.source_label && <p className="mt-2 text-sm text-ink-2">From {result.source_label}</p>}
          <button ref={nextBtn} onClick={next} className="btn-primary mt-4 w-full sm:w-auto sm:px-10">{i + 1 < items.length ? "Next" : "See results"}</button>
        </div>
      )}
    </div>
  );
}
