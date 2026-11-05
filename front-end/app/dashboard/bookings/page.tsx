"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, MapPin, X, CheckCircle2, Store, Loader2 } from "lucide-react";
import Link from "next/link";
import { getAuth } from "firebase/auth";

import app from "@/lib/firebase/config";
import { LogoVideo } from "@/components/dashboard/logo-video";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

type Status = "confirmed" | "booked" | "cancelled" | "completed" | "no_show";
type Tab = "upcoming" | "past" | "cancelled";

type Booking = {
  id: string;
  code: string;
  qty: number;
  status: string;
  created_at: string;
  slot: {
    date: string;
    window_start: string;
    window_end: string;
    listing: {
      spec: string;
      unit_price_kobo: number;
      location_area: string | null;
      commodity: { name: string; unit: string };
      buyer: { id: string; name: string };
    } | null;
  } | null;
};

const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-sage-soft text-green",
  booked: "bg-amber-soft text-amber",
  completed: "bg-line text-ink-muted",
  cancelled: "bg-danger/10 text-danger",
  no_show: "bg-danger/10 text-danger",
};

function formatWindow(start: string, end: string) {
  const fmt = (s: string) =>
    new Date(s).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff > 0 && diff < 86_400_000) return "Tomorrow";
  return d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
}

function formatKobo(kobo: number, unit: string) {
  return `₦${(kobo / 100).toLocaleString("en-NG")}/${unit}`;
}

function tabOf(b: Booking): Tab {
  if (b.status === "cancelled" || b.status === "no_show") return "cancelled";
  if (b.status === "completed") return "past";
  return "upcoming";
}

const CROPS = [
  { src: "/images/step-scale.jpg", pos: "object-[50%_40%]", cls: "absolute top-4 right-8 size-14 hidden sm:block" },
  { src: "/images/step-buyer.jpg", pos: "object-[85%_30%]", cls: "absolute bottom-4 right-4 size-12" },
];

