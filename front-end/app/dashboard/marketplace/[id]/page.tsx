"use client";

import { useParams, useRouter } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import {
  ArrowLeft, MapPin, Clock, MessageSquare, TrendingUp, Shield, CheckCircle2,
  Calendar, Package, BarChart3, User,
} from "lucide-react";
import Link from "next/link";
import { getAuth } from "firebase/auth";

import app from "@/lib/firebase/config";
import { LogoVideo } from "@/components/dashboard/logo-video";
import { Reveal } from "@/components/motion/reveal";
import { fx, playOnEnter, useGSAP } from "@/lib/gsap/effects";
import { cn } from "@/lib/utils";
import { DetailSkeleton } from "@/components/loader/skeletons";
import { trackTask } from "@/lib/loading/progress";

const TABS = [
  { key: "overview", label: "Overview", icon: Package },
  { key: "details", label: "Specs", icon: BarChart3 },
  { key: "schedule", label: "Schedule", icon: Calendar },
] as const;

type Tab = (typeof TABS)[number]["key"];

type Listing = {
  id: string;
  spec: string | null;
  unit_price_kobo: number;
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
  const router = useRouter();
  const heroRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [bookingDone, setBookingDone] = useState(false);

  const id = params.id as string;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const finished = trackTask("marketplace-post");
      setError(null);
      try {
        const token = await getAuth(app).currentUser?.getIdToken();
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

  useGSAP(() => {
    const root = heroRef.current;
    if (!root) return;
    playOnEnter(fx("riseIn", root.querySelectorAll("[data-rise]"), { stagger: 0.08 }), root, "top 85%");
  }, { scope: heroRef });

  async function handleBook(slotId: string) {
    if (booking) return;
    setBooking(true);
    try {
      const token = await getAuth(app).currentUser?.getIdToken();
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

      {/* Hero */}
      <div ref={heroRef}
        className="relative isolate mb-6 overflow-hidden rounded-2xl bg-field px-6 py-8 text-paper lg:px-10 lg:py-10">
        <LogoVideo />

        <div data-rise className="flex items-center gap-2">
          <span className="rounded-full bg-green/20 px-2.5 py-1 font-num text-label font-medium text-sage">DEMAND</span>
          <span className={cn("rounded-full px-2.5 py-1 font-num text-label font-medium",
            listing.status === "active" ? "bg-sage/20 text-sage" : "bg-amber/20 text-amber")}>
            {listing.status}
          </span>
        </div>

        <h1 data-rise className="mt-3 font-display text-display-lg-sm font-medium text-paper md:text-[2rem]">
          {listing.commodity?.name}
        </h1>
        <p data-rise className="mt-1 text-body text-paper/70">{listing.spec ?? ""}</p>

        <div data-rise className="mt-4 flex items-baseline gap-2">
          <span className="font-num text-[2.2rem] font-medium text-amber">₦{priceNaira.toLocaleString()}</span>
          <span className="text-body-sm text-paper/60">per {unit}</span>
        </div>

        <div data-rise className="mt-4 flex flex-wrap items-center gap-4 text-body-sm text-paper/70">
          {listing.area && (
            <span className="flex items-center gap-1.5"><MapPin strokeWidth={1.5} className="size-4" />{listing.area}</span>
          )}
          {firstSlot && (
            <span className="flex items-center gap-1.5">
              <Clock strokeWidth={1.5} className="size-4" />
              {new Date(firstSlot.date).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })}
            </span>
          )}
          <Link href={`/dashboard/profile/${listing.buyer.id}`}
            className="flex items-center gap-1.5 hover:text-paper">
            <Shield strokeWidth={1.5} className="size-4" />
            {listing.buyer.name} (buyer)
          </Link>
        </div>

        <div data-rise className="mt-6 flex flex-wrap gap-3">
          {bookingDone ? (
            <div className="flex items-center gap-2 rounded-xl bg-green/20 px-5 py-2.5 text-body-sm font-medium text-paper">
              <CheckCircle2 strokeWidth={2} className="size-4" /> Booking confirmed!
            </div>
          ) : firstSlot ? (
            <button onClick={() => handleBook(firstSlot.id)} disabled={booking || remaining === 0}
              className="flex items-center gap-2 rounded-xl bg-amber px-5 py-2.5 text-body-sm font-medium text-ink hover:bg-amber/90 disabled:opacity-50">
              <TrendingUp strokeWidth={1.5} className="size-4" />
              {booking ? "Booking…" : remaining === 0 ? "Slot full" : `Book ${listing.min_qty} ${unit}${listing.min_qty > 1 ? "s" : ""}`}
            </button>
          ) : (
            <span className="rounded-xl bg-field-soft/40 px-5 py-2.5 text-body-sm font-medium text-paper/50">No open slots</span>
          )}
          <button
            onClick={() => router.push(`/dashboard/messages?to=${encodeURIComponent(listing.buyer.name)}`)}
            className="flex items-center gap-2 rounded-xl border border-sage/30 bg-field-soft/60 px-5 py-2.5 text-body-sm font-medium text-paper hover:bg-field-soft">
            <MessageSquare strokeWidth={1.5} className="size-4" /> Message {listing.buyer.name}
          </button>
          <Link href={`/dashboard/profile/${listing.buyer.id}`}
            className="flex items-center gap-2 rounded-xl border border-sage/30 bg-field-soft/60 px-5 py-2.5 text-body-sm font-medium text-paper hover:bg-field-soft">
            <User strokeWidth={1.5} className="size-4" /> View profile
          </Link>
        </div>
      </div>

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
      </Reveal>
    </div>
  );
}
