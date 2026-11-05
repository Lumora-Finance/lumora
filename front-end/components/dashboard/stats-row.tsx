"use client";

import { ArrowUpRight, BookOpen, ShoppingBag, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardData } from "@/lib/hooks/use-dashboard-data";

type Stats = {
  activePosts: number;
  upcomingBookings: number;
  monthlyKobo: number;
  monthlyCount: number;
};

function formatNaira(kobo: number): string {
  const naira = kobo / 100;
  if (naira >= 1_000_000) return `₦${(naira / 1_000_000).toFixed(1)}M`;
  if (naira >= 1_000) return `₦${Math.round(naira / 1000)}k`;
  return `₦${naira.toLocaleString("en-NG")}`;
}

export function StatsRow() {
  const { data, loading } = useDashboardData<Stats>("stats");

  const stats = [
    {
      label: "Active Posts",
      value: loading ? "…" : String(data?.activePosts ?? 0),
      sub: "Demand and listings",
      icon: ShoppingBag,
      color: "text-green",
      iconBg: "bg-green/10",
      delta: "Live",
      cardClass: "bg-white border-l-[3px] border-l-green",
      dark: false,
    },
    {
      label: "Upcoming Bookings",
      value: loading ? "…" : String(data?.upcomingBookings ?? 0),
      sub: "Confirmed and booked",
      icon: BookOpen,
      color: "text-amber",
      iconBg: "bg-amber/10",
      delta: "Active",
      cardClass: "bg-field",
      dark: true,
    },
    {
      label: "This Month",
      value: loading ? "…" : formatNaira(data?.monthlyKobo ?? 0),
      sub: `Across ${data?.monthlyCount ?? 0} trades`,
      icon: TrendingUp,
      color: "text-amber",
      iconBg: "bg-amber/20",
      delta: "Settled",
      cardClass: "bg-amber-soft border-t-[3px] border-t-amber",
      dark: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className={cn(
              "group relative overflow-hidden rounded-xl border border-line p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg",
              stat.cardClass,
            )}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  ${stat.dark ? "135deg" : "45deg"},
                  transparent, transparent 20px,
                  ${stat.dark ? "rgba(143,184,164,0.04)" : "rgba(31,92,69,0.03)"} 20px,
                  ${stat.dark ? "rgba(143,184,164,0.04)" : "rgba(31,92,69,0.03)"} 21px
                )`,
              }}
            />
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute -right-6 -top-6 size-28 rounded-full blur-2xl opacity-30 transition-opacity duration-300 group-hover:opacity-60",
                stat.dark ? "bg-sage/10" : "bg-green/8",
              )}
            />

            <div className="relative flex items-start justify-between gap-2">
              <div className={cn("flex size-9 items-center justify-center rounded-xl", stat.iconBg)}>
                <Icon
                  strokeWidth={1.5}
                  className={cn("size-5", stat.dark ? "text-sage" : stat.color)}
                />
              </div>
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-0.5 font-num text-label",
                  stat.dark ? "bg-sage/20 text-sage" : "bg-sage-soft text-green",
                )}
              >
                <ArrowUpRight strokeWidth={2} className="size-3" />
                {stat.delta}
              </span>
            </div>

            <div className="relative mt-4">
              <p
                className={cn(
                  "font-num text-number-lg font-medium",
                  stat.dark ? "text-paper" : "text-ink",
                )}
              >
                {stat.value}
              </p>
              <p className={cn("mt-0.5 text-body font-medium", stat.dark ? "text-paper" : "text-ink")}>
                {stat.label}
              </p>
              <p className={cn("mt-0.5 text-body-sm", stat.dark ? "text-sage/60" : "text-ink-muted")}>
                {stat.sub}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
