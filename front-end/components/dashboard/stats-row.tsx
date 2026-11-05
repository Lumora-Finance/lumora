"use client";

import { ArrowUp, Check } from "lucide-react";
import { useRef } from "react";

import { fx, playOnEnter, useGSAP } from "@/lib/gsap/effects";
import { useToday } from "@/lib/use-today";

import { Panel, PanelHeading } from "./panel";

type Stat = {
  label: string;
  value: string;
  count?: { to: number; format: "integer" | "naira" };
  note: string;
  rising: boolean;
};

const STATS: Stat[] = [
  { label: "Active posts", value: "4", count: { to: 4, format: "integer" }, note: "+1 this week", rising: true },
  { label: "Bookings ahead", value: "7", count: { to: 7, format: "integer" }, note: "3 confirmed", rising: false },
  { label: "Earned", value: "₦842,000", count: { to: 842_000, format: "naira" }, note: "+12%", rising: true },
  { label: "On time", value: "18 of 19", note: "95%", rising: false },
];

/** The month in four numbers. They share one panel, split by hairlines, and never repeat elsewhere. */
export function StatsRow() {
  const scope = useRef<HTMLDivElement>(null);
  const today = useToday();
  const month = today ? new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(today) : " ";

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;
      root.querySelectorAll<HTMLElement>("[data-count]").forEach((element) => {
        const stat = STATS[Number(element.dataset.count)];
        if (stat.count) playOnEnter(fx("countUp", element, stat.count), root, "top 90%");
      });
    },
    { scope },
  );

  return (
    <Panel>
      <PanelHeading title="This month" sub={month} />
      <div ref={scope} className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-b-[20px] border-t border-line bg-line lg:grid-cols-4">
        {STATS.map((stat, index) => (
          <div key={stat.label} className="min-w-0 bg-white px-5 py-4 sm:px-6 sm:py-5">
            <p className="text-body-sm text-ink-muted">{stat.label}</p>
            <p data-count={stat.count ? index : undefined} className="mt-1 font-num text-[20px] leading-7 font-medium whitespace-nowrap text-ink sm:text-[24px] sm:leading-8">
              {stat.value}
            </p>
            <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-sage-soft px-2 py-0.5 text-xs font-medium text-green">
              {stat.rising ? (
                <ArrowUp aria-hidden="true" strokeWidth={2.5} className="size-3" />
              ) : (
                <Check aria-hidden="true" strokeWidth={2.5} className="size-3" />
              )}
              {stat.note}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
