"use client";

import { Bird, Egg, type LucideIcon, ShoppingBasket, Sprout } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { RowsSkeleton } from "@/components/loader/skeletons";
import { type DashboardBooking, otherParty, upcoming } from "@/lib/dashboard-data";
import { clock } from "@/lib/email/format";
import { useDashboardData } from "@/lib/hooks/use-dashboard-data";
import { useToday } from "@/lib/use-today";
import { cn } from "@/lib/utils";

import { Panel, PanelHeading, PanelLink } from "./panel";

const WEEK = Array.from({ length: 7 }, (_, index) => index);
const TONES = ["bg-amber-soft", "bg-sage-soft", "bg-paper"];
const MOST_SHOWN = 4;

const STATUS_WORDS: Record<string, string> = {
  pending_approval: "Waiting",
  booked: "To confirm",
  confirmed: "Confirmed",
  contested: "At the gate",
};

const iconFor = (commodity: string): LucideIcon => {
  const name = commodity.toLowerCase();
  if (name.includes("egg")) return Egg;
  if (name.includes("tomato") || name.includes("basket")) return ShoppingBasket;
  if (name.includes("chicken") || name.includes("broiler") || name.includes("turkey")) return Bird;
  return Sprout;
};

const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const format = (date: Date, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", options).format(date);

/** Whole days from today. A delivery already under way counts as today. */
function daysAway(iso: string, today: Date) {
  const start = addDays(today, 0).getTime();
  const at = new Date(iso);
  const day = new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();
  return Math.max(Math.round((day - start) / 86_400_000), 0);
}

/** The coming week, then what's on it. Picking a day narrows the list, and picking it again clears it. */
export function Schedule() {
  const today = useToday();
  const { data, loading } = useDashboardData<DashboardBooking[]>("bookings");
  const [picked, setPicked] = useState<number | null>(null);

  const bookings = today ? upcoming(data).map((booking) => ({ ...booking, inDays: daysAway(booking.window_start, today) })) : [];
  const shown = bookings.filter((booking) => picked === null || booking.inDays === picked).slice(0, MOST_SHOWN);

  const dayLabel = (inDays: number) => {
    if (inDays === 0) return "Today";
    if (inDays === 1) return "Tomorrow";
    return today ? format(addDays(today, inDays), { weekday: "long", day: "numeric", month: "short" }) : " ";
  };

  return (
    <Panel className="flex h-full flex-col">
      <PanelHeading
        title="Your week"
        sub={today ? format(today, { month: "long", year: "numeric" }) : " "}
        action={<PanelLink href="/dashboard/bookings">All bookings</PanelLink>}
      />

      <div className="mt-4 grid grid-cols-7 gap-0.5 px-3 sm:px-4">
        {WEEK.map((inDays) => {
          const date = today ? addDays(today, inDays) : null;
          const selected = picked === inDays;
          const hasBooking = bookings.some((booking) => booking.inDays === inDays);
          return (
            <button
              key={inDays}
              type="button"
              aria-pressed={selected}
              aria-label={date ? `${format(date, { weekday: "long", day: "numeric", month: "long" })}${hasBooking ? ", has a booking" : ""}` : undefined}
              onClick={() => setPicked(selected ? null : inDays)}
              className="flex min-h-[68px] min-w-0 flex-col items-center gap-1 rounded-2xl py-1 [-webkit-tap-highlight-color:transparent] transition-colors duration-150 hover:bg-paper focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="text-xs text-ink-muted">{date ? format(date, { weekday: "short" }) : " "}</span>
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full font-num text-body-sm transition-colors duration-150",
                  selected ? "bg-field text-paper" : inDays === 0 ? "bg-sage-soft font-medium text-green" : "text-ink",
                )}
              >
                {date ? date.getDate() : " "}
              </span>
              <span aria-hidden="true" className={cn("size-1 rounded-full", hasBooking ? "bg-amber" : "bg-transparent")} />
            </button>
          );
        })}
      </div>

      <div className="flex-1 px-5 pt-3 pb-5 sm:px-6 sm:pb-6">
        {loading ? (
          <RowsSkeleton rows={3} label="Loading your week" />
        ) : shown.length === 0 ? (
          <p className="py-6 text-center text-body-sm text-ink-muted">
            {picked === null ? "No bookings coming up. New ones will show here." : "Nothing booked on this day."}
          </p>
        ) : (
          <ul className="space-y-3">
            {shown.map((booking, index) => {
              const Icon = iconFor(booking.commodity);
              return (
                <li key={booking.id}>
                  <p className="flex items-center gap-2 text-xs text-ink-muted">
                    {dayLabel(booking.inDays)}
                    <span aria-hidden="true" className="h-px flex-1 border-t border-dashed border-line" />
                  </p>
                  <Link
                    href={`/dashboard/bookings/${booking.id}`}
                    className={cn(
                      "mt-1.5 flex items-center gap-3 rounded-2xl p-3 transition-transform duration-150 [-webkit-tap-highlight-color:transparent] hover:-translate-y-px focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.99] motion-reduce:transition-none",
                      TONES[index % TONES.length],
                    )}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-ink">
                      <Icon aria-hidden="true" strokeWidth={1.75} className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{booking.qty} {booking.commodity}</span>
                      <span className="block text-body-sm text-ink-muted">{otherParty(booking)} · {clock(booking.window_start)}</span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-ink">{STATUS_WORDS[booking.status] ?? ""}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Panel>
  );
}
