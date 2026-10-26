import Link from "next/link";

export default function NotFound() {
  return (
    <div className="pt-16 space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">That page isn&apos;t here</h1>
      <p className="text-ink-2">It may have been deleted, or the link is from another account.</p>
      <Link href="/" className="btn-quiet">Back to today</Link>
    </div>
  );
}
