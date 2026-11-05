"use client";

import Link from "next/link";

import { HILLS_ACTION, HillsCard } from "@/components/profile/hills-card";
import { Skeleton } from "@/components/ui/skeleton";
import { dayAndClock, relativeDay } from "@/lib/email/format";
import { type DashboardBooking, otherParty, upcoming } from "@/lib/dashboard-data";
import { useDashboardData } from "@/lib/hooks/use-dashboard-data";
import { useToday } from "@/lib/use-today";

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
    <HillsCard>
      <div className="flex flex-col gap-6 px-5 pt-24 pb-6 sm:flex-row sm:items-end sm:justify-between sm:px-10 sm:pt-28 sm:pb-9 lg:px-14 lg:pt-32 lg:pb-10">
        {loading ? (
          <div role="status" aria-label="Getting your day ready" className="w-full space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-72 max-w-full" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
        ) : (
          <>
            <div className="min-w-0">
              <p data-card="rise" className="text-body-sm font-medium text-ink/70">{label}</p>
              <h2 data-card="rise" className="mt-1 text-[26px] leading-tight font-medium tracking-tight break-words text-ink sm:text-[34px]">{title}</h2>
              <p data-card="rise" className="mt-1 text-body text-ink/80">{detail}</p>
            </div>
            <div data-card="pop" className="sm:shrink-0">
              <Link href={href} className={HILLS_ACTION}>{action}</Link>
            </div>
          </>
        )}
      </div>
    </HillsCard>
  );
}
