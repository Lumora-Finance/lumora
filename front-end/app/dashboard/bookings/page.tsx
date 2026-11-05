"use client";

import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import Link from "next/link";
import { getAuth } from "firebase/auth";

import app from "@/lib/firebase/config";
import { type LiveBooking, LiveBookings } from "@/components/board/live-bookings";
import { LogoVideo } from "@/components/dashboard/logo-video";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";
import { CardsSkeleton } from "@/components/loader/skeletons";
import { trackTask } from "@/lib/loading/progress";

type Tab = "upcoming" | "past" | "cancelled";

type Booking = LiveBooking;

function tabOf(b: Booking): Tab {
  if (["cancelled", "no_show", "released", "declined"].includes(b.status)) return "cancelled";
  if (b.status === "settled") return "past";
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
      const finished = trackTask("bookings");
      setError(null);
      try {
        const auth = getAuth(app);
        // On a fresh load the saved session isn't back yet, and asking now would look signed out.
        await auth.authStateReady();
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch("/api/bookings", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as Booking[];
        if (!cancelled) setBookings(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setError("Couldn't load bookings. Please refresh.");
      } finally {
        finished();
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
        <CardsSkeleton label="Loading your bookings" />
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
        <LiveBookings bookings={items} />
      )}
    </div>
  );
}
