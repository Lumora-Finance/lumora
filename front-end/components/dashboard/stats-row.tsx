"use client";

import { ArrowUpRight, BookOpen, ShoppingBag, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

const STATS = [
  {
    label: "Active Posts",
    value: "4",
    sub: "2 demand · 2 listings",
    icon: ShoppingBag,
    color: "text-green",
    bg: "bg-sage-soft",
    delta: "+1 this week",
    positive: true,
  },
  {
    label: "Upcoming Bookings",
    value: "7",
    sub: "Next: Tomorrow, 7am",
    icon: BookOpen,
    color: "text-amber",
    bg: "bg-amber-soft",
    delta: "3 confirmed",
    positive: true,
  },
  {
    label: "This Month",
    value: "₦842,000",
    sub: "Across 11 trades",
    icon: TrendingUp,
    color: "text-green",
    bg: "bg-sage-soft",
    delta: "+12% vs last month",
    positive: true,
  },
];

export function StatsRow() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {STATS.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="group relative overflow-hidden rounded-xl border border-line bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md"
          >
            {/* Subtle background shape */}
            <div
              className={cn(
                "absolute -right-4 -top-4 size-24 rounded-full opacity-30 blur-xl transition-opacity duration-300 group-hover:opacity-50",
                stat.bg,
              )}
            />

            <div className="relative flex items-start justify-between gap-3">
              <div className={cn("flex size-9 items-center justify-center rounded-lg", stat.bg)}>
                <Icon strokeWidth={1.5} className={cn("size-5", stat.color)} />
              </div>

              <span
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-0.5 font-num text-label",
                  stat.positive
                    ? "bg-sage-soft/60 text-green"
                    : "bg-danger/10 text-danger",
                )}
              >
                <ArrowUpRight
                  strokeWidth={2}
                  className={cn("size-3", !stat.positive && "rotate-90")}
                />
                {stat.delta}
              </span>
            </div>

            <div className="relative mt-4">
              <p className="font-num text-number-lg font-medium text-ink">{stat.value}</p>
              <p className="mt-0.5 text-body font-medium text-ink">{stat.label}</p>
              <p className="mt-0.5 text-body-sm text-ink-muted">{stat.sub}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
