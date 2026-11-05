"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useRef, useState } from "react";

import { formatNaira } from "@/lib/format";
import { gsap, isReducedMotion, playOnEnter, useGSAP } from "@/lib/gsap/effects";
import { useToday } from "@/lib/use-today";
import { cn } from "@/lib/utils";

import { Panel, PanelHeading, PanelLink } from "./panel";

/** Naira earned per month, oldest first. The last is this month. */
const EARNED = [520_000, 610_000, 480_000, 700_000, 752_000, 842_000];
const AVERAGE = Math.round(EARNED.reduce((sum, value) => sum + value, 0) / EARNED.length);
const TOP = Math.max(...EARNED);

const thousands = (value: number) => `₦${Math.round(value / 1000)}k`;

function monthNames(today: Date | null) {
  return EARNED.map((_, index) => {
    if (!today) return " ";
    const date = new Date(today.getFullYear(), today.getMonth() - (EARNED.length - 1 - index), 1);
    return new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date);
  });
}

/** One series, so one colour: the chosen month stands out, and pointing at another shows its figures. */
export function MoneyChart() {
  const bars = useRef<HTMLDivElement>(null);
  const today = useToday();
  const months = monthNames(today);
  const [chosen, setChosen] = useState(EARNED.length - 1);

  const value = EARNED[chosen];
  const previous = EARNED[chosen - 1];
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
    { scope: bars },
  );

  return (
    <Panel className="flex h-full flex-col">
      <PanelHeading title="Money earned" sub="Pick a month to see it" action={<PanelLink href="/dashboard/transactions">Details</PanelLink>} />
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 px-5 pt-4 sm:px-6">
        <p aria-live="polite" className="font-num text-[30px] leading-9 font-medium text-ink sm:text-[36px] sm:leading-10">
          {formatNaira(value)}
        </p>
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

      <div ref={bars} className="relative mt-auto px-5 pt-6 pb-5 sm:px-6 sm:pb-6">
        <div className="relative h-52 sm:h-56">
          <div role="group" aria-label="Money earned by month" className="absolute inset-0 flex items-end gap-1.5 sm:gap-2.5">
            {EARNED.map((amount, index) => {
              const selected = index === chosen;
              return (
                <button
                  key={index}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${months[index]}: ${formatNaira(amount)}`}
                  onClick={() => setChosen(index)}
                  onPointerEnter={(event) => {
                    if (event.pointerType === "mouse") setChosen(index);
                  }}
                  className="group flex h-full min-w-0 flex-1 cursor-pointer items-end rounded-xl [-webkit-tap-highlight-color:transparent] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span
                    data-bar
                    style={{ height: `${(amount / TOP) * 100}%` }}
                    className={cn(
                      "flex w-full justify-center rounded-t-xl rounded-b-sm pt-2.5 transition-colors duration-200 motion-reduce:transition-none",
                      selected ? "bg-field" : "bg-sage/35 group-hover:bg-sage/55",
                    )}
                  >
                    {selected && <span className="font-num text-[11px] leading-4 font-medium text-paper sm:text-xs">{thousands(amount)}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Average. Above the bars so it reads across them, and out of the way of the pointer. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink/35" style={{ bottom: `${(AVERAGE / TOP) * 100}%` }}>
            <span className="absolute -top-2.5 left-0 rounded-md bg-ink px-1.5 py-0.5 font-num text-[10px] leading-3.5 text-paper">
              Avg {thousands(AVERAGE)}
            </span>
          </div>
        </div>
        <div aria-hidden="true" className="mt-2 flex gap-1.5 sm:gap-2.5">
          {months.map((name, index) => (
            <span key={index} className={cn("min-w-0 flex-1 text-center text-body-sm", index === chosen ? "font-medium text-ink" : "text-ink-muted")}>
              {name}
            </span>
          ))}
        </div>
      </div>
    </Panel>
  );
}
