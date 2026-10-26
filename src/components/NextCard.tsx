import Link from "next/link";
import type { NextStep } from "@/lib/next";

/** The one main action on a screen. */
export function NextCard({ step, eyebrow = "Up next" }: { step: NextStep; eyebrow?: string }) {
  return (
    <section aria-labelledby="next-h" className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm text-ink-2 flex items-center gap-2">
        <span aria-hidden className="size-2 rounded-full" style={{ background: step.color ?? "var(--accent)" }} />
        {eyebrow}
      </p>
      <h1 id="next-h" className="mt-2 text-xl font-semibold leading-snug text-balance">{step.headline}</h1>
      <p className="mt-1 text-[15px] text-ink-2">{step.detail}</p>
      <Link href={step.href} className="btn-primary mt-4 w-full">{step.cta}</Link>
    </section>
  );
}
