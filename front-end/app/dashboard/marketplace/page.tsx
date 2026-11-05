"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Sparkles, SlidersHorizontal, Zap, Search } from "lucide-react";

import { LogoVideo } from "@/components/dashboard/logo-video";
import { MarketCard } from "@/components/marketplace/market-card";
import { FilterPanel, type FilterState } from "@/components/marketplace/filter-panel";
import { OfferModal } from "@/components/marketplace/offer-modal";
import { Reveal } from "@/components/motion/reveal";
import { fx, playOnEnter, useGSAP } from "@/lib/gsap/effects";
import { cn } from "@/lib/utils";
import { MARKET_ITEMS, type MarketItem, type Offer } from "@/lib/demo/market";

const CROPS = [
  { src: "/images/hero-farm.jpg", pos: "object-[52%_25%]", cls: "absolute top-4 right-10 size-16 hidden sm:block" },
  { src: "/images/step-buyer.jpg", pos: "object-[85%_30%]", cls: "absolute bottom-4 right-4 size-14 hidden xl:block" },
];

export default function MarketplacePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [offerItem, setOfferItem] = useState<MarketItem | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    commodity: "All",
    area: "All areas",
    type: "all",
    sort: "newest",
  });
  const [offers, setOffers] = useState<Record<string, Offer[]>>({});

  useGSAP(
    () => {
      const root = heroRef.current;
      if (!root) return;
      playOnEnter(fx("riseIn", root.querySelectorAll("[data-rise]"), { stagger: 0.1 }), root, "top 85%");
      fx("floatDrift", root.querySelectorAll("[data-crop]"));
    },
    { scope: heroRef },
  );

  // Apply filters
  let items = MARKET_ITEMS.filter((item) => {
    if (filters.type !== "all" && item.type !== filters.type) return false;
    if (filters.commodity !== "All" && item.commodity !== filters.commodity) return false;
    if (filters.area !== "All areas" && item.area !== filters.area) return false;
    return true;
  });

  // Sort
  if (filters.sort === "price-high") items.sort((a, b) => b.price - a.price);
  else if (filters.sort === "price-low") items.sort((a, b) => a.price - b.price);

  function handleOffer(item: MarketItem) {
    setOfferItem(item);
    setOfferOpen(true);
  }

  function submitOffer(offer: Offer) {
    setOffers((prev) => ({
      ...prev,
      [offer.itemId]: [...(prev[offer.itemId] ?? []), offer],
    }));
  }

  return (
    <>
      <div className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-6 lg:px-8">

        {/* ── Hero ─────────────────────────────────────────────── */}
        <div
          ref={heroRef}
          data-rhythm="field"
          className="relative isolate mb-8 overflow-hidden rounded-2xl bg-field px-6 py-10 text-paper lg:px-10 lg:py-12"
        >
          <LogoVideo />

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
            Every active buyer and farmer near Jos. Real bids, live capacity. Make an offer or list your produce.
          </p>

          {/* Search bar */}
          <div data-rise className="mt-6 flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl bg-field-soft/60 px-4 py-3">
              <Search strokeWidth={1.5} className="size-4 text-sage/50" />
              <input
                placeholder="Search commodity, buyer, or area…"
                className="flex-1 bg-transparent text-body text-paper placeholder-sage/40 outline-none"
              />
            </div>
            <button
              onClick={() => setFilterOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-paper px-4 py-3 text-body-sm font-medium text-field transition-colors hover:bg-sage-soft"
            >
              <SlidersHorizontal strokeWidth={1.5} className="size-4" />
              Filters
            </button>
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

        {/* ── Quick filter chips ──────────────────────────────── */}
        <Reveal effect="riseIn">
          <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1">
            {["All", "Demand", "Listings", "Broilers", "Tomatoes", "Eggs", "Turkey"].map((chip) => {
              const active =
                (chip === "All" && filters.type === "all" && filters.commodity === "All") ||
                (chip === "Demand" && filters.type === "demand") ||
                (chip === "Listings" && filters.type === "listing") ||
                (chip === "Broilers" && filters.commodity === "Live Broilers") ||
                (chip === "Tomatoes" && filters.commodity === "Tomatoes") ||
                (chip === "Eggs" && filters.commodity === "Eggs") ||
                (chip === "Turkey" && filters.commodity === "Live Turkey");

              return (
                <button
                  key={chip}
                  onClick={() => {
                    if (chip === "All") setFilters({ ...filters, type: "all", commodity: "All" });
                    else if (chip === "Demand") setFilters({ ...filters, type: "demand" });
                    else if (chip === "Listings") setFilters({ ...filters, type: "listing" });
                    else setFilters({ ...filters, commodity: chip === "Broilers" ? "Live Broilers" : chip });
                  }}
                  className={cn(
                    "shrink-0 rounded-full border px-3.5 py-1.5 text-body-sm font-medium transition-colors",
                    active
                      ? "border-green bg-sage-soft text-green"
                      : "border-line text-ink-muted hover:border-green hover:text-green",
                  )}
                >
                  {chip}
                </button>
              );
            })}
          </div>
        </Reveal>

        {/* ── Grid ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <Reveal key={item.id} effect="riseIn" config={{ stagger: 0 }}>
              <div className={cn(
                index % 3 === 0 && "rotate-[-0.2deg] hover:rotate-0",
                index % 3 === 1 && "rotate-[0.15deg] hover:rotate-0",
                "transition-transform duration-300",
              )}>
                <MarketCard item={item} onOffer={handleOffer} />
              </div>
            </Reveal>
          ))}
        </div>

        {/* Empty state */}
        {items.length === 0 && (
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-field px-8 py-16 text-center text-paper">
            <div aria-hidden className="flex flex-col items-center gap-3 opacity-20">
              <span className="h-px w-48 bg-sage" />
              <span className="h-px w-32 bg-sage" />
              <span className="h-px w-20 bg-sage" />
            </div>
            <p className="font-display text-title font-medium text-paper">No matches found</p>
            <p className="text-body text-paper/60">Try adjusting your filters to see more results.</p>
            <button
              onClick={() => setFilters({ commodity: "All", area: "All areas", type: "all", sort: "newest" })}
              className="mt-2 rounded-full bg-paper px-5 py-2.5 text-body-sm font-medium text-field hover:bg-sage-soft"
            >
              Clear all filters →
            </button>
          </div>
        )}
      </div>

      {/* Filter panel */}
      <FilterPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onApply={setFilters}
      />

      {/* Offer modal */}
      <OfferModal
        open={offerOpen}
        onClose={() => setOfferOpen(false)}
        item={offerItem}
        onMakeOffer={submitOffer}
      />
    </>
  );
}
