"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, SlidersHorizontal, Loader2, Search, MapPin, Package, Plus } from "lucide-react";
import Link from "next/link";

import { getToken } from "@/lib/firebase/auth";
import { LogoVideo } from "@/components/dashboard/logo-video";
import { FilterPanel, type FilterState } from "@/components/marketplace/filter-panel";
import { PostModal } from "@/components/dashboard/post-button";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";
import { CardsSkeleton } from "@/components/loader/skeletons";
import { ListingPhoto } from "@/components/marketplace/listing-photo";
import { HillsCard } from "@/components/profile/hills-card";
import { trackTask } from "@/lib/loading/progress";

type BoardRow = {
  listing_id: string;
  slot_id: string;
  buyer: string;
  buyer_id?: string;
  buyer_photo_url?: string | null;
  area: string;
  price_kobo: number;
  price_unit: string;
  remaining: number;
  min_qty: number;
  window_start: string;
  window_end: string;
  delivery_mode: string;
  plain_name: string;
  plain_plural: string;
  spec: string | null;
  commodity: string;
  images?: string[];
};

type SupplyRow = {
  id: string;
  title: string;
  unit_price_kobo: number;
  qty: number;
  unit: string;
  images: string[];
  status: string;
  created_at: string;
  area: string | null;
  commodity: string | null;
  farmer: { id: string; name: string; verified: boolean; photo_url: string | null };
};

type Tab = "demand" | "supply";

function formatKobo(kobo: number, unit: string) {
  return `₦${(kobo / 100).toLocaleString("en-NG")}/${unit}`;
}

function DemandCard({ row, meId }: { row: BoardRow; meId: string | null }) {
  const isOwn = Boolean(meId && row.buyer_id === meId);
  const buyerInitials = row.buyer.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg relative h-full">
      {/* Covers the card, under the buyer's link, so the whole card opens the listing without a link inside a link. */}
      <Link
        href={`/dashboard/marketplace/${row.listing_id}`}
        aria-label={`View and book ${row.commodity} for ${row.buyer}`}
        className="absolute inset-0 z-[1] rounded-2xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      />
      <ListingPhoto images={row.images} alt={`${row.commodity} from ${row.buyer}`} className="aspect-[16/9] w-full" />
      <div className="flex-1 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-md bg-green/10 px-2 py-0.5 font-num text-label font-medium text-green">
                DEMAND
              </span>
              {isOwn && (
                <span className="rounded-full bg-green text-paper text-label font-medium px-2 py-0.5">
                  You
                </span>
              )}
            </div>
            <p className="mt-2 font-medium text-ink">{row.commodity}</p>
            {row.spec && (
              <p className="mt-0.5 line-clamp-2 text-body-sm text-ink-muted">{row.spec}</p>
            )}
          </div>
          <p className="shrink-0 font-num text-number font-medium text-amber">
            {formatKobo(row.price_kobo, row.price_unit)}
          </p>
        </div>

        <div className="mt-3 space-y-1 text-body-sm text-ink-muted">
          <Link
            href={`/dashboard/profile/${row.buyer_id ?? ""}`}
            className="relative z-[2] flex w-fit items-center gap-1.5 font-medium text-ink hover:text-green hover:underline"
          >
            <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sage-soft font-num text-[10px] font-medium text-green">
              {row.buyer_photo_url
                ? <img src={row.buyer_photo_url} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
                : buyerInitials}
            </span>
            {row.buyer}
          </Link>
          {row.area && (
            <p className="flex items-center gap-1">
              <MapPin strokeWidth={1.5} className="size-3.5 shrink-0" />
              {row.area}
            </p>
          )}
          <p className="font-num">
            {row.remaining} {row.plain_plural} remaining · min {row.min_qty}
          </p>
        </div>
      </div>

      <div className="border-t border-line px-5 py-3">
        <span className="block w-full rounded-xl bg-green py-2.5 text-center text-body-sm font-medium text-paper transition-colors group-hover:bg-green-hover">
          View &amp; Book
        </span>
      </div>
    </article>
  );
}

