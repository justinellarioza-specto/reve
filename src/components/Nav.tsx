"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Today", icon: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { href: "/review", label: "Review", icon: "M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4M12 8v4l3 2" },
  { href: "/progress", label: "Progress", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
];

function active(path: string, href: string) {
  return href === "/" ? path === "/" || path.startsWith("/subjects") || path.startsWith("/topics") : path.startsWith(href);
}

export function TopNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="hidden sm:flex gap-1">
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} aria-current={active(path, i.href) ? "page" : undefined}
          className="rounded-full px-4 py-2 text-[15px] font-semibold text-ink-2 hover:text-ink aria-[current=page]:bg-surface aria-[current=page]:text-ink aria-[current=page]:shadow-[inset_0_0_0_1px_var(--line)]">
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav() {
  const path = usePathname();
  if (path.startsWith("/login") || /\/learn$/.test(path)) return null;
  return (
    <nav aria-label="Main" className="sm:hidden fixed bottom-0 inset-x-0 z-20 border-t border-line bg-paper/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-3">
        {ITEMS.map((i) => {
          const on = active(path, i.href);
          return (
            <li key={i.href}>
              <Link href={i.href} aria-current={on ? "page" : undefined} className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold ${on ? "text-ink" : "text-ink-2"}`}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={i.icon} />
                </svg>
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
