"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Skeleton } from "@/components/ui/skeleton";
import { dayAndClock, relativeDay } from "@/lib/email/format";
import { type DashboardBooking, otherParty, upcoming } from "@/lib/dashboard-data";
import { useDashboardData } from "@/lib/hooks/use-dashboard-data";
import { useToday } from "@/lib/use-today";

import { LogoVideo } from "./logo-video";

const BUTTON =
  "group mt-5 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-paper px-5 font-medium text-field transition-[background-color,transform] duration-150 hover:bg-sage-soft focus-visible:ring-3 focus-visible:ring-sage focus-visible:outline-none active:scale-[0.98] motion-reduce:active:scale-100";

/** The first thing to know on opening the app: what happens next. */
export function NextUp() {
  const { data, loading } = useDashboardData<DashboardBooking[]>("bookings");
  const today = useToday();
  const next = upcoming(data)[0];

  let label = "Next up";
  let title = loading ? " " : "Nothing booked yet";
  let detail = loading ? " " : "See who wants what you have, or post what you need.";
  let href = "/dashboard/board";
  let action = "See buyers near you";

  if (next) {
    label = today ? `Next up, ${relativeDay(next.window_start, today)}` : "Next up";
    title = `${next.qty} ${next.commodity} ${next.is_buyer ? "from" : "for"} ${otherParty(next)}`;
    detail = `${dayAndClock(next.window_start)}. Booking ${next.code}.`;
    href = `/dashboard/bookings/${next.id}`;
    action = "View booking";
  }

  return (
    <section
      data-rhythm="field"
      className="relative isolate overflow-hidden rounded-[20px] bg-field px-5 py-6 text-paper sm:px-8 sm:py-7"
    >
      {/* Beside the words on wide screens. Where it sits behind them, it stays a faint watermark. */}
      <div aria-hidden="true" className="absolute inset-0 -z-20 opacity-40 xl:opacity-100">
        <LogoVideo />
      </div>
      <p className="font-num text-[11px] leading-4 tracking-[0.08em] text-sage uppercase">{label}</p>
      {loading ? (
        <div role="status" aria-label="Getting your day ready" className="mt-2 space-y-3 pb-1">
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-5 h-11 w-40 rounded-2xl" />
        </div>
      ) : (
        <>
          <h2 className="mt-2 max-w-[30rem] font-display text-[24px] leading-[1.2] font-medium text-balance sm:text-[30px]">{title}</h2>
          <p className="mt-1.5 text-body-sm text-paper/70">{detail}</p>
        </>
      )}
      {!loading && (
        <Link href={href} className={BUTTON}>
          {action}
          <ArrowRight aria-hidden="true" strokeWidth={1.75} className="size-4 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </Link>
      )}
    </section>
  );
}
