/** Shown while a screen loads: the page's shape, not a spinner. */
export default function Loading() {
  return (
    <div className="pt-2 space-y-6 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-4 w-32 rounded bg-sunk" />
      <div className="h-7 w-3/4 rounded bg-sunk" />
      <div className="h-4 w-full rounded bg-sunk" />
      <div className="h-11 w-full rounded-xl bg-sunk" />
      <div className="space-y-4 pt-4">
        {[0, 1, 2].map((i) => <div key={i} className="h-10 rounded bg-sunk" />)}
      </div>
    </div>
  );
}
