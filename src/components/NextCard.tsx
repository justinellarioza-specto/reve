import Link from "next/link";
import type { NextStep } from "@/lib/next";

/**
 * The one main action on a screen. No card, no label above the heading:
 * the heading says what to do, the button does it.
 */
export function NextCard({ step, compact = false }: { step: NextStep; compact?: boolean }) {
  if (compact)
    return (
      <section aria-label="Next step" className="space-y-3">
        <p className="text-[15px] text-ink-2">
          <span className="text-ink font-medium">{step.headline}.</span> {step.detail}
        </p>
        <Link href={step.href} className="btn-primary w-full">{step.cta}</Link>
      </section>
    );
  return (
    <section aria-labelledby="next-h" className="space-y-3">
      <h1 id="next-h" className="text-2xl font-semibold leading-tight tracking-tight text-balance">{step.headline}</h1>
      <p className="text-[15px] text-ink-2 max-w-[60ch]">{step.detail}</p>
      <Link href={step.href} className="btn-primary w-full mt-2">{step.cta}</Link>
    </section>
  );
}
