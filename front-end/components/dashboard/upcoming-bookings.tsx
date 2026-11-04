"use client";

import { Calendar, Clock, MapPin, X } from "lucide-react";

import { cn } from "@/lib/utils";

type Booking = {
  id: string;
  code: string;
  commodity: string;
  counterparty: string;
  role: "buyer" | "farmer";
  qty: string;
  price: string;
  date: string;
  time: string;
  location: string;
  status: "confirmed" | "booked" | "pending";
};

const BOOKINGS: Booking[] = [
  {
    id: "1",
    code: "LM-4821",
    commodity: "Live Broilers",
    counterparty: "Amina Farms, Bukuru",
    role: "buyer",
    qty: "30 birds",
    price: "₦3,500/kg",
    date: "Tomorrow",
    time: "7:00–11:00am",
    location: "Rayfield, Jos",
    status: "confirmed",
  },
  {
    id: "2",
    code: "LM-4839",
    commodity: "Tomatoes",
    counterparty: "Barkin Ladi Produce",
    role: "buyer",
    qty: "15 baskets",
    price: "₦850/basket",
    date: "Thu, Nov 7",
    time: "6:00–10:00am",
    location: "Terminus Market, Jos",
    status: "confirmed",
  },
  {
    id: "3",
    code: "LM-4851",
    commodity: "Live Turkey",
    counterparty: "Grand Hotel Jos",
    role: "farmer",
    qty: "8 birds",
    price: "₦4,200/kg",
    date: "Fri, Nov 8",
    time: "8:00–12:00pm",
    location: "Rayfield, Jos",
    status: "booked",
  },
];

const STATUS_STYLES: Record<Booking["status"], string> = {
  confirmed: "bg-sage-soft text-green",
  booked: "bg-amber-soft text-amber",
  pending: "bg-line text-ink-muted",
};

export function UpcomingBookings() {
  return (
    <div className="rounded-xl border border-line bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h2 className="text-heading font-medium text-ink">Upcoming Bookings</h2>
          <p className="mt-0.5 text-body-sm text-ink-muted">Next deliveries and collections</p>
        </div>
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-green px-2 font-num text-label font-medium text-paper">
          {BOOKINGS.length}
        </span>
      </div>

      {/* Booking cards */}
      <div className="flex flex-col gap-3 p-4">
        {BOOKINGS.map((booking, index) => {
          // Shape 5: arrow-cut cards, alternating left/right notch
          const isLeft = index % 2 === 0;
          const clipPath = isLeft
            ? "polygon(0 0, 100% 0, 100% 100%, 12px 100%, 0 calc(100% - 12px))"
            : "polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%)";

          return (
          <div
            key={booking.id}
            className="group relative flex gap-4 bg-paper px-5 py-4 transition-all hover:shadow-md hover:-translate-y-px"
            style={{ clipPath }}
          >
            {/* Left: date pill */}
            <div className="flex shrink-0 flex-col items-center justify-start pt-0.5">
              <Calendar strokeWidth={1.5} className="size-4 text-ink-muted" />
              <div className="mt-1.5 h-full w-px bg-line" />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{booking.commodity}</p>
                  <p className="text-body-sm text-ink-muted">
                    with {booking.counterparty}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 font-num text-label font-medium capitalize",
                    STATUS_STYLES[booking.status],
                  )}
                >
                  {booking.status}
                </span>
              </div>

              {/* Meta row */}
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <span className="flex items-center gap-1.5 text-body-sm text-ink-muted">
                  <Clock strokeWidth={1.5} className="size-3.5 shrink-0" />
                  {booking.date} · {booking.time}
                </span>
                <span className="flex items-center gap-1.5 text-body-sm text-ink-muted">
                  <MapPin strokeWidth={1.5} className="size-3.5 shrink-0" />
                  {booking.location}
                </span>
              </div>

              {/* Qty + price + code */}
              <div className="mt-2 flex items-center gap-3">
                <span className="font-num text-body-sm font-medium text-ink">
                  {booking.qty}
                </span>
                <span className="text-ink-muted">·</span>
                <span className="font-num text-body-sm font-medium text-amber">
                  {booking.price}
                </span>
                <span className="ml-auto font-num text-label text-ink-muted">
                  {booking.code}
                </span>
              </div>

              {/* Actions */}
              <div className="mt-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <button className="rounded-md bg-sage-soft px-3 py-1.5 text-label font-medium text-green hover:bg-sage-soft/80">
                  View details
                </button>
                <button className="flex items-center gap-1 rounded-md px-3 py-1.5 text-label font-medium text-ink-muted hover:bg-danger/10 hover:text-danger">
                  <X strokeWidth={2} className="size-3" /> Cancel
                </button>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-line px-5 py-3">
        <button className="text-body-sm font-medium text-green hover:underline">
          View all bookings →
        </button>
      </div>
    </div>
  );
}
