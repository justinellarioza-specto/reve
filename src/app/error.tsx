"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="pt-16 space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Something broke on this page</h1>
      <p className="text-ink-2">{error.message || "An unexpected error happened."} Your progress so far is saved.</p>
      <button onClick={reset} className="btn-quiet">Try again</button>
    </div>
  );
}
