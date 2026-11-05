"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useRef, useState } from "react";

import { ChartSkeleton } from "@/components/loader/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardSettlement } from "@/lib/dashboard-data";
import { useDashboardData } from "@/lib/hooks/use-dashboard-data";
import { formatKobo } from "@/lib/money/rules";
import { gsap, isReducedMotion, playOnEnter, useGSAP } from "@/lib/gsap/effects";
import { useToday } from "@/lib/use-today";
import { cn } from "@/lib/utils";

import { Panel, PanelHeading, PanelLink } from "./panel";

const MONTHS = 6;

const thousands = (kobo: number) => (kobo >= 100_000 ? `₦${Math.round(kobo / 100_000)}k` : formatKobo(kobo));

/** What was paid out in each of the last six months, oldest first, with their short names. */
function byMonth(today: Date | null, settlements: DashboardSettlement[]) {
  return Array.from({ length: MONTHS }, (_, index) => {
    if (!today) return { name: "\u00A0", kobo: 0 };
    const start = new Date(today.getFullYear(), today.getMonth() - (MONTHS - 1 - index), 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const kobo = settlements
      .filter((row) => {
        const at = new Date(row.created_at);
        return at >= start && at < end;
      })
      .reduce((sum, row) => sum + row.net_kobo, 0);
    return { name: new Intl.DateTimeFormat("en-GB", { month: "short" }).format(start), kobo };
  });
}

/** One series, so one colour: the chosen month stands out, and pointing at another shows its figures. */
export function MoneyChart() {
  const bars = useRef<HTMLDivElement>(null);
  const today = useToday();
  const { data, loading } = useDashboardData<DashboardSettlement[]>("transactions");
  const months = byMonth(today, Array.isArray(data) ? data : []);
  const [chosen, setChosen] = useState(MONTHS - 1);

  const top = Math.max(...months.map((month) => month.kobo), 1);
  const average = Math.round(months.reduce((sum, month) => sum + month.kobo, 0) / MONTHS);
  const hasMoney = months.some((month) => month.kobo > 0);
  const value = months[chosen].kobo;
  const previous = months[chosen - 1]?.kobo;
  const change = previous ? Math.round(((value - previous) / previous) * 100) : null;

  useGSAP(
    () => {
      const root = bars.current;
      if (!root || isReducedMotion()) return;
      const animation = gsap.fromTo(
        root.querySelectorAll("[data-bar]"),
        { scaleY: 0 },
        { scaleY: 1, duration: 0.9, ease: "expo.out", stagger: 0.06, transformOrigin: "bottom", clearProps: "transform" },
      );
      playOnEnter(animation, root, "top 95%");
    },
    { scope: bars, dependencies: [hasMoney] },
  );

  return (
    <Panel className="flex h-full flex-col">
      <PanelHeading title="Money earned" sub="Pick a month to see it" action={<PanelLink href="/dashboard/transactions">Details</PanelLink>} />
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 px-5 pt-4 sm:px-6">
        {loading ? (
          <Skeleton className="h-9 w-44 sm:h-10" />
        ) : (
          <p aria-live="polite" className="font-num text-[30px] leading-9 font-medium text-ink sm:text-[36px] sm:leading-10">
            {formatKobo(value)}
          </p>
        )}
        {change !== null && (
          <p className="flex items-center gap-2 pb-1 text-body-sm text-ink-muted">
            <span className="inline-flex items-center gap-1 rounded-full bg-sage-soft px-2 py-0.5 text-xs font-medium text-green">
              {change >= 0 ? <ArrowUp aria-hidden="true" strokeWidth={2.5} className="size-3" /> : <ArrowDown aria-hidden="true" strokeWidth={2.5} className="size-3" />}
              {Math.abs(change)}%
            </span>
            vs the month before
          </p>
        )}
      </div>

      {loading && (
        <div className="mt-auto px-5 pt-6 pb-5 sm:px-6 sm:pb-6">
          <ChartSkeleton label="Loading your money" />
        </div>
      )}
      {!hasMoney && !loading && (
        <p className="mt-auto px-5 pt-6 pb-6 text-center text-body-sm text-ink-muted sm:px-6">
          Money from your deliveries will build up here, month by month.
        </p>
      )}
      <div ref={bars} className={cn("relative mt-auto px-5 pt-6 pb-5 sm:px-6 sm:pb-6", !hasMoney && "hidden")}>
        <div className="relative h-52 sm:h-56">
          <div role="group" aria-label="Money earned by month" className="absolute inset-0 flex items-end gap-1.5 sm:gap-2.5">
            {months.map(({ kobo: amount, name }, index) => {
              const selected = index === chosen;
              return (
                <button
                  key={index}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${name}: ${formatKobo(amount)}`}
                  onClick={() => setChosen(index)}
                  onPointerEnter={(event) => {
                    if (event.pointerType === "mouse") setChosen(index);
                  }}
                  className="group flex h-full min-w-0 flex-1 cursor-pointer items-end rounded-xl [-webkit-tap-highlight-color:transparent] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span
                    data-bar
                    style={{ height: `max(${(amount / top) * 100}%, 4px)` }}
                    className={cn(
                      "flex w-full justify-center rounded-t-xl rounded-b-sm pt-2.5 transition-colors duration-200 motion-reduce:transition-none",
                      selected ? "bg-field" : "bg-sage/35 group-hover:bg-sage/55",
                    )}
                  >
                    {selected && amount > 0 && <span className="font-num text-[11px] leading-4 font-medium text-paper sm:text-xs">{thousands(amount)}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Average. Above the bars so it reads across them, and out of the way of the pointer. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink/35" style={{ bottom: `${(average / top) * 100}%` }}>
            <span className="absolute -top-2.5 left-0 rounded-md bg-ink px-1.5 py-0.5 font-num text-[10px] leading-3.5 text-paper">
              Avg {thousands(average)}
            </span>
          </div>
        </div>
        <div aria-hidden="true" className="mt-2 flex gap-1.5 sm:gap-2.5">
          {months.map(({ name }, index) => (
            <span key={index} className={cn("min-w-0 flex-1 text-center text-body-sm", index === chosen ? "font-medium text-ink" : "text-ink-muted")}>
              {name}
            </span>
          ))}
        </div>
      </div>
    </Panel>
  );
}
