"use client";

import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";

import { DEFAULT_PRODUCE, type Produce } from "@/lib/demo/demand";
import { formatNaira } from "@/lib/format";
import { fx, gsap, isReducedMotion, playOnEnter, useGSAP } from "@/lib/gsap/effects";

import { CONTAINER, EYEBROW } from "./shared";

const WIDTH = 680;
const HEIGHT = 200;
// Keeps the end dots inside the chart. The baseline sits on the last pixel row.
const SIDE_MARGIN = 8;
const WEEKS = 8;
const STEP = (WIDTH - SIDE_MARGIN * 2) / (WEEKS - 1);

const xAt = (index: number) => SIDE_MARGIN + index * STEP;

/** Each dataset fills the chart on its own scale, with 25% padding, so its shape always reads. */
function normalise(prices: number[]) {
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const padding = (max - min) * 0.25;
  const low = min - padding;
  const high = max + padding;
  return prices.map((price) => HEIGHT * (1 - (price - low) / (high - low)));
}

function curve(ys: number[]) {
  return ys.reduce((d, y, index) => {
    if (index === 0) return `M${xAt(0)} ${y}`;
    const middle = (xAt(index - 1) + xAt(index)) / 2;
    return `${d}C${middle} ${ys[index - 1]} ${middle} ${y} ${xAt(index)} ${y}`;
  }, "");
}

function percentChange({ prices }: Produce) {
  if (prices.length < 2 || prices[0] === 0) return "—";
  const change = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;
  const size = Math.abs(change).toFixed(1);
  return `${change >= 0 ? "+" : "−"}${size}%`;
}

const lastPrice = ({ prices }: Produce) => prices[prices.length - 1];

const dotPosition = (index: number, y: number) => ({
  left: `${(xAt(index) / WIDTH) * 100}%`,
  top: `${(y / HEIGHT) * 100}%`,
});

