"use client";
import { useActionState, useRef, useState } from "react";
import type { FormState } from "@/app/actions";

export function UploadForm({ action }: { action: (s: FormState, f: FormData) => Promise<FormState> }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [tab, setTab] = useState<"file" | "paste">("file");
  const [names, setNames] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  return (
    <form action={formAction} className="space-y-6" aria-busy={pending}>
      <div role="tablist" aria-label="How to add material" className="inline-flex rounded-full bg-sunk p-1">
        {(["file", "paste"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`rounded-full px-5 py-2 text-[15px] font-semibold ${tab === t ? "bg-surface text-ink border border-line" : "text-ink-2"}`}>
            {t === "file" ? "Upload files" : "Paste notes"}
          </button>
        ))}
      </div>

      <div hidden={tab !== "file"}>
        <label
          htmlFor="files"
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (input.current && e.dataTransfer.files.length) {
              input.current.files = e.dataTransfer.files;
              setNames(Array.from(e.dataTransfer.files).map((f) => f.name));
            }
          }}
          className={`flex flex-col items-center justify-center text-center gap-2 rounded-2xl border-2 border-dashed px-6 py-12 cursor-pointer ${drag ? "border-accent bg-surface" : "border-line hover:border-ink-2"}`}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-ink-2">
            <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
          </svg>
          <span className="font-semibold">{names.length ? names.join(", ") : "Choose files or drop them here"}</span>
          <span className="text-sm text-ink-2">PDF, PPTX, DOCX or TXT · up to 20 MB each</span>
        </label>
        <input ref={input} id="files" name="files" type="file" multiple className="sr-only"
          accept=".pdf,.pptx,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onChange={(e) => setNames(Array.from(e.target.files ?? []).map((f) => f.name))} />
      </div>

      <div hidden={tab !== "paste"} className="space-y-4">
        <div>
          <label htmlFor="title" className="label">Title</label>
          <input id="title" name="title" className="field" placeholder="e.g. Week 5 lecture notes" />
        </div>
        <div>
          <label htmlFor="text" className="label">Notes</label>
          <textarea id="text" name="text" rows={10} className="field font-normal leading-relaxed" placeholder={"Paste your notes here.\nHeadings on their own line (or starting with #) become topic breaks."} />
        </div>
      </div>

      {state?.error && <p role="alert" className="text-bad font-semibold">{state.error}</p>}
      <div className="flex items-center gap-4">
        <button className="btn-primary" disabled={pending}>{pending ? "Reading your material…" : "Make my lessons"}</button>
        {pending && <span className="text-sm text-ink-2" aria-live="polite">This takes a few seconds per file.</span>}
      </div>
    </form>
  );
}
