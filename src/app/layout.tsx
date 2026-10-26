import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Boot } from "@/components/Boot";
import { Mark } from "@/components/Mark";
import { BottomNav, TopNav } from "@/components/Nav";
import { isDemo, isMockAI } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Reve", template: "%s · Reve" },
  description: "Your Socratic study companion. Upload your slides, learn by answering, review before the exam.",
  applicationName: "Reve",
  appleWebApp: { capable: true, title: "Reve", statusBarStyle: "default" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1628" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const demo = isDemo();
  const mock = isMockAI();
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 btn-quiet">Skip to content</a>
        <Boot />
        <header className="mx-auto max-w-2xl px-4 sm:px-6 pt-[max(env(safe-area-inset-top),12px)]">
          <div className="flex items-center justify-between h-14">
            <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight" aria-label="Reve home">
              <Mark />
              reve
            </Link>
            <TopNav />
          </div>
          {(demo || mock) && (
            <p className="text-[13px] text-ink-2 pb-1">
              {demo && mock ? "Demo mode — data is saved on this server and the tutor is a simple offline stand-in. " : demo ? "Demo mode — data is saved on this server, not in Supabase. " : "Offline tutor — add a Gemini key for the real Reve. "}
              <a className="link" href="https://github.com/justinellarioza-specto/reve#setup">Setup</a>
            </p>
          )}
        </header>
        <main id="main" className="mx-auto max-w-2xl px-4 sm:px-6 pb-28 sm:pb-16">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
