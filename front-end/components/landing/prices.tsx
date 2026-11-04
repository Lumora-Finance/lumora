"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { Reveal } from "@/components/motion/reveal";
import { formatNaira } from "@/lib/format";
import { fx, gsap, playOnEnter, useGSAP } from "@/lib/gsap/effects";
import { cn } from "@/lib/utils";

import { CONTAINER, SECTION_HEADING, SECTION_SPACING } from "./shared";

const PriceChart = dynamic(() => import("./price-chart"), { ssr: false });

const PRICE_INDEX = [
  { commodity: "Live broilers", price: 3540, unit: "kg", bids: 12 },
  { commodity: "Turkey", price: 4150, unit: "kg", bids: 4 },
  { commodity: "Tomatoes", price: 28000, unit: "basket", bids: 6 },
  { commodity: "Eggs", price: 5600, unit: "crate", bids: 5 },
];

export function Prices() {
  const table = useRef<HTMLDivElement>(null);
  const chartSlot = useRef<HTMLDivElement>(null);
  const [showChart, setShowChart] = useState(false);

  // Recharts is heavy, so it loads only when the visitor gets close.
  useEffect(() => {
    const slot = chartSlot.current;
    if (!slot) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShowChart(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(slot);
    return () => observer.disconnect();
  }, []);

  useGSAP(
    () => {
      const root = table.current;
      if (!root) return;

      const timeline = gsap.timeline();
      timeline.add(fx("riseIn", root.querySelectorAll("tbody tr"), { stagger: 0.06 }), 0);
      gsap.utils.toArray<HTMLElement>("[data-average]", root).forEach((cell, index) => {
        const { price, unit } = PRICE_INDEX[index];
        timeline.add(fx("countUp", cell, { from: price * 0.8, to: price, format: "naira", unit }), 0.1);
      });
      playOnEnter(timeline, root);
    },
    { scope: table },
  );

  return (
    <section
      id="prices"
      data-rhythm="white"
      className={cn("scroll-mt-4", SECTION_SPACING)}
    >
      <div className={CONTAINER}>
        <Reveal className="max-w-[680px]" selector="[data-intro]">
          <h2 data-intro className={SECTION_HEADING}>
            Thinking of starting a farm? See the demand first.
          </h2>
          <p data-intro className="mt-5">
            Every posted bid and settled delivery feeds a price index by produce, area and week.
            Check it before you buy your first birds, or text{" "}
            <span className="font-num">DEMAND TURKEY JOS</span> from any phone.
          </p>
        </Reveal>

        <figure className="mt-10">
          <figcaption className="flex items-baseline justify-between gap-4">
            <span className="text-heading font-semibold">Live broilers near Jos, per kg</span>
            <span className="text-body-sm text-ink-muted">Example prices</span>
          </figcaption>
          <div ref={chartSlot} className="mt-4 h-64 md:h-72">
            {showChart && <PriceChart />}
          </div>
        </figure>

        <div ref={table} className="mt-8 overflow-hidden rounded-xl border border-line bg-paper">
          <table className="w-full text-left">
            <caption className="border-b border-line p-4 text-left text-body-sm text-ink-muted md:px-5">
              Example prices near Jos this week
            </caption>
            <thead>
              <tr className="border-b border-line text-label text-ink-muted">
                <th scope="col" className="px-4 py-3 font-medium md:px-5">
                  Produce
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium md:px-5">
                  Average bid
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium md:px-5">
                  Bids
                </th>
              </tr>
            </thead>
            <tbody>
              {PRICE_INDEX.map((row) => (
                <tr key={row.commodity} className="h-12 border-b border-line last:border-b-0">
                  <th scope="row" className="px-4 font-normal md:px-5">
                    {row.commodity}
                  </th>
                  <td data-average className="font-num px-4 text-right text-number md:px-5">
                    {formatNaira(row.price, row.unit)}
                  </td>
                  <td className="font-num px-4 text-right text-number md:px-5">{row.bids}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
