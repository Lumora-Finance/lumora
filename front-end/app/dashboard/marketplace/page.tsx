"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Sparkles, SlidersHorizontal, Zap } from "lucide-react";

import { MarketplaceBoard } from "@/components/marketplace/marketplace-board";
import { Reveal } from "@/components/motion/reveal";
import { fx, playOnEnter, useGSAP } from "@/lib/gsap/effects";
import { cn } from "@/lib/utils";

const CROPS = [
  { src: "/images/hero-farm.jpg", pos: "object-[52%_25%]", cls: "absolute top-4 right-10 size-16 hidden sm:block" },
  { src: "/images/step-buyer.jpg", pos: "object-[85%_30%]", cls: "absolute bottom-4 right-4 size-14" },
  { src: "/images/step-farmer.jpg", pos: "object-[28%_10%]", cls: "absolute top-6 left-[40%] size-12 hidden lg:block" },
];

export default function MarketplacePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"demand" | "listings">("demand");

  useGSAP(
    () => {
      const root = heroRef.current;
      if (!root) return;
      playOnEnter(fx("ledgerDraw", root.querySelectorAll("[data-ledger]")), root, "top 90%");
      playOnEnter(fx("riseIn", root.querySelectorAll("[data-rise]"), { stagger: 0.1 }), root, "top 85%");
      fx("floatDrift", root.querySelectorAll("[data-crop]"));
    },
    { scope: heroRef },
  );

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-6 lg:px-8">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div
        ref={heroRef}
        data-rhythm="field"
        className="relative isolate mb-8 overflow-hidden rounded-2xl bg-field px-6 py-10 text-paper lg:px-10 lg:py-12"
      >
        {/* Ledger lines */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 flex flex-col justify-center gap-8 px-8">
          <span data-ledger aria-hidden className="h-px w-full bg-sage/15" />
          <span data-ledger aria-hidden className="h-px w-[80%] bg-sage/10" />
          <span data-ledger aria-hidden className="h-px w-[55%] bg-sage/8" />
        </div>

        {/* Floating crops */}
        {CROPS.map((c, i) => (
          <div key={i} data-crop aria-hidden className={cn("overflow-hidden rounded-full", c.cls)}>
            <Image src={c.src} alt="" width={160} height={160} className={cn("size-full object-cover", c.pos)} />
          </div>
        ))}

        <p data-rise className="text-label font-medium text-sage/70">Lumora · Demand Board</p>
        <h1 data-rise className="mt-2 font-display text-display-lg-sm font-medium text-paper md:text-display-lg">
          See who&apos;s buying
          <br />
          <span className="text-sage">before you sell.</span>
        </h1>
        <p data-rise className="mt-3 max-w-[32rem] text-body leading-relaxed text-paper/70">
          Every active buyer near Jos. Real bids, live capacity. Book a slot before it fills.
        </p>

        {/* Tab switcher */}
        <div data-rise className="mt-6 flex gap-2">
          {(["demand", "listings"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-full px-5 py-2 text-body-sm font-medium capitalize transition-all duration-200",
                activeTab === tab
                  ? "bg-paper text-field"
                  : "bg-field-soft/60 text-paper/70 hover:bg-field-soft hover:text-paper",
              )}
            >
              {tab === "demand" ? "📣 Demand" : "🌾 Listings"}
            </button>
          ))}
        </div>
      </div>

      {/* ── AI Match Banner ──────────────────────────────────── */}
      <Reveal effect="riseIn">
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber/30 bg-amber-soft/60 px-4 py-3">
          <Sparkles strokeWidth={1.5} className="size-5 shrink-0 text-amber" />
          <p className="flex-1 text-body-sm text-ink">
            <span className="font-medium">AI found 3 buyers near you</span> that match your last broiler listing — priced{" "}
            <span className="font-num font-medium text-amber">₦3,800/kg</span> or above.
          </p>
          <button className="flex shrink-0 items-center gap-1 rounded-lg bg-amber px-3 py-1.5 text-label font-medium text-ink hover:bg-amber/90">
            <Zap strokeWidth={2} className="size-3.5" />
            See matches
          </button>
        </div>
      </Reveal>

      {/* ── Filter row ──────────────────────────────────────── */}
      <Reveal effect="riseIn">
        <div className="mb-6 flex items-center gap-3 overflow-x-auto pb-1">
          <button className="flex shrink-0 items-center gap-2 rounded-lg border border-line bg-white px-3.5 py-2 text-body-sm font-medium text-ink-muted hover:border-green hover:text-green">
            <SlidersHorizontal strokeWidth={1.5} className="size-4" />
            Filter
          </button>
          {["All areas", "Jos North", "Rayfield", "Bukuru", "Barkin Ladi", "Farin Gada"].map((area) => (
            <button
              key={area}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-body-sm font-medium transition-colors",
                area === "All areas"
                  ? "border-green bg-sage-soft text-green"
                  : "border-line text-ink-muted hover:border-green hover:text-green",
              )}
            >
              {area}
            </button>
          ))}
        </div>
      </Reveal>

      {/* ── Board ────────────────────────────────────────────── */}
      <Reveal effect="riseIn">
        <div className="rotate-[-0.1deg] hover:rotate-0 transition-transform duration-500">
          <div className="mx-auto w-full">
            <MarketplaceBoard />
          </div>
        </div>
      </Reveal>
    </div>
  );
}
