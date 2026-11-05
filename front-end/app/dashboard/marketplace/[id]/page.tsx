"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  ArrowLeft, MapPin, Clock, Shield, CheckCircle2,
  Calendar, Package, BarChart3, } from "lucide-react";
import Link from "next/link";
import { getAuth } from "firebase/auth";

import app from "@/lib/firebase/config";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";
import { DetailSkeleton } from "@/components/loader/skeletons";
import { HILLS_ACTION, HILLS_ACTION_QUIET, HillsCard } from "@/components/profile/hills-card";
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
            <span className="font-num text-[30px] leading-tight font-medium tracking-tight text-ink sm:text-[38px]">₦{priceNaira.toLocaleString()}</span>
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
            {bookingDone ? (
              <div role="status" className={HILLS_ACTION_QUIET}>
                <CheckCircle2 aria-hidden="true" strokeWidth={2} className="mr-2 size-4 text-green" /> Booking confirmed!
              </div>
            ) : firstSlot ? (
              <button
                type="button"
                onClick={() => handleBook(firstSlot.id)}
                disabled={booking || remaining === 0}
                className={`${HILLS_ACTION} disabled:pointer-events-none disabled:opacity-50`}
              >
                {booking ? "Booking…" : remaining === 0 ? "Slot full" : `Book ${listing.min_qty} ${unit}${listing.min_qty > 1 ? "s" : ""}`}
              </button>
            ) : (
              <span className={`${HILLS_ACTION_QUIET} pointer-events-none text-ink-muted`}>No open slots</span>
            )}
            <button
              type="button"
              onClick={() => router.push(`/dashboard/messages?to=${encodeURIComponent(listing.buyer.name)}`)}
              className={HILLS_ACTION_QUIET}
            >
              Message {listing.buyer.name}
            </button>
            <Link href={`/dashboard/profile/${listing.buyer.id}`} className={HILLS_ACTION_QUIET}>
              View profile
            </Link>
          </div>
        </div>
      </HillsCard>

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
