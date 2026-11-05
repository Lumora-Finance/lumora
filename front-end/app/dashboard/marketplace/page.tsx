"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, SlidersHorizontal, Loader2, Search, MapPin, Users, Package } from "lucide-react";
import { getAuth } from "firebase/auth";
import Link from "next/link";

import app from "@/lib/firebase/config";
import { LogoVideo } from "@/components/dashboard/logo-video";
import { FilterPanel, type FilterState } from "@/components/marketplace/filter-panel";
import { Reveal } from "@/components/motion/reveal";
import { fx, playOnEnter, useGSAP } from "@/lib/gsap/effects";
import { cn } from "@/lib/utils";
import { CardsSkeleton } from "@/components/loader/skeletons";
import { trackTask } from "@/lib/loading/progress";

type BoardRow = {
  listing_id: string;
  slot_id: string;
  buyer: string;
  buyer_id?: string;
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
};

type Seller = {
  id: string;
  name: string;
  role: string;
  area: string | null;
  bio: string | null;
  photo_url: string | null;
  verified: boolean;
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

type Tab = "demand" | "supply" | "sellers";

function formatKobo(kobo: number, unit: string) {
  return `₦${(kobo / 100).toLocaleString("en-NG")}/${unit}`;
}

function DemandCard({ row }: { row: BoardRow }) {
  return (
    <Link
      href={`/dashboard/marketplace/${row.listing_id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="flex-1 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="rounded-md bg-green/10 px-2 py-0.5 font-num text-label font-medium text-green">
              DEMAND
            </span>
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
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-ink hover:text-green hover:underline"
          >
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
    </Link>
  );
}

function SupplyCard({ row }: { row: SupplyRow }) {
  const initials = row.farmer.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <Link
      href={`/dashboard/marketplace/supply/${row.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
    >
      {row.images && row.images.length > 0 ? (
        <div className="aspect-[4/3] overflow-hidden bg-paper">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={row.images[0]} alt={row.title} className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
        </div>
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center bg-sage-soft">
          <Package strokeWidth={1} className="size-10 text-green/40" />
        </div>
      )}
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

function SellerCard({ seller }: { seller: Seller }) {
  const initials = seller.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <Link
      href={`/dashboard/profile/${seller.id}`}
      className="flex items-center gap-4 rounded-xl border border-line bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sage-soft font-num text-heading font-medium text-green">
        {seller.photo_url ? (
          <img src={seller.photo_url} alt={seller.name} className="size-full object-cover" referrerPolicy="no-referrer" />
        ) : initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-ink">{seller.name}</p>
          {seller.verified && (
            <span className="rounded-full bg-sage-soft px-2 py-0.5 text-label font-medium text-green">✓ Verified</span>
          )}
        </div>
        <p className="text-body-sm text-ink-muted capitalize">{seller.role}</p>
        {seller.area && (
          <p className="flex items-center gap-1 text-body-sm text-ink-muted">
            <MapPin strokeWidth={1.5} className="size-3.5" /> {seller.area}
          </p>
        )}
        {seller.bio && <p className="mt-1 line-clamp-1 text-body-sm text-ink-muted">{seller.bio}</p>}
      </div>
    </Link>
  );
}

export default function MarketplacePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>("demand");
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("All areas");

  const [rows, setRows] = useState<BoardRow[]>([]);
  const [supplyRows, setSupplyRows] = useState<SupplyRow[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    commodity: "All",
    area: "All areas",
    type: "all",
    sort: "newest",
  });

  async function getToken() {
    return getAuth(app).currentUser?.getIdToken() ?? null;
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const finished = trackTask("marketplace");
      setError(null);
      try {
        const token = await getToken();
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

        const [boardRes, sellersRes, supplyRes] = await Promise.all([
          fetch("/api/board", { headers }),
          fetch("/api/sellers", { headers }),
          fetch("/api/supply-listings", { headers }),
        ]);

        if (!boardRes.ok) throw new Error(`board:${boardRes.status}`);

        const boardData = (await boardRes.json()) as { cards?: BoardRow[] } | BoardRow[];
        const cards = Array.isArray(boardData) ? boardData : (boardData as { cards?: BoardRow[] }).cards ?? [];

        let sellerList: Seller[] = [];
        if (sellersRes.ok) sellerList = (await sellersRes.json()) as Seller[];

        let supplyList: SupplyRow[] = [];
        if (supplyRes.ok) supplyList = (await supplyRes.json()) as SupplyRow[];

        if (!cancelled) { setRows(cards); setSellers(sellerList); setSupplyRows(supplyList); }
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

  useGSAP(() => {
    const root = heroRef.current;
    if (!root) return;
    playOnEnter(fx("riseIn", root.querySelectorAll("[data-rise]"), { stagger: 0.1 }), root, "top 85%");
  }, { scope: heroRef });

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

  const filteredSellers = sellers.filter((s) => {
    if (areaFilter !== "All areas" && s.area !== areaFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !(s.area ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const AREAS = ["All areas", ...Array.from(new Set([...demandItems.map((r) => r.area), ...sellers.map((s) => s.area ?? "")].filter(Boolean)))];

  return (
    <>
      <div className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-6 lg:px-8">

        {/* Hero */}
        <div ref={heroRef} data-rhythm="field"
          className="relative isolate mb-8 overflow-hidden rounded-2xl bg-field px-6 py-10 text-paper lg:px-10 lg:py-12">
          <LogoVideo />
          <p data-rise className="text-label font-medium text-sage/70">Lumora · Marketplace</p>
          <h1 data-rise className="mt-2 font-display text-display-lg-sm font-medium text-paper md:text-display-lg">
            See who&apos;s buying<br /><span className="text-sage">before you sell.</span>
          </h1>
          <p data-rise className="mt-3 max-w-[32rem] text-body leading-relaxed text-paper/70">
            Active buyers near Jos. Real bids, live capacity.
          </p>

          <div data-rise className="mt-6 flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl bg-field-soft/60 px-4 py-3">
              <Search strokeWidth={1.5} className="size-4 text-sage/50" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search commodity, buyer, or area…"
                className="flex-1 bg-transparent text-body text-paper placeholder-sage/40 outline-none" />
            </div>
            <button onClick={() => setFilterOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-paper px-4 py-3 text-body-sm font-medium text-field transition-colors hover:bg-sage-soft">
              <SlidersHorizontal strokeWidth={1.5} className="size-4" />
              Filters
            </button>
          </div>
        </div>

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
          <button onClick={() => setTab("sellers")}
            className={cn("flex items-center gap-2 rounded-lg px-5 py-2 text-body-sm font-medium transition-all",
              tab === "sellers" ? "bg-sage-soft text-green shadow-sm" : "text-ink-muted hover:text-ink")}>
            <Users strokeWidth={1.5} className="size-4" /> Sellers
            {sellers.length > 0 && <span className="rounded-full bg-green/20 px-2 py-0.5 font-num text-label text-green">{sellers.length}</span>}
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

        {/* Sellers area filter */}
        {tab === "sellers" && (
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
                <Reveal key={row.listing_id} effect="riseIn" config={{ stagger: 0 }}>
                  <DemandCard row={row} />
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
              <Link href="/dashboard/sell" className="mt-2 rounded-full bg-paper px-5 py-2.5 text-body-sm font-medium text-field hover:bg-sage-soft">
                List your produce →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {supplyRows
                .filter((r) => areaFilter === "All areas" || r.area === areaFilter)
                .map((row) => (
                <Reveal key={row.id} effect="riseIn" config={{ stagger: 0 }}>
                  <SupplyCard row={row} />
                </Reveal>
              ))}
            </div>
          )
        ) : (
          filteredSellers.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl bg-field px-8 py-16 text-center text-paper">
              <p className="font-display text-title font-medium">No sellers found</p>
              <p className="text-body text-paper/60">Farmers and agents who register will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSellers.map((seller) => (
                <Reveal key={seller.id} effect="riseIn" config={{ stagger: 0 }}>
                  <SellerCard seller={seller} />
                </Reveal>
              ))}
            </div>
          )
        )}
      </div>

      <FilterPanel open={filterOpen} onClose={() => setFilterOpen(false)} filters={filters} onApply={setFilters} />
    </>
  );
}
