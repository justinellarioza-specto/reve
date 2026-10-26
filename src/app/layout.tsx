import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Boot } from "@/components/Boot";
import { Mark } from "@/components/Mark";
import { BottomNav, TopNav } from "@/components/Nav";
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
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 btn-quiet">Skip to content</a>
        <Boot />
        <header className="mx-auto max-w-2xl px-4 sm:px-6 pt-[max(env(safe-area-inset-top),12px)]">
          <div className="flex items-center justify-between h-14">
            <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight" aria-label="Reve home">
              <Mark size={22} />
              reve
            </Link>
            <TopNav />
          </div>
        </header>
        <main id="main" className="mx-auto max-w-2xl px-4 sm:px-6 pb-28 sm:pb-16">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