function SupplyCard({ row, meId }: { row: SupplyRow; meId: string | null }) {
  const initials = row.farmer.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const isOwn = Boolean(meId && row.farmer.id === meId);
  return (
    <Link
      href={`/dashboard/marketplace/supply/${row.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
    >
      <ListingPhoto images={row.images} alt={row.title} className="aspect-[16/9] w-full" />
      <div className="flex-1 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="rounded-md bg-amber/10 px-2 py-0.5 font-num text-label font-medium text-[#9A6A1A]">SUPPLY</span>
            <p className="mt-2 font-medium text-ink">{row.title}</p>
          </div>
          <p className="shrink-0 font-num text-number font-medium text-amber">
            {formatKobo(row.unit_price_kobo, row.unit)}
          </p>
        </div>
        <div className="mt-3 space-y-1 text-body-sm text-ink-muted">
          <Link
            href={`/dashboard/profile/${row.farmer.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 font-medium text-ink hover:text-green hover:underline"
          >
            <span className="flex size-5 items-center justify-center overflow-hidden rounded-full bg-sage-soft font-num text-[10px] font-medium text-green">
              {row.farmer.photo_url
                ? <img src={row.farmer.photo_url} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
                : initials}
            </span>
            {row.farmer.name}
            {row.farmer.verified && <span className="text-green">✓</span>}
            {isOwn && (
              <span className="rounded-full bg-green text-paper text-label font-medium px-2 py-0.5">
                You
              </span>
            )}
          </Link>
          {row.area && (
            <p className="flex items-center gap-1">
              <MapPin strokeWidth={1.5} className="size-3.5 shrink-0" />
              {row.area}
            </p>
          )}
          <p className="font-num">{row.qty} {row.unit}s available</p>
        </div>
      </div>
      <div className="border-t border-line px-5 py-3">
        <span className="block w-full rounded-xl bg-amber py-2.5 text-center text-body-sm font-medium text-ink transition-colors group-hover:bg-amber/90">
          View &amp; Offer
        </span>
      </div>
    </Link>
  );
}

export default function MarketplacePage() {
  const [tab, setTab] = useState<Tab>("demand");
  const [filterOpen, setFilterOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("All areas");

  const [rows, setRows] = useState<BoardRow[]>([]);
  const [supplyRows, setSupplyRows] = useState<SupplyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [meId, setMeId] = useState<string | null>(null);

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
      const finished = trackTask("marketplace");
      setError(null);
      try {
        const token = await getToken();
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

        const [boardRes, supplyRes, meRes] = await Promise.all([
          fetch("/api/board", { headers }),
          fetch("/api/supply-listings", { headers }),
          fetch("/api/me", { headers }),
        ]);

        if (!boardRes.ok) throw new Error(`board:${boardRes.status}`);

        const boardData = (await boardRes.json()) as { cards?: BoardRow[] } | BoardRow[];
        const cards = Array.isArray(boardData) ? boardData : (boardData as { cards?: BoardRow[] }).cards ?? [];

        let supplyList: SupplyRow[] = [];
        if (supplyRes.ok) supplyList = (await supplyRes.json()) as SupplyRow[];

        if (meRes.ok) {
          const me = (await meRes.json()) as { id?: string; photo_url?: string | null };
          if (!cancelled) {
            setMeId(me?.id ?? null);
          }
        }

        if (!cancelled) { setRows(cards); setSupplyRows(supplyList); }
      } catch {
        if (!cancelled) setError("Couldn't load the marketplace. Please refresh.");
      } finally {
        finished();
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Map board cards to display shape (board returns BoardCard from buildBoard)
  const demandItems = rows.map((r) => {
    // Handle both raw board rows and built board cards
    const rc = r as Record<string, unknown>;
    return {
      listing_id: (rc.listingId ?? rc.listing_id ?? "") as string,
      slot_id: (rc.slotId ?? rc.slot_id ?? "") as string,
      buyer: (rc.buyer ?? "") as string,
      buyer_id: (rc.buyerId ?? rc.buyer_id ?? "") as string,
      area: (rc.area ?? "") as string,
      price_kobo: (Number(rc.priceKobo ?? rc.price_kobo ?? 0)),
      price_unit: (rc.priceUnit ?? rc.price_unit ?? "unit") as string,
      remaining: (Number(rc.remaining ?? 0)),
      min_qty: (Number(rc.minQty ?? rc.min_qty ?? 1)),
      window_start: (rc.windowStart ?? rc.window_start ?? "") as string,
      window_end: (rc.windowEnd ?? rc.window_end ?? "") as string,
      delivery_mode: (rc.collects ? "buyer_collects" : rc.delivery_mode ?? "farmer_delivers") as string,
      plain_name: (rc.plainName ?? rc.plain_name ?? "") as string,
      plain_plural: (rc.plainPlural ?? rc.plain_plural ?? "") as string,
      spec: (rc.spec ?? null) as string | null,
      commodity: (rc.commodity ?? "") as string,
      images: (rc.images ?? []) as string[],
      buyer_photo_url: (rc.buyerPhotoUrl ?? rc.buyer_photo_url ?? null) as string | null,
    };
  });

  let filteredDemand = demandItems.filter((r) => {
    if (filters.commodity !== "All" && !r.commodity.toLowerCase().includes(filters.commodity.toLowerCase())) return false;
    if (filters.area !== "All areas" && r.area !== filters.area) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.commodity.toLowerCase().includes(q) && !r.buyer.toLowerCase().includes(q) && !r.area.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  if (filters.sort === "price-high") filteredDemand = [...filteredDemand].sort((a, b) => b.price_kobo - a.price_kobo);
  if (filters.sort === "price-low") filteredDemand = [...filteredDemand].sort((a, b) => a.price_kobo - b.price_kobo);

  const AREAS = ["All areas", ...Array.from(new Set(demandItems.map((r) => r.area).filter(Boolean)))];

  return (
    <>
      <div className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-6 lg:px-8">

        {/* Hero */}
        <HillsCard className="mb-8">
          <div className="px-5 pt-24 pb-6 sm:px-10 sm:pt-28 sm:pb-9 lg:px-14 lg:pt-32 lg:pb-11">
            <p data-card="rise" className="text-body-sm font-medium text-ink/70">Lumora · Marketplace</p>
            <h1 data-card="rise" className="mt-1 text-[28px] leading-[1.15] font-medium tracking-tight text-ink sm:text-[38px]">
              Buyers are waiting.<br /><span className="text-green">What are you selling?</span>
            </h1>
            <p data-card="rise" className="mt-2 max-w-[32rem] text-body text-ink/80">
              Active buyers near Jos. Real bids, live capacity.
            </p>

            <div data-card="rise" className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => setPostOpen(true)}
                className="flex items-center gap-2 rounded-full bg-amber px-5 py-2.5 text-body-sm font-medium text-ink transition-all hover:bg-amber/90 hover:shadow-md">
                <Plus strokeWidth={2} className="size-4" /> Post demand or supply
              </button>
            </div>

            <div data-card="rise" className="mt-6 flex items-center gap-2 sm:mt-8 sm:gap-3">
              <div className="flex min-h-14 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-line bg-white px-5 transition-[border-color,box-shadow] duration-150 focus-within:border-green focus-within:ring-3 focus-within:ring-green/20">
                <Search aria-hidden="true" strokeWidth={1.5} className="size-[18px] shrink-0 text-ink-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search commodity, buyer, or area…"
                  aria-label="Search the marketplace"
                  className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-muted"
                />
              </div>
              <button
                type="button"
                onClick={() => setFilterOpen(true)}
                aria-label="Filters"
                className="inline-flex size-14 shrink-0 items-center justify-center gap-2 rounded-full bg-ink text-[17px] font-medium text-paper transition-[background-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:bg-field focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:translate-y-0 active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:w-auto sm:px-8"
              >
                <SlidersHorizontal aria-hidden="true" strokeWidth={1.5} className="size-[18px]" />
                <span className="hidden sm:inline">Filters</span>
              </button>
            </div>
          </div>
        </HillsCard>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl border border-line bg-white p-1 w-fit">
          <button onClick={() => setTab("demand")}
            className={cn("flex items-center gap-2 rounded-lg px-5 py-2 text-body-sm font-medium transition-all",
              tab === "demand" ? "bg-sage-soft text-green shadow-sm" : "text-ink-muted hover:text-ink")}>
            <Sparkles strokeWidth={1.5} className="size-4" /> Demand
            {rows.length > 0 && <span className="rounded-full bg-green/20 px-2 py-0.5 font-num text-label text-green">{demandItems.length}</span>}
          </button>
          <button onClick={() => setTab("supply")}
            className={cn("flex items-center gap-2 rounded-lg px-5 py-2 text-body-sm font-medium transition-all",
              tab === "supply" ? "bg-sage-soft text-green shadow-sm" : "text-ink-muted hover:text-ink")}>
            <Package strokeWidth={1.5} className="size-4" /> Supply
            {supplyRows.length > 0 && <span className="rounded-full bg-green/20 px-2 py-0.5 font-num text-label text-green">{supplyRows.length}</span>}
          </button>
        </div>

        {/* Supply area filter */}
        {tab === "supply" && (
          <div className="mb-5 flex flex-wrap gap-2">
            {AREAS.map((a) => (
              <button key={a} onClick={() => setAreaFilter(a)}
                className={cn("rounded-full border px-4 py-1.5 text-body-sm font-medium transition-colors",
                  areaFilter === a ? "border-green bg-sage-soft text-green" : "border-line text-ink-muted hover:border-green hover:text-green")}>
                {a}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <CardsSkeleton cards={6} columns label="Finding demand" />
        ) : error ? (
          <div className="rounded-xl border border-danger/30 bg-danger/5 p-6 text-center text-danger">{error}</div>
        ) : tab === "demand" ? (
          filteredDemand.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl bg-field px-8 py-16 text-center text-paper">
              <p className="font-display text-title font-medium">
                {rows.length === 0 ? "No open slots right now" : "No matches found"}
              </p>
              <p className="text-body text-paper/60">
                {rows.length === 0 ? "Check back — buyers post new demand daily." : "Try adjusting your filters."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDemand.map((row) => (
                <Reveal key={row.listing_id} effect="riseIn" config={{ stagger: 0 }} className="h-full">
                  <DemandCard row={row} meId={meId} />
                </Reveal>
              ))}
            </div>
          )
        ) : tab === "supply" ? (
          supplyRows.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl bg-field px-8 py-16 text-center text-paper">
              <Package strokeWidth={1} className="size-10 text-sage/40" />
              <p className="font-display text-title font-medium">No supply listings yet</p>
              <p className="text-body text-paper/60">Farmers will appear here when they list produce for sale.</p>
              <button onClick={() => setPostOpen(true)} className="mt-2 rounded-full bg-paper px-5 py-2.5 text-body-sm font-medium text-field hover:bg-sage-soft">
                List your produce →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {supplyRows
                .filter((r) => areaFilter === "All areas" || r.area === areaFilter)
                .map((row) => (
                <Reveal key={row.id} effect="riseIn" config={{ stagger: 0 }}>
                  <SupplyCard row={row} meId={meId} />
                </Reveal>
              ))}
            </div>
          )
        ) : null}
      </div>

      <FilterPanel open={filterOpen} onClose={() => setFilterOpen(false)} filters={filters} onApply={setFilters} />
      <PostModal open={postOpen} onClose={() => setPostOpen(false)} />
    </>
  );
}
