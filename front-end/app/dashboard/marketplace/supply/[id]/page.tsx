"use client";

import { useParams } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import {
  ArrowLeft, MapPin, Clock, Shield, CheckCircle2,
  Calendar, Package, BarChart3, Loader2, User, Send, Star,
} from "lucide-react";
import Link from "next/link";
import { getToken } from "@/lib/firebase/auth";

import { LogoVideo } from "@/components/dashboard/logo-video";
import { Reveal } from "@/components/motion/reveal";
import { TransactionPinModal } from "@/components/dashboard/transaction-pin-modal";
import { fx, playOnEnter, useGSAP } from "@/lib/gsap/effects";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "overview", label: "Overview", icon: Package },
  { key: "offers", label: "Offers", icon: Star },
  { key: "specs", label: "Specs", icon: BarChart3 },
] as const;

type Tab = (typeof TABS)[number]["key"];

type SupplyListing = {
  id: string;
  title: string;
  description: string | null;
  unit_price_kobo: number;
  unit_price_min_kobo: number | null;
  unit_price_max_kobo: number | null;
  qty: number;
  unit: string;
  images: string[];
  status: string;
  created_at: string;
  commodity: { id: string; name: string; unit: string } | null;
  farmer: { id: string; name: string; area: string | null; verified: boolean; photo_url: string | null };
  area: string | null;
};

type BuyerOffer = {
  id: string;
  qty: number;
  note: string | null;
  status: string;
  created_at: string;
  buyer: { id: string; name: string; area: string | null; verified: boolean; photo_url: string | null };
};

