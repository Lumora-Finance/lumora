"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft, MapPin, Clock, Shield, CheckCircle2,
  Calendar, Package, BarChart3, Send, Star,
} from "lucide-react";
import Link from "next/link";


import { getToken } from "@/lib/firebase/auth";
import { ImageGallery } from "@/components/marketplace/image-gallery";
import { Reveal } from "@/components/motion/reveal";
import { TransactionPinModal } from "@/components/dashboard/transaction-pin-modal";
import { cn } from "@/lib/utils";
import { BusyBar } from "@/components/loader/busy-bar";
import { DetailSkeleton } from "@/components/loader/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { HILLS_ACTION, HILLS_ACTION_QUIET, HillsCard } from "@/components/profile/hills-card";
import { trackTask } from "@/lib/loading/progress";

const TABS = [
  { key: "overview", label: "Overview", icon: Package },
  { key: "offers", label: "Offers", icon: Star },
  { key: "details", label: "Specs", icon: BarChart3 },
  { key: "schedule", label: "Schedule", icon: Calendar },
] as const;

type Tab = (typeof TABS)[number]["key"];

type Offer = {
  id: string;
  qty: number;
  note: string | null;
  unit_price_kobo: number | null;
  status: string;
  created_at: string;
  farmer: { id: string; name: string; area: string | null; verified: boolean; photo_url: string | null };
};

type Listing = {
  id: string;
  spec: string | null;
  unit_price_kobo: number;
  unit_price_min_kobo: number | null;
  unit_price_max_kobo: number | null;
  capacity_per_day: number;
  status: string;
  delivery_mode: string;
  window_start: string | null;
  window_end: string | null;
  cutoff_hours: number;
  min_qty: number;
  min_unit_weight_kg: number | null;
  max_unit_weight_kg: number | null;
  created_at: string;
  images: string[];
  commodity: { id: string; name: string; unit: string };
  buyer: { id: string; name: string; area: string | null };
  area: string | null;
  open_slots: Array<{
    id: string; date: string; capacity_remaining: number;
    capacity_total: number; cutoff_at: string; status: string;
  }>;
};

