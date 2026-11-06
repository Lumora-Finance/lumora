import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh bg-paper text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-2 px-4 md:px-8">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center gap-2 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Image
              src="/brand/lumora-mark.png"
              alt=""
              width={1024}
              height={945}
              className="h-6 w-auto"
            />
            <span className="font-display text-xl font-medium">lumora</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 md:px-8 md:py-16">
        {children}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-body-sm text-ink-muted md:px-8">
          <span>© 2026 Lumora</span>
          <Link href="/legal/terms" className="hover:text-ink hover:underline underline-offset-4">
            Terms &amp; Conditions
          </Link>
          <Link href="/legal/privacy" className="hover:text-ink hover:underline underline-offset-4">
            Privacy Policy
          </Link>
          <Link href="/" className="hover:text-ink hover:underline underline-offset-4">
            Back to home
          </Link>
        </div>
      </footer>
    </div>
  );
}