export default function SupplyListingDetailPage() {
  const params = useParams();
  const heroRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [listing, setListing] = useState<SupplyListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Offers state
  const [offers, setOffers] = useState<BuyerOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offerQty, setOfferQty] = useState(1);
  const [offerPrice, setOfferPrice] = useState("");
  const [offerPriceError, setOfferPriceError] = useState<string | null>(null);
  const [offerNote, setOfferNote] = useState("");
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [offerDone, setOfferDone] = useState(false);
  const [pinOpen, setPinOpen] = useState<"offer" | "accept" | null>(null);
  const [acceptingOfferId, setAcceptingOfferId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const id = params.id as string;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const res = await fetch(`/api/supply-listings/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as SupplyListing;
        if (!cancelled) setListing(data);
      } catch {
        if (!cancelled) setError("Couldn't load this listing. Please refresh.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  useGSAP(() => {
    const root = heroRef.current;
    if (!root) return;
    playOnEnter(fx("riseIn", root.querySelectorAll("[data-rise]"), { stagger: 0.08 }), root, "top 85%");
  }, { scope: heroRef });

  async function loadOffers() {
    if (!listing) return;
    setOffersLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/supply-listings/${id}/offers`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) setOffers((await res.json()) as BuyerOffer[]);
    } catch { /* */ } finally { setOffersLoading(false); }
  }

  useEffect(() => {
    if (listing && tab === "offers") loadOffers();
  }, [tab, listing]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitOffer() {
    setOfferSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/buyer-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ listingId: id, qty: offerQty, note: offerNote || null, unitPriceKobo: offerPrice ? Math.round(Number(offerPrice) * 100) : null }),
      });
      const result = await res.json();
      if (result.ok) { setOfferDone(true); loadOffers(); }
      else alert(result.message ?? result.code ?? "Offer failed.");
    } catch { alert("Network error. Try again."); } finally { setOfferSubmitting(false); }
  }

  async function acceptOffer(offerId: string) {
    const token = await getToken();
    const res = await fetch(`/api/buyer-offers/${offerId}/accept`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const result = await res.json();
    if (result.ok) {
      setActionSuccess("Offer accepted! The buyer will be notified.");
      loadOffers();
    } else {
      alert(result.message ?? result.code ?? "Could not accept offer.");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-ink-muted" />
      </div>
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

  const unit = listing.unit || listing.commodity?.unit || "unit";
  const priceNaira = listing.unit_price_kobo / 100;

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-6 lg:px-8">

      <Link href="/dashboard/marketplace"
        className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft strokeWidth={1.5} className="size-4" /> Back to marketplace
      </Link>

      {/* Hero */}
      <div ref={heroRef}
        className="relative isolate mb-6 overflow-hidden rounded-2xl bg-field px-6 py-8 text-paper lg:px-10 lg:py-10">
        <LogoVideo />

        <div data-rise className="flex items-center gap-2">
          <span className="rounded-full bg-green/20 px-2.5 py-1 font-num text-label font-medium text-sage">SUPPLY</span>
          <span className={cn("rounded-full px-2.5 py-1 font-num text-label font-medium",
            listing.status === "active" ? "bg-sage/20 text-sage" : "bg-amber/20 text-amber")}>
            {listing.status}
          </span>
        </div>

        <h1 data-rise className="mt-3 font-display text-display-lg-sm font-medium text-paper md:text-[2rem]">
          {listing.title}
        </h1>
        <p data-rise className="mt-1 text-body text-paper/70">{listing.description ?? ""}</p>

        <div data-rise className="mt-4 flex items-baseline gap-2">
          <span className="font-num text-[2.2rem] font-medium text-amber">₦{priceNaira.toLocaleString()}</span>
          <span className="text-body-sm text-paper/60">per {unit}</span>
        </div>

        <div data-rise className="mt-4 flex flex-wrap items-center gap-4 text-body-sm text-paper/70">
          {listing.area && (
            <span className="flex items-center gap-1.5"><MapPin strokeWidth={1.5} className="size-4" />{listing.area}</span>
          )}
          <span className="flex items-center gap-1.5">
            <Package strokeWidth={1.5} className="size-4" />
            {listing.qty} {unit}{listing.qty > 1 ? "s" : ""} available
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar strokeWidth={1.5} className="size-4" />
            {new Date(listing.created_at).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })}
          </span>
          <Link href={`/dashboard/profile/${listing.farmer.id}`}
            className="flex items-center gap-1.5 hover:text-paper">
            <Shield strokeWidth={1.5} className="size-4" />
            {listing.farmer.name} (farmer)
          </Link>
        </div>

        <div data-rise className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => setTab("offers")}
            className="flex items-center gap-2 rounded-xl bg-amber px-5 py-2.5 text-body-sm font-medium text-ink hover:bg-amber/90">
            <Send strokeWidth={1.5} className="size-4" /> Make an offer
          </button>
          <Link href={`/dashboard/profile/${listing.farmer.id}`}
            className="flex items-center gap-2 rounded-xl border border-sage/30 bg-field-soft/60 px-5 py-2.5 text-body-sm font-medium text-paper hover:bg-field-soft">
            <User strokeWidth={1.5} className="size-4" /> View profile
          </Link>
        </div>
      </div>

      {/* Image gallery */}
      {listing.images && listing.images.length > 0 && (
        <div data-rise className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {listing.images.map((url, idx) => (
            <div key={idx} className="aspect-square overflow-hidden rounded-2xl border border-line bg-paper">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Photo ${idx + 1}`} className="size-full object-cover" />
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1 w-fit">
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
              <h2 className="text-heading font-medium text-ink">About this supply</h2>
              <p className="mt-3 leading-relaxed text-body text-ink-muted">{listing.description || "No description provided."}</p>
              <div className="mt-5 space-y-3">
                {[
                  ["Posted by", <Link key="f" href={`/dashboard/profile/${listing.farmer.id}`} className="text-green hover:underline">{listing.farmer.name}</Link>],
                  ["Commodity", listing.commodity?.name ?? "—"],
                  ["Location", listing.area ?? "—"],
                  ["Quantity", `${listing.qty} ${unit}${listing.qty > 1 ? "s" : ""}`],
                  ["Price", `₦${priceNaira.toLocaleString()} / ${unit}`],
                  ["Posted", new Date(listing.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })],
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
                <p className="text-label text-sage/60">Available</p>
                <p className="mt-1 font-num text-[2rem] font-medium text-amber">{listing.qty}</p>
                <p className="text-body-sm text-paper/60">{unit}{listing.qty > 1 ? "s" : ""} listed by the farmer</p>
              </div>

              <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
                <h3 className="text-body font-medium text-ink">Trust &amp; Safety</h3>
                <div className="mt-3 space-y-2.5">
                  {["Verified farmer", "Secure payment", "Quality-verified produce"].map((t) => (
                    <div key={t} className="flex items-center gap-2 text-body-sm text-ink-muted">
                      <CheckCircle2 strokeWidth={2} className="size-4 text-success" /> {t}
                    </div>
                  ))}
                </div>
              </div>
            </div>
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

            {/* Make offer form (for buyers) */}
            {!offerDone ? (
              <div className="rounded-xl border border-amber/30 bg-amber-soft/30 p-5">
                <h3 className="text-body font-medium text-ink">Make an Offer</h3>
                <p className="mt-1 text-body-sm text-ink-muted">
                  Submit how many {unit}s you want to buy. Your price must be within the farmer&apos;s range.
                </p>

                {/* Farmer's asking price banner */}
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2.5">
                  <span className="text-body-sm text-ink-muted">Farmer asks:</span>
                  <span className="font-num text-body-sm font-medium text-amber">
                    {listing.unit_price_min_kobo && listing.unit_price_min_kobo !== listing.unit_price_kobo
                      ? `₦${(listing.unit_price_min_kobo / 100).toLocaleString("en-NG")} – ₦${(listing.unit_price_kobo / 100).toLocaleString("en-NG")}`
                      : `₦${(listing.unit_price_kobo / 100).toLocaleString("en-NG")}`}
                  </span>
                  <span className="text-label text-ink-muted">/ {unit}</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-body-sm font-medium text-ink">
                      Quantity ({unit}s)
                    </label>
                    <input type="number" min={1} value={offerQty}
                      onChange={(e) => setOfferQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full rounded-lg border border-line bg-white px-3 py-2.5 font-num text-body text-ink outline-none focus:border-green" />
                    <p className="mt-0.5 text-label text-ink-muted">Available: {listing.qty}</p>
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
                        max={listing.unit_price_max_kobo ? listing.unit_price_max_kobo / 100 : listing.unit_price_kobo / 100}
                        onChange={(e) => { setOfferPrice(e.target.value); setOfferPriceError(null); }}
                        placeholder={String(listing.unit_price_kobo / 100)}
                        className="w-full rounded-lg border border-line bg-white py-2.5 pr-3 pl-7 font-num text-body text-ink outline-none focus:border-green"
                      />
                    </div>
                    {listing.unit_price_min_kobo && (
                      <p className="mt-0.5 text-label text-ink-muted">
                        ₦{(listing.unit_price_min_kobo / 100).toLocaleString()} – ₦{((listing.unit_price_max_kobo ?? listing.unit_price_kobo) / 100).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-body-sm font-medium text-ink">Note (optional)</label>
                  <input type="text" value={offerNote} onChange={(e) => setOfferNote(e.target.value)}
                    placeholder="Delivery, timing, etc."
                    className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-body text-ink outline-none focus:border-green" />
                </div>
                {offerPriceError && (
                  <p role="alert" className="mt-2 text-body-sm text-danger">{offerPriceError}</p>
                )}
                <button
                  onClick={() => {
                    const priceNum = Number(offerPrice);
                    const minKobo = listing.unit_price_min_kobo ?? 0;
                    const maxKobo = listing.unit_price_max_kobo ?? listing.unit_price_kobo;
                    if (!priceNum || priceNum <= 0) { setOfferPriceError("Enter your price per " + unit); return; }
                    if (priceNum * 100 < minKobo) { setOfferPriceError(`Price too low. Minimum is ₦${(minKobo / 100).toLocaleString()}`); return; }
                    if (priceNum * 100 > maxKobo) { setOfferPriceError(`Price too high. Maximum is ₦${(maxKobo / 100).toLocaleString()}`); return; }
                    setOfferPriceError(null);
                    setPinOpen("offer");
                  }}
                  disabled={offerSubmitting}
                  className="mt-4 flex items-center gap-2 rounded-xl bg-amber px-5 py-2.5 text-body-sm font-medium text-ink hover:bg-amber/90 disabled:opacity-50">
                  {offerSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Send strokeWidth={1.5} className="size-4" />}
                  Submit offer (PIN required)
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-green/30 bg-sage-soft/50 px-4 py-3">
                <CheckCircle2 strokeWidth={2} className="size-5 text-green" />
                <p className="text-body-sm text-ink">Offer submitted! The farmer will be notified.</p>
              </div>
            )}

            {/* Existing offers */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-body font-medium text-ink">All Offers {offers.length > 0 ? `(${offers.length})` : ""}</h3>
                {offersLoading && <Loader2 className="size-4 animate-spin text-ink-muted" />}
              </div>
              {offers.length === 0 ? (
                <p className="text-body-sm text-ink-muted py-4">No offers yet.</p>
              ) : (
                <div className="space-y-3">
                  {offers.map((offer) => {
                    const initials = offer.buyer.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
                    return (
                      <div key={offer.id} className={cn(
                        "rounded-xl border bg-white p-4 shadow-sm",
                        offer.status === "accepted" ? "border-green/40 bg-sage-soft/20" : "border-line",
                      )}>
                        <div className="flex items-start gap-3">
                          <Link href={`/dashboard/profile/${offer.buyer.id}`}
                            className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sage-soft font-num text-body-sm font-medium text-green hover:ring-2 hover:ring-green">
                            {offer.buyer.photo_url
                              ? <img src={offer.buyer.photo_url} alt={offer.buyer.name} className="size-full object-cover" referrerPolicy="no-referrer" />
                              : initials}
                          </Link>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Link href={`/dashboard/profile/${offer.buyer.id}`}
                                className="font-medium text-ink hover:text-green hover:underline">
                                {offer.buyer.name}
                              </Link>
                              {offer.buyer.verified && (
                                <span className="rounded-full bg-sage-soft px-2 py-0.5 text-label font-medium text-green">✓</span>
                              )}
                              <span className={cn("rounded-full px-2.5 py-0.5 text-label font-medium capitalize ml-auto",
                                offer.status === "accepted" ? "bg-sage-soft text-green" :
                                offer.status === "rejected" ? "bg-danger/10 text-danger" : "bg-amber-soft text-amber")}>
                                {offer.status}
                              </span>
                            </div>
                            {offer.buyer.area && (
                              <p className="text-body-sm text-ink-muted flex items-center gap-1">
                                <MapPin strokeWidth={1.5} className="size-3.5" /> {offer.buyer.area}
                              </p>
                            )}
                            <p className="mt-1 font-num text-body-sm font-medium text-ink">
                              {offer.qty} {unit}s at ₦{priceNaira.toLocaleString()}/{unit}
                            </p>
                            {offer.note && <p className="mt-1 text-body-sm text-ink-muted">{offer.note}</p>}
                            <p className="mt-1 text-label text-ink-muted flex items-center gap-1">
                              <Clock strokeWidth={1.5} className="size-3" />
                              {new Date(offer.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                            </p>
                          </div>
                        </div>
                        {offer.status === "pending" && (
                          <div className="mt-3 flex gap-2 border-t border-line pt-3">
                            <button
                              onClick={() => { setAcceptingOfferId(offer.id); setPinOpen("accept"); }}
                              className="flex items-center gap-1.5 rounded-lg bg-green px-4 py-2 text-body-sm font-medium text-paper hover:bg-green-hover">
                              <CheckCircle2 strokeWidth={2} className="size-3.5" /> Accept offer (PIN required)
                            </button>
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

        {tab === "specs" && (
          <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
            <h2 className="text-heading font-medium text-ink">Specifications</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                ["Commodity", listing.commodity?.name ?? "—"],
                ["Title", listing.title],
                ["Unit", unit],
                ["Price per unit", `₦${priceNaira.toLocaleString()} / ${unit}`],
                ["Quantity", `${listing.qty} ${unit}${listing.qty > 1 ? "s" : ""}`],
                ["Description", listing.description ?? "—"],
                ["Location", listing.area ?? "—"],
                ["Posted", new Date(listing.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })],
                ["Status", listing.status],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-lg border border-line bg-paper px-4 py-3">
                  <p className="text-label text-ink-muted">{label}</p>
                  <p className="mt-0.5 text-body-sm font-medium text-ink">{value}</p>
                </div>
              ))}
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
