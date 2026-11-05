"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, SlidersHorizontal, Loader2, Search } from "lucide-react";
import { getAuth } from "firebase/auth";

import app from "@/lib/firebase/config";
import { LogoVideo } from "@/components/dashboard/logo-video";
import { FilterPanel, type FilterState } from "@/components/marketplace/filter-panel";
import { Reveal } from "@/components/motion/reveal";
import { fx, playOnEnter, useGSAP } from "@/lib/gsap/effects";
import { cn } from "@/lib/utils";

// Board slot shape from /api/board
type Slot = {
  id: string;
  date: string;
  capacity_remaining: number;
  capacity_total: number;
  listing: {
    id: string;
    spec: string | null;
    unit_price_kobo: number;
    location_area: string | null;
    status: string;
    commodity: { name: string; unit: string };
    buyer: { id: string; name: string };
  } | null;
};

function formatKobo(kobo: number, unit: string) {
  return `₦${(kobo / 100).toLocaleString("en-NG")}/${unit}`;
}

function SlotCard({ slot }: { slot: Slot }) {
  const listing = slot.listing;
  if (!listing) return null;
  const unit = listing.commodity?.unit ?? "unit";

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-market-card-line bg-market-card shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
      <div className="flex-1 p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="rounded-md bg-green/10 px-2 py-0.5 font-num text-label font-medium text-green">
              DEMAND
            </span>
            <p className="mt-2 font-medium text-ink">{listing.commodity?.name}</p>
            {listing.spec && (
              <p className="mt-0.5 line-clamp-2 text-body-sm text-ink-muted">{listing.spec}</p>
            )}
          </div>
          <p className="shrink-0 font-num text-number font-medium text-amber">
            {formatKobo(listing.unit_price_kobo, unit)}
          </p>
        </div>

        <div className="mt-3 flex flex-col gap-1.5 text-body-sm text-ink-muted">
          <span>{listing.buyer?.name}</span>
          {listing.location_area && <span>{listing.location_area}</span>}
          <span className="font-num">
            {slot.capacity_remaining} of {slot.capacity_total} {unit} left
          </span>
        </div>
      </div>

      <div className="border-t border-market-card-line px-5 py-3">
        <button className="w-full rounded-xl bg-green py-2.5 text-body-sm font-medium text-paper transition-colors hover:bg-green-hover">
          Book slot
        </button>
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    commodity: "All",
    area: "All areas",
    type: "all",
    sort: "newest",
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = await getAuth(app).currentUser?.getIdToken();
        const res = await fetch("/api/board", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as { cards?: Slot[] } | Slot[];
        // /api/board returns { cards, area, stock, follows }
        const cards = Array.isArray(data) ? data : (data as { cards?: Slot[] }).cards ?? [];
        if (!cancelled) setSlots(cards);
      } catch {
        if (!cancelled) setError("Couldn't load the board. Please refresh.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useGSAP(
    () => {
      const root = heroRef.current;
      if (!root) return;
      playOnEnter(fx("riseIn", root.querySelectorAll("[data-rise]"), { stagger: 0.1 }), root, "top 85%");
      fx("floatDrift", root.querySelectorAll("[data-crop]"));
    },
    { scope: heroRef },
  );

  // Client-side filter + search
  let items = slots.filter((slot) => {
    const listing = slot.listing;
    if (!listing) return false;
    if (filters.commodity !== "All" && listing.commodity?.name !== filters.commodity) return false;
    if (filters.area !== "All areas" && listing.location_area !== filters.area) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !listing.commodity?.name.toLowerCase().includes(q) &&
        !listing.buyer?.name.toLowerCase().includes(q) &&
        !(listing.location_area ?? "").toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  if (filters.sort === "price-high") items = [...items].sort((a, b) => (b.listing?.unit_price_kobo ?? 0) - (a.listing?.unit_price_kobo ?? 0));
  if (filters.sort === "price-low") items = [...items].sort((a, b) => (a.listing?.unit_price_kobo ?? 0) - (b.listing?.unit_price_kobo ?? 0));

  return (
    <>
      <div className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-6 lg:px-8">

        {/* Hero */}
        <div
          ref={heroRef}
          data-rhythm="field"
          className="relative isolate mb-8 overflow-hidden rounded-2xl bg-field px-6 py-10 text-paper lg:px-10 lg:py-12"
        >
          <LogoVideo />

          <p data-rise className="text-label font-medium text-sage/70">Lumora · Demand Board</p>
          <h1 data-rise className="mt-2 font-display text-display-lg-sm font-medium text-paper md:text-display-lg">
            See who&apos;s buying
            <br />
            <span className="text-sage">before you sell.</span>
          </h1>
          <p data-rise className="mt-3 max-w-[32rem] text-body leading-relaxed text-paper/70">
            Every active buyer near Jos. Real bids, live capacity. Book a slot to confirm your sale.
          </p>

          <div data-rise className="mt-6 flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl bg-field-soft/60 px-4 py-3">
              <Search strokeWidth={1.5} className="size-4 text-sage/50" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-ink-muted" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-danger/30 bg-danger/5 p-6 text-center text-danger">{error}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-field px-8 py-16 text-center text-paper">
            <div aria-hidden className="flex flex-col items-center gap-3 opacity-20">
              <span className="h-px w-48 bg-sage" />
              <span className="h-px w-32 bg-sage" />
              <span className="h-px w-20 bg-sage" />
            </div>
            <p className="font-display text-title font-medium text-paper">
              {slots.length === 0 ? "No open slots right now" : "No matches found"}
            </p>
            <p className="text-body text-paper/60">
              {slots.length === 0
                ? "Check back soon — buyers post new demand daily."
                : "Try adjusting your filters."}
            </p>
            {slots.length > 0 && (
              <button
                onClick={() => { setFilters({ commodity: "All", area: "All areas", type: "all", sort: "newest" }); setSearch(""); }}
                className="mt-2 rounded-full bg-paper px-5 py-2.5 text-body-sm font-medium text-field hover:bg-sage-soft"
              >
                Clear filters →
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((slot) => (
              <Reveal key={slot.id} effect="riseIn" config={{ stagger: 0 }}>
                <SlotCard slot={slot} />
              </Reveal>
            ))}
          </div>
        )}
      </div>

      <FilterPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onApply={setFilters}
      />
    </>
  );
}