export function DemandExplorer() {
  const scope = useRef<HTMLElement>(null);
  const line = useRef<SVGPathElement>(null);
  const endDot = useRef<HTMLSpanElement>(null);
  const chart = useRef<HTMLDivElement>(null);
  const scrubLine = useRef<HTMLSpanElement>(null);
  const scrubDot = useRef<HTMLSpanElement>(null);
  const scrubLabel = useRef<HTMLSpanElement>(null);
  const bigNumber = useRef<HTMLSpanElement>(null);
  const average = useRef<HTMLParagraphElement>(null);
  const verdict = useRef<HTMLParagraphElement>(null);

  const [demand, setDemand] = useState<Produce[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(DEFAULT_PRODUCE);

  // Fetch real demand data from the API.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/demand");
        if (!res.ok) return;
        const data = (await res.json()) as Produce[];
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setDemand(data);
          // Select the first commodity or the default.
          const match = data.find((p) => p.key === DEFAULT_PRODUCE);
          setSelected(match ? match.key : data[0].key);
        }
      } catch {
        // Silent fail — the UI shows an empty state.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const findProduce = (key: string) => demand.find((item) => item.key === key) ?? demand[0];
  const produce = findProduce(selected);

  // The chart and rolling numbers are drawn every frame, so they live outside React's renders.
  const live = useRef({
    produce: null as Produce | null,
    ys: [] as number[],
    number: 0,
    average: 0,
    scrub: null as number | null,
    intro: null as gsap.core.Animation | null,
    motion: [] as gsap.core.Animation[],
  });

  // Initialise live refs when demand data arrives or selection changes.
  useEffect(() => {
    if (!produce) return;
    const ys = normalise(produce.prices);
    live.current = {
      ...live.current,
      produce,
      ys,
      number: produce.weeklyDemand,
      average: lastPrice(produce),
    };
    drawLine(ys);
  }, [selected, demand]);

  // Loading / empty state.
  if (loading) {
    return (
      <section id="prices" data-bg="white" aria-labelledby="demand-title" className="scroll-mt-4 pt-10 pb-10 lg:pt-40 lg:pb-16">
        <div className={CONTAINER}>
          <div className="rounded-[20px] bg-paper p-[22px] text-ink md:p-9">
            <p className={`${EYEBROW} text-ink-muted`}>Before you start a farm</p>
            <h2 id="demand-title" className="mt-1 font-display text-2xl leading-[1.2] font-medium md:text-[30px]">
              Thinking of starting a farm? Ask the market first.
            </h2>
            <p className="mt-5 text-body-sm text-ink-muted">Loading demand data…</p>
          </div>
        </div>
      </section>
    );
  }

  if (demand.length === 0 || !produce) {
    return (
      <section id="prices" data-bg="white" aria-labelledby="demand-title" className="scroll-mt-4 pt-10 pb-10 lg:pt-40 lg:pb-16">
        <div className={CONTAINER}>
          <div className="rounded-[20px] bg-paper p-[22px] text-ink md:p-9">
            <p className={`${EYEBROW} text-ink-muted`}>Before you start a farm</p>
            <h2 id="demand-title" className="mt-1 font-display text-2xl leading-[1.2] font-medium md:text-[30px]">
              Thinking of starting a farm? Ask the market first.
            </h2>
            <p className="mt-5 text-body-sm text-ink-muted">
              No demand data available yet. Check back once buyers start posting.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const INITIAL = produce;
  const INITIAL_YS = normalise(INITIAL.prices);

  const drawScrub = () => {
    const { scrub, produce: current, ys } = live.current;
    const box = chart.current;
    const label = scrubLabel.current;
    if (scrub === null || !box || !label || !current) return;

    const left = (xAt(scrub) / WIDTH) * 100;
    if (scrubLine.current) scrubLine.current.style.left = `${left}%`;
    if (scrubDot.current) Object.assign(scrubDot.current.style, dotPosition(scrub, ys[scrub]));

    const weeksAgo = WEEKS - 1 - scrub;
    const when = weeksAgo === 0 ? "This week" : `${weeksAgo} wk ago`;
    label.textContent = `${when} · ${formatNaira(current.prices[scrub], current.priceUnit)}`;

    // Centred on the point, but never past either edge of the chart.
    const width = box.clientWidth;
    const room = width - label.offsetWidth;
    const wanted = (left / 100) * width - label.offsetWidth / 2;
    label.style.left = `${Math.max(0, Math.min(room, wanted))}px`;
  };

  const drawLine = (ys: number[]) => {
    live.current.ys = ys;
    line.current?.setAttribute("d", curve(ys));
    if (endDot.current) Object.assign(endDot.current.style, dotPosition(WEEKS - 1, ys[WEEKS - 1]));
    drawScrub();
  };

  const showScrub = (visible: boolean) => {
    [scrubLine, scrubDot, scrubLabel].forEach((element) => {
      if (element.current) element.current.style.opacity = visible ? "1" : "0";
    });
  };

  useGSAP(
    () => {
      const state = live.current;
      const stopMotion = () => state.motion.forEach((animation) => animation.kill());

      const root = scope.current;
      const path = line.current;
      if (!root || !path || isReducedMotion() || !state.produce) return stopMotion;

      const box = path.getBoundingClientRect();
      const scaleX = box.width / path.getBBox().width;
      const scaleY = box.height / Math.max(1, path.getBBox().height);
      const total = path.getTotalLength();
      let length = 0;
      let previous = path.getPointAtLength(0);
      for (let step = 1; step <= 120; step++) {
        const point = path.getPointAtLength((step / 120) * total);
        length += Math.hypot((point.x - previous.x) * scaleX, (point.y - previous.y) * scaleY);
        previous = point;
      }
      length = Math.ceil(length * 1.1);

      const intro = gsap.timeline({
        onComplete: () => {
          live.current.intro = null;
        },
      });
      intro.fromTo(
        path,
        { strokeDasharray: length, strokeDashoffset: length },
        {
          strokeDashoffset: 0,
          duration: 1.2,
          ease: "power2.inOut",
          clearProps: "strokeDasharray,strokeDashoffset",
        },
      );
      intro.fromTo(
        endDot.current,
        { scale: 0 },
        { scale: 1, duration: 0.35, ease: "back.out(2.4)", clearProps: "transform" },
      );
      intro.add(fx("riseIn", root.querySelectorAll("[data-stat]"), { stagger: 0.08 }), "-=0.1");

      const number = bigNumber.current;
      if (number) {
        intro.add(fx("numberRoll", number, { from: 0, to: state.number }), 0);
        number.textContent = "0";
      }

      live.current.intro = intro;
      const panel = root.querySelector("[data-demand-panel]");
      playOnEnter(intro, panel?.parentElement ?? root, "60% bottom");
      return () => {
        stopMotion();
        if (number) number.textContent = String(state.number);
      };
    },
    { scope },
  );

  function choose(key: string) {
    if (key === live.current.produce?.key) return;

    const next = findProduce(key);
    if (!next) return;
    const state = live.current;
    const target = normalise(next.prices);
    state.produce = next;
    setSelected(key);

    state.intro?.progress(1);
    state.motion.forEach((animation) => animation.kill());
    state.motion = [];

    const writeNumber = (value: number) => {
      state.number = value;
      return String(value);
    };
    const writeAverage = (value: number) => {
      state.average = value;
      return formatNaira(value, next.priceUnit);
    };

    if (isReducedMotion()) {
      drawLine(target);
      if (bigNumber.current) bigNumber.current.textContent = writeNumber(next.weeklyDemand);
      if (average.current) average.current.textContent = writeAverage(lastPrice(next));
      if (verdict.current) verdict.current.textContent = next.verdict;
      return;
    }

    const rise = gsap.timeline();
    rise.to(verdict.current, { opacity: 0, y: 0, duration: 0.2, ease: "none" });
    rise.call(() => {
      if (verdict.current) verdict.current.textContent = next.verdict;
    });
    rise.fromTo(
      verdict.current,
      { opacity: 0, y: 6 },
      { opacity: 1, y: 0, duration: 0.25, ease: "power2.out" },
    );

    state.motion = [
      fx("lineMorph", line.current, { fromValues: state.ys, toValues: target, onFrame: drawLine }),
      fx("numberRoll", bigNumber.current, {
        from: state.number,
        to: next.weeklyDemand,
        formatValue: writeNumber,
      }),
      fx("numberRoll", average.current, {
        from: state.average,
        to: lastPrice(next),
        formatValue: writeAverage,
      }),
      rise,
    ];
  }

  function scrubFrom(event: ReactPointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * WIDTH;
    live.current.scrub = Math.max(0, Math.min(WEEKS - 1, Math.round((x - SIDE_MARGIN) / STEP)));
    showScrub(true);
    drawScrub();
  }

  function endScrub() {
    live.current.scrub = null;
    showScrub(false);
  }

  return (
    <section
      ref={scope}
      id="prices"
      data-bg="white"
      aria-labelledby="demand-title"
      className="scroll-mt-4 pt-10 pb-10 lg:pt-40 lg:pb-16"
    >
      <div className={CONTAINER}>
        <div data-demand-panel data-entrance className="rounded-[20px] bg-paper p-[22px] text-ink md:p-9">
          <p className={`${EYEBROW} text-ink-muted`}>Before you start a farm</p>
          <h2
            id="demand-title"
            className="mt-1 font-display text-2xl leading-[1.2] font-medium md:text-[30px]"
          >
            Thinking of starting a farm? Ask the market first.
          </h2>

          <div className="mt-5 text-[17px] leading-[2.6]">
            If I raise{" "}
            <span role="group" aria-label="Produce" className="inline">
              {demand.map((item) => {
                const isSelected = item.key === produce.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => choose(item.key)}
                    className={`relative mr-1.5 inline-block cursor-pointer rounded-full border px-3.5 py-[7px] align-middle text-[15px] leading-[1.3] transition-colors duration-200 ease-out after:absolute after:-inset-y-1 after:inset-x-0 focus-visible:ring-3 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper focus-visible:outline-none ${
                      isSelected
                        ? "border-ink bg-ink text-paper"
                        : "border-[#D9D2C3] text-ink hover:bg-[#EEE9DF]"
                    }`}
                  >
                    {item.chip}
                  </button>
                );
              })}
            </span>{" "}
            near Jos, who&apos;s buying?
          </div>

          <p className="mt-6 text-body-sm text-ink-muted">Buyers near Jos want about</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span
              ref={bigNumber}
              className="font-num text-[52px] leading-none tracking-[-0.03em] md:text-[72px]"
            >
              {produce.weeklyDemand}
            </span>
            <span className="text-xl">{produce.demandUnit}</span>
          </p>
          <p ref={verdict} className="mt-3 max-w-[560px] text-base">
            {produce.verdict}
          </p>
          {/* The visual answer rolls and fades, so screen readers get the settled version here. */}
          <p aria-live="polite" className="sr-only">
            {`${produce.chip}: about ${produce.weeklyDemand} ${produce.demandUnit}, ${produce.buyers} buyers, average ${formatNaira(lastPrice(produce), produce.priceUnit)}. ${produce.verdict}`}
          </p>

          <div className="relative mt-10">
            <span
              ref={scrubLabel}
              aria-hidden="true"
              className="font-num pointer-events-none absolute -top-6 left-0 text-xs whitespace-nowrap text-ink-muted opacity-0"
            />
            <div
              ref={chart}
              role="img"
              aria-label={`Line chart of ${produce.chip} prices over ${WEEKS} weeks, from ${formatNaira(produce.prices[0], produce.priceUnit)} to ${formatNaira(lastPrice(produce), produce.priceUnit)}.`}
              onPointerDown={scrubFrom}
              onPointerMove={scrubFrom}
              onPointerLeave={endScrub}
              onPointerCancel={endScrub}
              className="relative h-[200px] touch-pan-y"
            >
              <svg
                aria-hidden="true"
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                preserveAspectRatio="none"
                className="absolute inset-0 size-full"
              >
                <line
                  x1={0}
                  x2={WIDTH}
                  y1={HEIGHT - 0.5}
                  y2={HEIGHT - 0.5}
                  stroke="#E2DDD2"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  ref={line}
                  d={curve(INITIAL_YS)}
                  fill="none"
                  stroke="#14201B"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              {/* Dots sit outside the stretched SVG, so they stay round at every width. */}
              <span
                ref={scrubLine}
                className="pointer-events-none absolute inset-y-0 w-px bg-[#D9D2C3] opacity-0"
              />
              <span
                ref={endDot}
                style={dotPosition(WEEKS - 1, INITIAL_YS[WEEKS - 1])}
                className="pointer-events-none absolute -mt-1.5 -ml-1.5 size-3 rounded-full bg-amber"
              />
              <span
                ref={scrubDot}
                className="pointer-events-none absolute -mt-[5px] -ml-[5px] size-2.5 rounded-full bg-ink opacity-0"
              />
            </div>
            <div className="font-num mt-2 flex justify-between text-[11px] text-[#9AA59F]">
              <span>8 weeks ago</span>
              <span>This week</span>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div data-stat className="rounded-xl border border-[#E2DDD2] bg-white px-4 py-3.5">
              <p className="text-label font-medium text-ink-muted">Average price</p>
              <p ref={average} className="font-num mt-1 text-xl font-medium text-[#9A6A1A]">
                {formatNaira(lastPrice(produce), produce.priceUnit)}
              </p>
            </div>
            <div data-stat className="rounded-xl border border-[#E2DDD2] bg-white px-4 py-3.5">
              <p className="text-label font-medium text-ink-muted">Buyers posting</p>
              <p className="font-num mt-1 text-xl font-medium">{produce.buyers}</p>
            </div>
            <div data-stat className="rounded-xl border border-[#E2DDD2] bg-white px-4 py-3.5">
              <p className="text-label font-medium text-ink-muted">Price over 8 weeks</p>
              <p className="font-num mt-1 text-xl font-medium">{percentChange(produce)}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-[#E2DDD2] pt-4">
            <p className="text-sm text-ink-muted">
              No internet? Text <span className="font-num text-ink">{produce.command}</span> from
              any phone.
            </p>
            <p className="text-xs text-[#9AA59F]">Live data from the board</p>
          </div>
        </div>
      </div>
    </section>
  );
}
