import Link from "next/link";
import type { NextStep } from "@/lib/next";

/** The one main action on a screen. Big type, one orange button. */
export function NextCard({ step, eyebrow = "Next" }: { step: NextStep; eyebrow?: string }) {
  return (
    <section aria-labelledby="next-h" className="relative overflow-hidden rounded-[28px] bg-surface p-6 sm:p-8 shadow-[inset_0_0_0_1px_var(--line)]">
      <span aria-hidden className="absolute left-0 top-6 bottom-6 w-1.5 rounded-r-full" style={{ background: step.color ?? "var(--accent)" }} />
      <p className="text-[15px] font-semibold text-ink-2">{eyebrow}</p>
      <h1 id="next-h" className="mt-1 text-[1.9rem] sm:text-[2.3rem] leading-[1.12] font-bold tracking-[-0.015em] text-balance">{step.headline}</h1>
      <p className="mt-3 text-ink-2 max-w-[46ch]">{step.detail}</p>
      <Link href={step.href} className="btn-primary mt-6 w-full sm:w-auto sm:px-8">{step.cta}</Link>
    </section>
  );
}
