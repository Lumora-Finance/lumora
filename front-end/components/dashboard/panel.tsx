import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** The one surface on the dashboard. Sections differ by what's in them, not by their shape. */
export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-[20px] border border-line bg-white", className)}>{children}</section>;
}

export function PanelHeading({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5 sm:px-6 sm:pt-6">
      <div className="min-w-0">
        <h2 className="text-lg leading-6 font-medium text-ink">{title}</h2>
        {sub && <p className="mt-0.5 text-body-sm text-ink-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex min-h-9 items-center gap-1.5 rounded-xl px-2 text-body-sm font-medium text-ink-muted transition-colors duration-150 hover:bg-sage-soft hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none max-lg:min-h-11"
    >
      {children}
      <ArrowRight aria-hidden="true" strokeWidth={1.75} className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
    </Link>
  );
}
