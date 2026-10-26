import Link from "next/link";

export function Back({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex max-w-full items-center gap-1.5 text-[15px] font-semibold text-ink-2 hover:text-ink -ml-1 px-1 py-1 rounded-md">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden className="shrink-0"><path d="M15 18l-6-6 6-6" /></svg>
      <span className="truncate">{children}</span>
    </Link>
  );
}
