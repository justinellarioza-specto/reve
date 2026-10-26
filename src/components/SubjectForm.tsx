"use client";
import { useActionState } from "react";
import type { FormState } from "@/app/actions";

const COLORS = [
  ["#E36414", "Orange"],
  ["#2563EB", "Blue"],
  ["#0F766E", "Teal"],
  ["#7C3AED", "Violet"],
  ["#BE185D", "Pink"],
  ["#B45309", "Amber"],
];

export function SubjectForm({
  action,
  initial,
  submitLabel,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  initial?: { name: string; color: string; exam_date: string | null };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-6">
      <div>
        <label htmlFor="name" className="label">Subject name</label>
        <input id="name" name="name" required maxLength={80} defaultValue={initial?.name} placeholder="e.g. Data Structures" className="field text-lg" autoFocus={!initial} />
      </div>
      <fieldset>
        <legend className="label">Color</legend>
        <div className="flex flex-wrap gap-3">
          {COLORS.map(([hex, name], i) => (
            <label key={hex} className="relative cursor-pointer">
              <input type="radio" name="color" value={hex} defaultChecked={initial ? initial.color === hex : i === 0} className="peer sr-only" />
              <span className="block size-11 rounded-full ring-offset-2 ring-offset-paper peer-checked:ring-[3px] peer-checked:ring-ink peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-accent" style={{ background: hex }} />
              <span className="sr-only">{name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="exam_date" className="label">Exam date <span className="font-normal text-ink-2">(optional, but it unlocks your countdown plan)</span></label>
        <input id="exam_date" name="exam_date" type="date" defaultValue={initial?.exam_date ?? ""} className="field" />
      </div>
      {state?.error && <p role="alert" className="text-bad font-semibold">{state.error}</p>}
      <button className="btn-primary w-full sm:w-auto" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
    </form>
  );
}
