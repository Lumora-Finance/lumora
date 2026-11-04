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
    iconBg: "bg-green/10",
    delta: "+1 this week",
    // Card shape 1: ticket cut — notched bottom-right corner via clip-path
    cardClass: "bg-white",
    style: { clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%)" },
    accentStyle: "border-l-[3px] border-l-green",
  },
  {
    label: "Upcoming Bookings",
    value: "7",
    sub: "Next: Tomorrow, 7am",
    icon: BookOpen,
    color: "text-amber",
    iconBg: "bg-amber/10",
    delta: "3 confirmed",
    // Card shape 2: slanted top-right corner
    cardClass: "bg-field text-paper",
    style: { clipPath: "polygon(0 0, calc(100% - 24px) 0, 100% 24px, 100% 100%, 0 100%)" },
    accentStyle: "",
  },
  {
    label: "This Month",
    value: "₦842k",
    sub: "Across 11 trades",
    icon: TrendingUp,
    color: "text-amber",
    iconBg: "bg-amber/20",
    delta: "+12% vs last month",
    // Card shape 3: diagonal cut bottom-left
    cardClass: "bg-amber-soft",
    style: { clipPath: "polygon(0 0, 100% 0, 100% 100%, 24px 100%, 0 calc(100% - 24px))" },
    accentStyle: "border-t-[3px] border-t-amber",
  },
];

export function StatsRow() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
      {STATS.map((stat) => {
        const Icon = stat.icon;
        const isDark = stat.cardClass.includes("bg-field");
        return (
          <div
            key={stat.label}
            className={cn(
              "group relative overflow-hidden p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg",
              stat.cardClass,
              stat.accentStyle,
            )}
            style={stat.style}
          >
            {/* Background stripe texture */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  ${isDark ? "135deg" : "45deg"},
                  transparent,
                  transparent 20px,
                  ${isDark ? "rgba(143,184,164,0.04)" : "rgba(31,92,69,0.03)"} 20px,
                  ${isDark ? "rgba(143,184,164,0.04)" : "rgba(31,92,69,0.03)"} 21px
                )`,
              }}
            />

            {/* Glow blob */}
            <div
              aria-hidden
              className={cn(
                "absolute -right-6 -top-6 size-28 rounded-full blur-2xl transition-opacity duration-300 group-hover:opacity-70",
                isDark ? "bg-sage/10 opacity-40" : "bg-green/8 opacity-30",
              )}
            />

            <div className="relative flex items-start justify-between gap-2">
              <div className={cn("flex size-9 items-center justify-center rounded-[8px_2px_8px_2px]", stat.iconBg)}>
                <Icon strokeWidth={1.5} className={cn("size-5", isDark ? "text-sage" : stat.color)} />
              </div>
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-0.5 font-num text-label",
                  isDark ? "bg-sage/20 text-sage" : "bg-sage-soft text-green",
                )}
              >
                <ArrowUpRight strokeWidth={2} className="size-3" />
                {stat.delta}
              </span>
            </div>

            <div className="relative mt-4">
              <p className={cn("font-num text-number-lg font-medium", isDark ? "text-paper" : "text-ink")}>
                {stat.value}
              </p>
              <p className={cn("mt-0.5 text-body font-medium", isDark ? "text-paper" : "text-ink")}>
                {stat.label}
              </p>
              <p className={cn("mt-0.5 text-body-sm", isDark ? "text-sage/60" : "text-ink-muted")}>
                {stat.sub}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
