"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Calendar, Clock, MapPin, X, CheckCircle2, Store } from "lucide-react";
import Link from "next/link";

import { LogoVideo } from "@/components/dashboard/logo-video";
import { LiveBookings } from "@/components/board/live-bookings";
import { Reveal } from "@/components/motion/reveal";
import { fx, playOnEnter, useGSAP } from "@/lib/gsap/effects";
import { cn } from "@/lib/utils";

type Status = "confirmed" | "booked" | "cancelled" | "completed";
type Tab = "upcoming" | "past" | "cancelled";

const ALL_BOOKINGS = [
  { id: "1", code: "LM-4821", commodity: "Live Broilers", counterparty: "Rayfield Restaurant", qty: "30 birds", price: "₦3,500/kg", date: "Tomorrow", time: "7:00–11:00am", location: "Rayfield, Jos", status: "confirmed" as Status, tab: "upcoming" as Tab },
  { id: "2", code: "LM-4839", commodity: "Tomatoes", counterparty: "Barkin Ladi Produce", qty: "15 baskets", price: "₦850/basket", date: "Thu, Nov 7", time: "6:00–10:00am", location: "Terminus Market", status: "booked" as Status, tab: "upcoming" as Tab },
  { id: "3", code: "LM-4851", commodity: "Live Turkey", counterparty: "Grand Hotel Jos", qty: "8 birds", price: "₦4,200/kg", date: "Fri, Nov 8", time: "8:00–12:00pm", location: "Rayfield, Jos", status: "confirmed" as Status, tab: "upcoming" as Tab },
  { id: "4", code: "LM-4802", commodity: "Eggs", counterparty: "Bukuru Bakery", qty: "20 crates", price: "₦2,100/crate", date: "Mon, Nov 4", time: "7:00–9:00am", location: "Bukuru", status: "completed" as Status, tab: "past" as Tab },
  { id: "5", code: "LM-4790", commodity: "Live Broilers", counterparty: "Farin Gada Hotel", qty: "50 birds", price: "₦3,650/kg", date: "Sat, Nov 2", time: "6:00–10:00am", location: "Farin Gada", status: "completed" as Status, tab: "past" as Tab },
  { id: "6", code: "LM-4771", commodity: "Tomatoes", counterparty: "Caterer D", qty: "10 baskets", price: "₦800/basket", date: "Fri, Nov 1", time: "6:00–8:00am", location: "Angwan Rukuba", status: "cancelled" as Status, tab: "cancelled" as Tab },
];

const STATUS_STYLE: Record<Status, string> = {
  confirmed: "bg-sage-soft text-green",
  booked: "bg-amber-soft text-amber",
  completed: "bg-line text-ink-muted",
  cancelled: "bg-danger/10 text-danger",
};

const CROPS = [
  { src: "/images/step-scale.jpg", pos: "object-[50%_40%]", cls: "absolute top-4 right-8 size-14 hidden sm:block" },
  { src: "/images/step-buyer.jpg", pos: "object-[85%_30%]", cls: "absolute bottom-4 right-4 size-12" },
];