export default function ListingDetailPage() {
  const params = useParams();
  const [tab, setTab] = useState<Tab>("overview");
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [bookingDone, setBookingDone] = useState(false);

  // Offers state
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offerQty, setOfferQty] = useState(1);
  const [offerNote, setOfferNote] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [offerPriceError, setOfferPriceError] = useState<string | null>(null);
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [offerDone, setOfferDone] = useState(false);
  const [pinOpen, setPinOpen] = useState<"offer" | "accept" | null>(null);
  const [acceptingOfferId, setAcceptingOfferId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const offerFormRef = useRef<HTMLDivElement>(null);

  const id = params.id as string;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const finished = trackTask("marketplace-post");
      setError(null);
      try {
        const token = await getToken();
        const res = await fetch(`/api/listings/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as Listing;
        if (!cancelled) setListing(data);
      } catch {
        if (!cancelled) setError("Couldn't load this listing. Please refresh.");
      } finally {
        finished();
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);


  async function loadOffers() {
    if (!listing) return;
    setOffersLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/listings/${id}/offers`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) setOffers((await res.json()) as Offer[]);
    } catch { /* */ } finally { setOffersLoading(false); }
  }

  useEffect(() => {
    if (listing && tab === "offers") loadOffers();
  }, [tab, listing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch current user id
  useEffect(() => {
    async function fetchMe() {
      const token = await getToken();
      const res = await fetch("/api/me", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (res.ok) {
        const me = (await res.json()) as { id?: string };
        setMeId(me?.id ?? null);
      }
    }
    fetchMe();
  }, []);

  async function submitOffer() {
    setOfferSubmitting(true);
    try {
      const token = await getToken();
      if (editingOfferId) {
        // Update existing offer: withdraw old one and resubmit
        const delRes = await fetch(`/api/offers/${editingOfferId}`, {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const delResult = await delRes.json();
        if (!delResult.ok) { alert(delResult.message ?? delResult.code ?? "Could not update offer."); return; }
      }
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ listingId: id, qty: offerQty, note: offerNote || null, unitPriceKobo: offerPrice ? Math.round(Number(offerPrice) * 100) : null }),
      });
      const result = await res.json();
      if (result.ok) {
        setOfferDone(true);
        setEditingOfferId(null);
        loadOffers();
      } else {
        alert(result.message ?? result.code ?? "Offer failed.");
      }
    } catch { alert("Network error. Try again."); } finally { setOfferSubmitting(false); }
  }

  async function acceptOffer(offerId: string) {
    const token = await getToken();
    const res = await fetch(`/api/offers/${offerId}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const result = await res.json();
    if (result.ok) {
      setActionSuccess(`Offer accepted! Booking code: ${result.code}`);
      loadOffers();
    } else {
      alert(result.message ?? result.code ?? "Could not accept offer.");
    }
  }

  async function removeOffer(offerId: string) {
    const token = await getToken();
    const res = await fetch(`/api/offers/${offerId}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const result = await res.json();
    if (result.ok) {
      loadOffers();
    } else {
      alert(result.message ?? result.code ?? "Could not remove offer.");
    }
  }

  function startEditOffer(offer: Offer) {
    setEditingOfferId(offer.id);
    setOfferQty(offer.qty);
    setOfferNote(offer.note ?? "");
    setOfferPrice(offer.unit_price_kobo != null ? String(offer.unit_price_kobo / 100) : "");
    setOfferDone(false);
    setTimeout(() => {
      offerFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  async function handleBook(slotId: string) {
    if (booking) return;
    setBooking(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ slotId, qty: listing?.min_qty ?? 1 }),
      });
      const result = await res.json();
      if (result.ok || result.code === "booked") setBookingDone(true);
      else alert(result.message ?? result.code ?? "Booking failed");
    } catch {
      alert("Booking failed. Please try again.");
    } finally {
      setBooking(false);
    }
  }

  if (loading) {
    return (
      <DetailSkeleton label="Opening this post" />
    );
  }

  if (error || !listing) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-20 text-center">
        <p className="font-display text-title font-medium text-ink">{error ?? "Listing not found"}</p>
        <Link href="/dashboard/marketplace" className="rounded-lg bg-green px-5 py-2.5 text-body-sm font-medium text-paper">
          Back to marketplace
        </Link>
      </div>
    );
  }

  const unit = listing.commodity?.unit ?? "unit";
  const priceNaira = listing.unit_price_kobo / 100;
  const firstSlot = listing.open_slots?.[0] ?? null;
  const remaining = firstSlot?.capacity_remaining ?? 0;
  const capacity = firstSlot?.capacity_total ?? listing.capacity_per_day;
  const pct = capacity === 0 ? 0 : Math.round((remaining / capacity) * 100);

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-6 lg:px-8">

      <Link href="/dashboard/marketplace"
        className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft strokeWidth={1.5} className="size-4" /> Back to marketplace
      </Link>

      <HillsCard className="mb-6">
        <div className="px-5 pt-24 pb-6 sm:px-10 sm:pt-28 sm:pb-9 lg:px-14 lg:pt-32 lg:pb-11">
          <div data-card="rise" className="flex items-center gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 font-num text-label font-medium text-green">DEMAND</span>
            <span className="rounded-full bg-white px-2.5 py-1 font-num text-label font-medium text-ink capitalize">{listing.status}</span>
          </div>

          <h1 data-card="rise" className="mt-3 text-[26px] leading-tight font-medium tracking-tight break-words text-ink sm:text-[34px]">
            {listing.commodity?.name}
          </h1>
          {listing.spec && <p data-card="rise" className="mt-1 text-body text-ink/80">{listing.spec}</p>}

          <div data-card="rise" className="mt-4 flex flex-wrap items-baseline gap-x-2">
            <span className="font-num text-[30px] leading-tight font-medium tracking-tight text-ink sm:text-[38px]">
              {listing.unit_price_min_kobo && listing.unit_price_min_kobo !== listing.unit_price_kobo
                ? `₦${(listing.unit_price_min_kobo / 100).toLocaleString("en-NG")} – ₦${priceNaira.toLocaleString("en-NG")}`
                : `₦${priceNaira.toLocaleString("en-NG")}`}
            </span>
            <span className="text-body-sm text-ink/70">per {unit}</span>
          </div>

          <div data-card="rise" className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-body-sm text-ink-muted">
            {listing.area && (
              <span className="flex items-center gap-1.5"><MapPin aria-hidden="true" strokeWidth={1.5} className="size-4" />{listing.area}</span>
            )}
            {firstSlot && (
              <span className="flex items-center gap-1.5">
                <Clock aria-hidden="true" strokeWidth={1.5} className="size-4" />
                {new Date(firstSlot.date).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })}
              </span>
            )}
            <Link href={`/dashboard/profile/${listing.buyer.id}`} className="flex min-h-8 items-center gap-1.5 transition-colors duration-150 hover:text-ink">
              <Shield aria-hidden="true" strokeWidth={1.5} className="size-4" />
              {listing.buyer.name} (buyer)
            </Link>
          </div>

          <div data-card="pop" className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
            <Link href={`/dashboard/profile/${listing.buyer.id}`} className={HILLS_ACTION_QUIET}>
              View profile
            </Link>
          </div>
        </div>
      </HillsCard>

      {/* Image gallery */}
      <ImageGallery images={listing.images} alt={listing.commodity?.name ?? "listing"} />

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1 w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn("flex items-center gap-2 rounded-lg px-4 py-2 text-body-sm font-medium capitalize transition-all whitespace-nowrap",
              tab === key ? "bg-sage-soft text-green shadow-sm" : "text-ink-muted hover:text-ink")}>
            <Icon strokeWidth={1.5} className="size-4" />{label}
          </button>
        ))}
      </div>

      <Reveal effect="riseIn">
        {tab === "overview" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
            <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
              <h2 className="text-heading font-medium text-ink">About this demand</h2>
              <p className="mt-3 leading-relaxed text-body text-ink-muted">{listing.spec || "No specification provided."}</p>
              <div className="mt-5 space-y-3">
                {[
                  ["Posted by", <Link key="b" href={`/dashboard/profile/${listing.buyer.id}`} className="text-green hover:underline">{listing.buyer.name}</Link>],
                  ["Location", listing.area ?? "—"],
                  ["Capacity", `${listing.capacity_per_day} ${unit}s/day`],
                  ["Min order", `${listing.min_qty} ${unit}${listing.min_qty > 1 ? "s" : ""}`],
                  ["Delivery", listing.delivery_mode === "buyer_collects" ? "Buyer collects" : "Farmer delivers"],
                  ["Open slots", listing.open_slots?.length > 0 ? `${listing.open_slots.length} available` : "None right now"],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex items-center justify-between border-t border-line pt-3">
                    <span className="text-body-sm text-ink-muted">{label}</span>
                    <span className="text-body-sm font-medium text-ink">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-xl bg-field p-5 text-paper">
                <p className="text-label text-sage/60">Slots available</p>
                <p className="mt-1 font-num text-[2rem] font-medium text-amber">{remaining}</p>
                <p className="text-body-sm text-paper/60">{unit}s remaining of {capacity}</p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-field-soft">
                  <div className="h-full rounded-full bg-amber" style={{ width: `${pct}%` }} />
                </div>
              </div>

              <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
                <h3 className="text-body font-medium text-ink">Trust &amp; Safety</h3>
                <div className="mt-3 space-y-2.5">
                  {["Verified buyer", "Secure payment", "Weight-verified delivery"].map((t) => (
                    <div key={t} className="flex items-center gap-2 text-body-sm text-ink-muted">
                      <CheckCircle2 strokeWidth={2} className="size-4 text-success" /> {t}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "details" && (
          <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
            <h2 className="text-heading font-medium text-ink">Specifications</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                ["Commodity", listing.commodity?.name],
                ["Specification", listing.spec ?? "—"],
                ["Unit", unit],
                ["Price per unit", `₦${priceNaira.toLocaleString()} / ${unit}`],
                ["Capacity/day", `${listing.capacity_per_day} ${unit}s`],
                ["Min order", `${listing.min_qty} ${unit}s`],
                ["Min weight each", listing.min_unit_weight_kg ? `${listing.min_unit_weight_kg} kg` : "—"],
                ["Max weight each", listing.max_unit_weight_kg ? `${listing.max_unit_weight_kg} kg` : "—"],
                ["Delivery mode", listing.delivery_mode === "buyer_collects" ? "Buyer collects" : "Farmer delivers"],
                ["Location", listing.area ?? "—"],
                ["Cutoff", `${listing.cutoff_hours}h before delivery`],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-lg border border-line bg-paper px-4 py-3">
                  <p className="text-label text-ink-muted">{label}</p>
                  <p className="mt-0.5 text-body-sm font-medium text-ink">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "schedule" && (
          <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
            <h2 className="text-heading font-medium text-ink">Open Slots</h2>
            {listing.open_slots?.length === 0 ? (
              <p className="mt-4 text-body-sm text-ink-muted">No open slots available right now.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {listing.open_slots?.map((slot) => (
                  <div key={slot.id} className="flex items-center gap-4 rounded-lg border border-line bg-paper px-4 py-3">
                    <Calendar strokeWidth={1.5} className="size-5 text-green" />
                    <div className="flex-1">
                      <p className="text-body-sm font-medium text-ink">
                        {new Date(slot.date).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" })}
                      </p>
                      <p className="text-label text-ink-muted">
                        {slot.capacity_remaining} of {slot.capacity_total} {unit}s remaining
                      </p>
                    </div>
                    <button onClick={() => handleBook(slot.id)} disabled={booking || bookingDone || slot.capacity_remaining === 0}
                      className="rounded-lg bg-green px-4 py-2 text-body-sm font-medium text-paper hover:bg-green-hover disabled:opacity-50">
                      {bookingDone ? "Booked ✓" : slot.capacity_remaining === 0 ? "Full" : "Book"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "offers" && (
          <div className="space-y-4">
            {actionSuccess && (
              <div className="flex items-center gap-3 rounded-xl border border-green/30 bg-sage-soft/50 px-4 py-3">
                <CheckCircle2 strokeWidth={2} className="size-5 text-green" />
                <p className="text-body-sm font-medium text-ink">{actionSuccess}</p>
              </div>
            )}

            {/* Make offer form (for farmers) */}
            {!offerDone ? (
              <div ref={offerFormRef} className="rounded-xl border border-amber/30 bg-amber-soft/30 p-5">
                <h3 className="text-body font-medium text-ink">Make an Offer</h3>
                <p className="mt-1 text-body-sm text-ink-muted">
                  Submit how many {unit}s you can supply. Your price must fall within the buyer&apos;s range.
                </p>

                {/* Buyer's price range banner */}
                {(listing.unit_price_min_kobo || listing.unit_price_max_kobo) && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2.5">
                    <span className="text-body-sm text-ink-muted">Buyer pays:</span>
                    <span className="font-num text-body-sm font-medium text-green">
                      ₦{((listing.unit_price_min_kobo ?? listing.unit_price_kobo) / 100).toLocaleString("en-NG")}
                      {listing.unit_price_min_kobo !== listing.unit_price_max_kobo &&
                        ` – ₦${((listing.unit_price_max_kobo ?? listing.unit_price_kobo) / 100).toLocaleString("en-NG")}`}
                    </span>
                    <span className="text-label text-ink-muted">/ {unit}</span>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-body-sm font-medium text-ink">
                      Quantity ({unit}s)
                    </label>
                    <input type="number" min={listing.min_qty} value={offerQty}
                      onChange={(e) => setOfferQty(Math.max(listing.min_qty, parseInt(e.target.value) || listing.min_qty))}
                      className="w-full rounded-lg border border-line bg-white px-3 py-2.5 font-num text-body text-ink outline-none focus:border-green" />
                    <p className="mt-0.5 text-label text-ink-muted">Min: {listing.min_qty}</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-body-sm font-medium text-ink">
                      Your price (₦ / {unit})
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted">₦</span>
                      <input
                        type="number"
                        value={offerPrice}
                        min={listing.unit_price_min_kobo ? listing.unit_price_min_kobo / 100 : 1}
                        max={listing.unit_price_max_kobo ? listing.unit_price_max_kobo / 100 : undefined}
                        onChange={(e) => setOfferPrice(e.target.value)}
                        placeholder={String(listing.unit_price_kobo / 100)}
                        className="w-full rounded-lg border border-line bg-white py-2.5 pr-3 pl-7 font-num text-body text-ink outline-none focus:border-green"
                      />
                    </div>
                    {listing.unit_price_min_kobo && listing.unit_price_max_kobo && (
                      <p className="mt-0.5 text-label text-ink-muted">
                        ₦{(listing.unit_price_min_kobo / 100).toLocaleString()} – ₦{(listing.unit_price_max_kobo / 100).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-body-sm font-medium text-ink">Note (optional)</label>
                  <input type="text" value={offerNote} onChange={(e) => setOfferNote(e.target.value)}
                    placeholder="Quality, timing, etc."
                    className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-body text-ink outline-none focus:border-green" />
                </div>
                {offerPriceError && (
                  <p role="alert" className="mt-2 text-body-sm text-danger">{offerPriceError}</p>
                )}
                <button
                  onClick={() => {
                    // Validate price is within range
                    const priceNum = Number(offerPrice);
                    const minKobo = listing.unit_price_min_kobo ?? 0;
                    const maxKobo = listing.unit_price_max_kobo ?? Infinity;
                    if (!priceNum || priceNum <= 0) { setOfferPriceError("Enter your price per " + unit); return; }
                    if (priceNum * 100 < minKobo) { setOfferPriceError(`Price too low. Minimum is ₦${(minKobo / 100).toLocaleString()}`); return; }
                    if (priceNum * 100 > maxKobo) { setOfferPriceError(`Price too high. Maximum is ₦${(maxKobo / 100).toLocaleString()}`); return; }
                    setOfferPriceError(null);
                    setPinOpen("offer");
                  }}
                  disabled={offerSubmitting}
                  className="relative overflow-hidden mt-4 flex items-center gap-2 rounded-xl bg-amber px-5 py-2.5 text-body-sm font-medium text-ink hover:bg-amber/90 disabled:opacity-50">
                  <Send strokeWidth={1.5} className="size-4" />
                  Submit offer (PIN required)
                  <BusyBar active={offerSubmitting} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-green/30 bg-sage-soft/50 px-4 py-3">
                <CheckCircle2 strokeWidth={2} className="size-5 text-green" />
                <p className="text-body-sm text-ink">Offer submitted! The buyer will be notified.</p>
              </div>
            )}

            {/* Existing offers */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-body font-medium text-ink">All Offers {offers.length > 0 ? `(${offers.length})` : ""}</h3>
                {offersLoading && <Skeleton aria-label="Loading offers" className="h-4 w-16" />}
              </div>
              {offers.length === 0 ? (
                <p className="text-body-sm text-ink-muted py-4">No offers yet.</p>
              ) : (
                <div className="space-y-3">
                  {offers.map((offer) => {
                    const initials = offer.farmer.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
                    const isOwn = Boolean(meId && offer.farmer.id === meId);
                    return (
                      <div key={offer.id} className={cn(
                        "rounded-xl border bg-white p-4 shadow-sm",
                        isOwn ? "border-amber/40 bg-amber-soft/10" :
                        offer.status === "accepted" ? "border-green/40 bg-sage-soft/20" : "border-line",
                      )}>
                        <div className="flex items-start gap-3">
                          <Link href={`/dashboard/profile/${offer.farmer.id}`}
                            className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sage-soft font-num text-body-sm font-medium text-green hover:ring-2 hover:ring-green">
                            {offer.farmer.photo_url
                              ? <img src={offer.farmer.photo_url} alt={offer.farmer.name} className="size-full object-cover" referrerPolicy="no-referrer" />
                              : initials}
                          </Link>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isOwn ? (
                                <span className="font-medium text-ink">You</span>
                              ) : (
                                <Link href={`/dashboard/profile/${offer.farmer.id}`}
                                  className="font-medium text-ink hover:text-green hover:underline">
                                  {offer.farmer.name}
                                </Link>
                              )}
                              {offer.farmer.verified && (
                                <span className="rounded-full bg-sage-soft px-2 py-0.5 text-label font-medium text-green">✓</span>
                              )}
                              {isOwn && (
                                <span className="rounded-full bg-amber px-2 py-0.5 text-label font-medium text-ink">Your offer</span>
                              )}
                              <span className={cn("rounded-full px-2.5 py-0.5 text-label font-medium capitalize ml-auto",
                                offer.status === "accepted" ? "bg-sage-soft text-green" :
                                offer.status === "rejected" ? "bg-danger/10 text-danger" :
                                offer.status === "withdrawn" ? "bg-line text-ink-muted" : "bg-amber-soft text-amber")}>
                                {offer.status}
                              </span>
                            </div>
                            {!isOwn && offer.farmer.area && (
                              <p className="text-body-sm text-ink-muted flex items-center gap-1">
                                <MapPin strokeWidth={1.5} className="size-3.5" /> {offer.farmer.area}
                              </p>
                            )}
                            <p className="mt-1 font-num text-body-sm font-medium text-ink">
                              {offer.qty} {unit}s
                              {offer.unit_price_kobo != null
                                ? ` at ₦${(offer.unit_price_kobo / 100).toLocaleString()}/${unit}`
                                : ` at ₦${(listing.unit_price_kobo / 100).toLocaleString()}/${unit}`}
                            </p>
                            {offer.note && <p className="mt-1 text-body-sm text-ink-muted">{offer.note}</p>}
                          </div>
                        </div>

                        {/* Actions */}
                        {offer.status === "pending" && (
                          <div className="mt-3 flex gap-2 border-t border-line pt-3">
                            {isOwn ? (
                              <>
                                {/* Own offer: Remove + Edit */}
                                <button
                                  onClick={() => { if (confirm("Remove this offer?")) removeOffer(offer.id); }}
                                  className="flex items-center gap-1.5 rounded-lg border border-danger/40 bg-danger/5 px-4 py-2 text-body-sm font-medium text-danger hover:bg-danger/10">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  Remove offer
                                </button>
                                <button
                                  onClick={() => startEditOffer(offer)}
                                  className="flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-body-sm font-medium text-ink hover:border-green hover:text-green">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                  Edit offer
                                </button>
                              </>
                            ) : (
                              /* Others' offer: Accept (buyer only) */
                              <button
                                onClick={() => { setAcceptingOfferId(offer.id); setPinOpen("accept"); }}
                                className="flex items-center gap-1.5 rounded-lg bg-green px-4 py-2 text-body-sm font-medium text-paper hover:bg-green-hover">
                                <CheckCircle2 strokeWidth={2} className="size-3.5" /> Accept offer (PIN required)
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Reveal>

      {/* PIN modals */}
      {pinOpen === "offer" && (
        <TransactionPinModal
          mode="verify"
          onSuccess={async () => { setPinOpen(null); await submitOffer(); }}
          onClose={() => setPinOpen(null)}
        />
      )}
      {pinOpen === "accept" && acceptingOfferId && (
        <TransactionPinModal
          mode="verify"
          onSuccess={async () => { setPinOpen(null); await acceptOffer(acceptingOfferId); setAcceptingOfferId(null); }}
          onClose={() => { setPinOpen(null); setAcceptingOfferId(null); }}
        />
      )}
    </div>
  );
}