export default function BookingsPage() {
  const [tab, setTab] = useState<Tab>("upcoming");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = await getAuth(app).currentUser?.getIdToken();
        const res = await fetch("/api/bookings", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as Booking[];
        if (!cancelled) setBookings(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setError("Couldn't load bookings. Please refresh.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const items = bookings.filter((b) => tabOf(b) === tab);
  const upcoming = bookings.filter((b) => tabOf(b) === "upcoming");
  const confirmed = upcoming.filter((b) => b.status === "confirmed");

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-6 lg:px-8">

      {/* Hero */}
      <div
        data-rhythm="field"
        className="relative isolate mb-8 overflow-hidden rounded-2xl bg-field px-6 py-10 text-paper lg:px-10 lg:py-12"
      >
        <LogoVideo />
        {CROPS.map((c, i) => (
          <div key={i} aria-hidden className={cn("overflow-hidden rounded-full", c.cls)}>
            <img src={c.src} alt="" className={cn("size-full object-cover", c.pos)} />
          </div>
        ))}

        <p className="text-label font-medium text-sage/70">My Activity</p>
        <h1 className="mt-2 font-display text-display-lg-sm font-medium text-paper md:text-[2rem]">
          My Bookings
        </h1>

        {!loading && (
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="flex flex-col rounded-[16px_4px_16px_4px] bg-sage/20 px-4 py-3">
              <span className="text-label text-sage/70">Confirmed</span>
              <span className="font-num text-number-lg font-medium text-paper">{confirmed.length}</span>
            </div>
            <div className="flex flex-col rounded-[4px_16px_4px_16px] bg-field-soft/70 px-4 py-3">
              <span className="text-label text-paper/50">Upcoming</span>
              <span className="font-num text-number-lg font-medium text-paper/80">{upcoming.length}</span>
            </div>
            <div className="flex flex-col rounded-[16px_4px_16px_4px] bg-amber/20 px-4 py-3">
              <span className="text-label text-amber/70">Total</span>
              <span className="font-num text-number-lg font-medium text-amber">{bookings.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Reveal effect="riseIn">
        <div className="mb-6 flex w-fit gap-1 rounded-xl border border-line bg-white p-1">
          {(["upcoming", "past", "cancelled"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-lg px-4 py-2 text-body-sm font-medium capitalize transition-all duration-150",
                tab === t ? "bg-sage-soft text-green shadow-sm" : "text-ink-muted hover:text-ink",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </Reveal>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-ink-muted" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-6 text-center text-danger">{error}</div>
      ) : items.length === 0 ? (
        <Reveal effect="riseIn">
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-field px-8 py-16 text-center text-paper">
            <Calendar strokeWidth={1} className="size-10 text-sage/40" />
            <p className="font-display text-title font-medium text-paper">No {tab} bookings</p>
            <p className="text-body text-paper/60">Browse the marketplace to find buyers near you.</p>
            <Link href="/dashboard/marketplace" className="mt-2 rounded-full bg-paper px-5 py-2.5 text-body-sm font-medium text-field hover:bg-sage-soft">
              Go to marketplace →
            </Link>
          </div>
        </Reveal>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((booking) => {
            const listing = booking.slot?.listing;
            const commodity = listing?.commodity?.name ?? "Produce";
            const unit = listing?.commodity?.unit ?? "unit";
            const buyerName = listing?.buyer?.name ?? "Buyer";
            const location = listing?.location_area ?? "—";
            const date = booking.slot?.date ? formatDate(booking.slot.date) : "—";
            const window =
              booking.slot?.window_start && booking.slot?.window_end
                ? formatWindow(booking.slot.window_start, booking.slot.window_end)
                : "—";
            const priceStr = listing?.unit_price_kobo ? formatKobo(listing.unit_price_kobo, unit) : "—";
            const status = booking.status as Status;

            return (
              <Reveal key={booking.id} effect="riseIn" config={{ stagger: 0 }}>
                <div className="group relative overflow-hidden rounded-xl border border-line bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex size-9 items-center justify-center rounded-lg bg-sage-soft">
                        <Store strokeWidth={1.5} className="size-4 text-green" />
                      </div>
                      <div>
                        <p className="font-medium text-ink">{commodity}</p>
                        <p className="text-body-sm text-ink-muted">with {buyerName}</p>
                      </div>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-label font-medium capitalize", STATUS_STYLE[status] ?? "bg-line text-ink-muted")}>
                      {status}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <p className="text-label text-ink-muted">Quantity</p>
                      <p className="font-num text-body-sm font-medium text-ink">{booking.qty} {unit}</p>
                    </div>
                    <div>
                      <p className="text-label text-ink-muted">Price</p>
                      <p className="font-num text-body-sm font-medium text-amber">{priceStr}</p>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <Clock strokeWidth={1.5} className="mt-0.5 size-3.5 shrink-0 text-ink-muted" />
                      <div>
                        <p className="text-label text-ink-muted">Date & Time</p>
                        <p className="text-body-sm text-ink">{date} · {window}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <MapPin strokeWidth={1.5} className="mt-0.5 size-3.5 shrink-0 text-ink-muted" />
                      <div>
                        <p className="text-label text-ink-muted">Location</p>
                        <p className="text-body-sm text-ink">{location}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                    <span className="font-num text-label text-ink-muted">{booking.code}</span>
                    {tab === "upcoming" && (
                      <div className="flex gap-2">
                        <button className="rounded-lg bg-sage-soft px-3 py-1.5 text-label font-medium text-green hover:bg-sage-soft/80">
                          View details
                        </button>
                        <button className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-label font-medium text-ink-muted hover:bg-danger/10 hover:text-danger">
                          <X strokeWidth={2} className="size-3" /> Cancel
                        </button>
                      </div>
                    )}
                    {status === "completed" && (
                      <span className="flex items-center gap-1.5 text-label text-success">
                        <CheckCircle2 strokeWidth={2} className="size-3.5" /> Completed
                      </span>
                    )}
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      )}
    </div>
  );
}