export default function BookingsPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>("upcoming");

  const items = ALL_BOOKINGS.filter((b) => b.tab === tab);

  useGSAP(
    () => {
      const root = heroRef.current;
      if (!root) return;
      playOnEnter(fx("chipPop", root.querySelectorAll("[data-chip]"), { stagger: 0.1 }), root, "top 85%");
      fx("floatDrift", root.querySelectorAll("[data-crop]"));
    },
    { scope: heroRef },
  );

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-6 lg:px-8">

      {/* Hero */}
      <div
        ref={heroRef}
        data-rhythm="field"
        className="relative isolate mb-8 overflow-hidden rounded-2xl bg-field px-6 py-10 text-paper lg:px-10 lg:py-12"
      >
        <LogoVideo />
        {CROPS.map((c, i) => (
          <div key={i} data-crop aria-hidden className={cn("overflow-hidden rounded-full", c.cls)}>
            <Image src={c.src} alt="" width={140} height={140} className={cn("size-full object-cover", c.pos)} />
          </div>
        ))}

        <p className="text-label font-medium text-sage/70">My Activity</p>
        <h1 className="mt-2 font-display text-display-lg-sm font-medium text-paper md:text-[2rem]">
          My Bookings
        </h1>

        {/* Stats chips */}
        <div className="mt-6 flex flex-wrap gap-3">
          {[
            { label: "Confirmed", value: "3", style: "bg-sage/20 text-paper" },
            { label: "Pending", value: "2", style: "bg-field-soft/70 text-paper/80" },
            { label: "Total value", value: "₦1.2M", style: "bg-amber/20 text-amber" },
          ].map((s) => (
            <div
              key={s.label}
              data-chip
              className={cn("flex flex-col rounded-[16px_4px_16px_4px] px-4 py-3", s.style)}
            >
              <span className="text-label opacity-70">{s.label}</span>
              <span className="font-num text-number-lg font-medium">{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Real bookings, each opening its own page. Renders nothing when there are none. */}
      <div className="mb-8">
        <LiveBookings />
      </div>

      {/* Tabs */}
      <Reveal effect="riseIn">
        <div className="mb-6 flex gap-1 rounded-xl border border-line bg-white p-1 w-fit">
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

      {/* Booking cards */}
      {items.length === 0 ? (
        <Reveal effect="riseIn">
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-field px-8 py-16 text-center text-paper">
            <div aria-hidden className="flex flex-col gap-3 w-full items-center opacity-20">
              <span className="h-px w-48 bg-sage" />
              <span className="h-px w-32 bg-sage" />
              <span className="h-px w-20 bg-sage" />
            </div>
            <Calendar strokeWidth={1} className="size-10 text-sage/40 -mt-2" />
            <p className="font-display text-title font-medium text-paper">No {tab} bookings</p>
            <p className="text-body text-paper/60">Browse the marketplace to find buyers near you.</p>
            <Link href="/dashboard/marketplace" className="mt-2 rounded-full bg-paper px-5 py-2.5 text-body-sm font-medium text-field hover:bg-sage-soft">
              Go to marketplace →
            </Link>
          </div>
        </Reveal>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((booking, i) => (
            <Reveal key={booking.id} effect="riseIn" config={{ stagger: 0 }}>
              <div
                className={cn(
                  "group relative overflow-hidden rounded-xl border border-line bg-white p-5 shadow-sm transition-shadow hover:shadow-md",
                  i % 3 === 0 && "rotate-[-0.2deg] hover:rotate-0",
                  i % 3 === 1 && "rotate-[0.15deg] hover:rotate-0",
                  "transition-transform duration-300",
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-9 items-center justify-center rounded-lg bg-sage-soft">
                      <Store strokeWidth={1.5} className="size-4 text-green" />
                    </div>
                    <div>
                      <p className="font-medium text-ink">{booking.commodity}</p>
                      <p className="text-body-sm text-ink-muted">with {booking.counterparty}</p>
                    </div>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-label font-medium capitalize", STATUS_STYLE[booking.status])}>
                    {booking.status}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-label text-ink-muted">Quantity</p>
                    <p className="font-num text-body-sm font-medium text-ink">{booking.qty}</p>
                  </div>
                  <div>
                    <p className="text-label text-ink-muted">Price</p>
                    <p className="font-num text-body-sm font-medium text-amber">{booking.price}</p>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Clock strokeWidth={1.5} className="mt-0.5 size-3.5 shrink-0 text-ink-muted" />
                    <div>
                      <p className="text-label text-ink-muted">Date & Time</p>
                      <p className="text-body-sm text-ink">{booking.date} · {booking.time}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <MapPin strokeWidth={1.5} className="mt-0.5 size-3.5 shrink-0 text-ink-muted" />
                    <div>
                      <p className="text-label text-ink-muted">Location</p>
                      <p className="text-body-sm text-ink">{booking.location}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                  <span className="font-num text-label text-ink-muted">{booking.code}</span>
                  {booking.tab === "upcoming" && (
                    <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <button className="rounded-lg bg-sage-soft px-3 py-1.5 text-label font-medium text-green hover:bg-sage-soft/80">
                        View details
                      </button>
                      <button className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-label font-medium text-ink-muted hover:bg-danger/10 hover:text-danger">
                        <X strokeWidth={2} className="size-3" /> Cancel
                      </button>
                    </div>
                  )}
                  {booking.status === "completed" && (
                    <span className="flex items-center gap-1.5 text-label text-success">
                      <CheckCircle2 strokeWidth={2} className="size-3.5" /> Completed
                    </span>
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
