"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import {
  ArrowLeft, MapPin, Clock, MessageSquare, TrendingUp, Shield, CheckCircle2,
  Calendar, Package, BarChart3,
} from "lucide-react";
import Link from "next/link";

import { LogoVideo } from "@/components/dashboard/logo-video";
import { Reveal } from "@/components/motion/reveal";
import { OfferModal } from "@/components/marketplace/offer-modal";
import { fx, playOnEnter, useGSAP } from "@/lib/gsap/effects";
import { cn } from "@/lib/utils";
import { MARKET_ITEMS, SAMPLE_OFFERS, type MarketItem, type Offer } from "@/lib/demo/market";

const TABS = [
  { key: "overview", label: "Overview", icon: Package },
  { key: "offers", label: "Offers", icon: TrendingUp },
  { key: "details", label: "Specs", icon: BarChart3 },
  { key: "schedule", label: "Schedule", icon: Calendar },
] as const;

type Tab = typeof TABS[number]["key"];

export default function ProductDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const heroRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [offerOpen, setOfferOpen] = useState(false);
  const [extraOffers, setExtraOffers] = useState<Offer[]>([]);

  const id = params.id as string;
  const item = MARKET_ITEMS.find((i) => i.id === id);

  useGSAP(
    () => {
      const root = heroRef.current;
      if (!root) return;
      playOnEnter(fx("riseIn", root.querySelectorAll("[data-rise]"), { stagger: 0.08 }), root, "top 85%");
    },
    { scope: heroRef },
  );

  if (!item) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-20 text-center">
        <p className="font-display text-title font-medium text-ink">Item not found</p>
        <Link href="/dashboard/marketplace" className="rounded-lg bg-green px-5 py-2.5 text-body-sm font-medium text-paper">
          Back to marketplace
        </Link>
      </div>
    );
  }

  const isDemand = item.type === "demand";
  const allOffers = [...(SAMPLE_OFFERS[item.id] ?? []), ...extraOffers];
  const pct = item.capacity === 0 ? 0 : Math.round((item.remaining / item.capacity) * 100);
  const currentItem: MarketItem = item;

  function handleMessage() {
    const msg = encodeURIComponent(
      `Hi ${currentItem.poster}, I'm reaching out about your ${currentItem.type === "demand" ? "demand for" : "listing of"} ${currentItem.commodity} (${currentItem.spec}). I saw it on Lumora and I'm interested.`
    );
    router.push(`/dashboard/messages?auto=${msg}&to=${encodeURIComponent(currentItem.poster)}`);
  }

  function handleRequestDetails() {
    const msg = encodeURIComponent(
      `Hi ${currentItem.poster}, I'd like more details about your ${currentItem.type === "demand" ? "demand for" : "listing of"} ${currentItem.commodity}. Specifically: quality requirements, delivery logistics, and payment terms.`
    );
    router.push(`/dashboard/messages?auto=${msg}&to=${encodeURIComponent(currentItem.poster)}`);
  }

  function submitOffer(offer: Offer) {
    setExtraOffers((prev) => [...prev, offer]);
  }

  return (
    <>
      <div className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-6 lg:px-8">

        {/* Back */}
        <Link
          href="/dashboard/marketplace"
          className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-ink"
        >
          <ArrowLeft strokeWidth={1.5} className="size-4" />
          Back to marketplace
        </Link>

        {/* ── Hero ─────────────────────────────────────────────── */}
        <div
          ref={heroRef}
          className="relative isolate mb-6 overflow-hidden rounded-2xl bg-field px-6 py-8 text-paper lg:px-10 lg:py-10"
        >
          <LogoVideo />

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
            {/* Image */}
            <div className="relative h-48 w-full overflow-hidden rounded-xl lg:h-56 lg:w-72 shrink-0">
              {item.image && (
                <Image
                  src={item.image}
                  alt={item.commodity}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 288px"
                />
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div data-rise className="flex items-center gap-2">
                <span className={cn(
                  "rounded-full px-2.5 py-1 font-num text-label font-medium",
                  isDemand ? "bg-green/20 text-sage" : "bg-amber/20 text-amber",
                )}>
                  {isDemand ? "📣 DEMAND" : "🌾 LISTING"}
                </span>
                <span className="text-label text-sage/50">{item.postedAgo}</span>
              </div>

              <h1 data-rise className="mt-3 font-display text-display-lg-sm font-medium text-paper md:text-[2rem]">
                {item.commodity}
              </h1>
              <p data-rise className="mt-1 text-body text-paper/70">{item.spec}</p>

              {/* Price */}
              <div data-rise className="mt-4 flex items-baseline gap-2">
                <span className="font-num text-[2.2rem] font-medium text-amber">₦{item.price.toLocaleString()}</span>
                <span className="text-body-sm text-paper/60">per {item.priceUnit}</span>
              </div>

              {/* Meta */}
              <div data-rise className="mt-4 flex flex-wrap items-center gap-4 text-body-sm text-paper/70">
                <span className="flex items-center gap-1.5">
                  <MapPin strokeWidth={1.5} className="size-4" />
                  {item.area}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock strokeWidth={1.5} className="size-4" />
                  {item.day}
                </span>
                <span className="flex items-center gap-1.5">
                  <Shield strokeWidth={1.5} className="size-4" />
                  {item.poster} ({item.posterRole})
                </span>
              </div>

              {/* Actions */}
              <div data-rise className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => setOfferOpen(true)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-5 py-2.5 text-body-sm font-medium",
                    isDemand
                      ? "bg-amber text-ink hover:bg-amber/90"
                      : "bg-sage/20 text-sage hover:bg-sage/30",
                  )}
                >
                  <TrendingUp strokeWidth={1.5} className="size-4" />
                  Make offer
                </button>
                <button
                  onClick={handleMessage}
                  className="flex items-center gap-2 rounded-xl border border-sage/30 bg-field-soft/60 px-5 py-2.5 text-body-sm font-medium text-paper hover:bg-field-soft"
                >
                  <MessageSquare strokeWidth={1.5} className="size-4" />
                  Message {item.poster}
                </button>
                <button
                  onClick={handleRequestDetails}
                  className="flex items-center gap-2 rounded-xl border border-sage/30 bg-field-soft/60 px-5 py-2.5 text-body-sm font-medium text-paper hover:bg-field-soft"
                >
                  <Package strokeWidth={1.5} className="size-4" />
                  Request details
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────── */}
        <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1 w-fit">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-body-sm font-medium capitalize transition-all whitespace-nowrap",
                tab === key
                  ? "bg-sage-soft text-green shadow-sm"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              <Icon strokeWidth={1.5} className="size-4" />
              {label}
              {key === "offers" && allOffers.length > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-green px-1.5 font-num text-label font-medium text-paper">
                  {allOffers.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab content ──────────────────────────────────────── */}
        <Reveal effect="riseIn">
          {tab === "overview" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
              {/* Description */}
              <div className="rounded-xl border border-line bg-white p-6 shadow-sm" style={{ clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%)" }}>
                <h2 className="text-heading font-medium text-ink">About this {isDemand ? "demand" : "listing"}</h2>
                <p className="mt-3 leading-relaxed text-body text-ink-muted">{item.description}</p>

                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between border-t border-line pt-3">
                    <span className="text-body-sm text-ink-muted">Posted by</span>
                    <span className="text-body-sm font-medium text-ink">{item.poster}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-line pt-3">
                    <span className="text-body-sm text-ink-muted">Location</span>
                    <span className="text-body-sm font-medium text-ink">{item.area}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-line pt-3">
                    <span className="text-body-sm text-ink-muted">Capacity</span>
                    <span className="font-num text-body-sm font-medium text-ink">{item.capacity} {item.unitPlural}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-line pt-3">
                    <span className="text-body-sm text-ink-muted">Remaining</span>
                    <span className="font-num text-body-sm font-medium text-amber">{item.remaining} {item.unitPlural}</span>
                  </div>
                </div>
              </div>

              {/* Capacity card */}
              <div className="flex flex-col gap-4">
                <div className="rounded-xl bg-field p-5 text-paper" style={{ clipPath: "polygon(14px 0, 100% 0, 100% 100%, 0 100%, 0 14px)" }}>
                  <p className="text-label text-sage/60">Live capacity</p>
                  <p className="mt-1 font-num text-[2rem] font-medium text-amber">{item.remaining}</p>
                  <p className="text-body-sm text-paper/60">{item.unitPlural} remaining of {item.capacity}</p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-field-soft">
                    <div className="h-full rounded-full bg-amber" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
                  <h3 className="text-body font-medium text-ink">Trust & Safety</h3>
                  <div className="mt-3 space-y-2.5">
                    <div className="flex items-center gap-2 text-body-sm text-ink-muted">
                      <CheckCircle2 strokeWidth={2} className="size-4 text-success" /> Verified poster
                    </div>
                    <div className="flex items-center gap-2 text-body-sm text-ink-muted">
                      <CheckCircle2 strokeWidth={2} className="size-4 text-success" /> Secure payment
                    </div>
                    <div className="flex items-center gap-2 text-body-sm text-ink-muted">
                      <CheckCircle2 strokeWidth={2} className="size-4 text-success" /> Weight-verified delivery
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "offers" && (
            <div className="flex flex-col gap-4">
              {/* Make offer CTA */}
              <div className="flex items-center gap-3 rounded-xl border border-amber/30 bg-amber-soft/40 p-4">
                <TrendingUp strokeWidth={1.5} className="size-5 shrink-0 text-amber" />
                <p className="flex-1 text-body-sm text-ink">
                  {allOffers.length > 0
                    ? `${allOffers.length} offer${allOffers.length > 1 ? "s" : ""} on this ${isDemand ? "demand" : "listing"}. Submit yours to compete.`
                    : `No offers yet. Be the first to make an offer on this ${isDemand ? "demand" : "listing"}.`}
                </p>
                <button
                  onClick={() => setOfferOpen(true)}
                  className="shrink-0 rounded-lg bg-amber px-4 py-2 text-body-sm font-medium text-ink hover:bg-amber/90"
                >
                  Make offer
                </button>
                </div>

              {/* Offers list */}
              {allOffers.length > 0 ? (
                allOffers.map((offer, i) => (
                  <div
                    key={offer.id}
                    className="rounded-xl border border-line bg-white p-5 shadow-sm transition-all hover:shadow-md"
                    style={{
                      clipPath: i % 2 === 0
                        ? "polygon(0 0, 100% 0, 100% 100%, 12px 100%, 0 calc(100% - 12px))"
                        : "polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-sage-soft">
                          <span className="font-num text-body-sm font-medium text-green">{offer.farmer[0]}</span>
                        </div>
                        <div>
                          <p className="font-medium text-ink">{offer.farmer}</p>
                          <p className="text-body-sm text-ink-muted">{offer.area}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-num text-number font-medium text-amber">
                          ₦{offer.price.toLocaleString()}/{offer.priceUnit}
                        </p>
                        <p className="font-num text-body-sm text-ink-muted">{offer.qty} {offer.unitPlural}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-body-sm text-ink-muted">{offer.note}</p>
                    <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                      <span className="font-num text-label text-ink-muted">{offer.timeAgo}</span>
                      <div className="flex gap-2">
                        <button className="rounded-lg bg-sage-soft px-3 py-1.5 text-label font-medium text-green hover:bg-green hover:text-paper">
                          Accept
                        </button>
                        <button
                          onClick={handleMessage}
                          className="flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-label font-medium text-ink-muted hover:border-green hover:text-green"
                        >
                          <MessageSquare strokeWidth={1.5} className="size-3" />
                          Message
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center gap-3 rounded-2xl bg-field px-8 py-16 text-center text-paper">
                  <TrendingUp strokeWidth={1} className="size-10 text-sage/30" />
                  <p className="font-display text-title font-medium text-paper">No offers yet</p>
                  <p className="text-body text-paper/60">
                    {isDemand ? "Be the first to make an offer on this demand." : "This is a listing — message the farmer directly."}
                  </p>
                </div>
              )}
            </div>
          )}

          {tab === "details" && (
            <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
              <h2 className="text-heading font-medium text-ink">Specifications</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  { label: "Commodity", value: item.commodity },
                  { label: "Specification", value: item.spec },
                  { label: "Unit", value: item.unit },
                  { label: "Price per unit", value: `₦${item.price.toLocaleString()} / ${item.priceUnit}` },
                  { label: "Total capacity", value: `${item.capacity} ${item.unitPlural}` },
                  { label: "Remaining", value: `${item.remaining} ${item.unitPlural}` },
                  { label: "Location", value: item.area },
                  { label: "Delivery", value: item.day },
                ].map((row) => (
                  <div key={row.label} className="rounded-lg border border-line bg-paper px-4 py-3">
                    <p className="text-label text-ink-muted">{row.label}</p>
                    <p className="mt-0.5 text-body-sm font-medium text-ink">{row.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "schedule" && (
            <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
              <h2 className="text-heading font-medium text-ink">Delivery Schedule</h2>
              <div className="mt-4 flex items-center gap-4 rounded-lg border border-line bg-paper p-4">
                <Calendar strokeWidth={1.5} className="size-6 text-green" />
                <div>
                  <p className="text-body-sm font-medium text-ink">{item.day}</p>
                  <p className="text-body-sm text-ink-muted">Delivery window for this {isDemand ? "demand" : "listing"}</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3 rounded-lg px-4 py-3 hover:bg-sage-soft/30">
                  <div className="flex size-8 items-center justify-center rounded-full bg-green/10 text-green">
                    <CheckCircle2 strokeWidth={2} className="size-4" />
                  </div>
                  <div>
                    <p className="text-body-sm font-medium text-ink">Booking confirmed</p>
                    <p className="text-label text-ink-muted">Capacity reserved in real time</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg px-4 py-3 hover:bg-sage-soft/30">
                  <div className="flex size-8 items-center justify-center rounded-full bg-amber/10 text-amber">
                    <Clock strokeWidth={2} className="size-4" />
                  </div>
                  <div>
                    <p className="text-body-sm font-medium text-ink">Cut-off time</p>
                    <p className="text-label text-ink-muted">Book at least 24 hours before delivery</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Reveal>
      </div>

      {/* Offer modal */}
      <OfferModal
        open={offerOpen}
        onClose={() => setOfferOpen(false)}
        item={item}
        onMakeOffer={submitOffer}
      />
    </>
  );
}
