"use client";

import { Calendar, Clock, Loader2, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardData } from "@/lib/hooks/use-dashboard-data";

type Booking = {
  id: string;
  code: string;
  qty: number;
  status: string;
  created_at: string;
  slot: {
    id: string;
    date: string;
    window_start: string;
    window_end: string;
    listing: {
      id: string;
      spec: string;
      unit_price_kobo: number;
      location_area: string | null;
      commodity: { id: string; name: string; unit: string };
      buyer: { id: string; name: string };
    } | null;
  } | null;
};

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-sage-soft text-green",
  booked: "bg-amber-soft text-amber",
  pending: "bg-line text-ink-muted",
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
  if (diff < 86_400_000 && diff > 0) return "Tomorrow";
  return d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
}

function formatKobo(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`;
}

export function UpcomingBookings() {
  const { data, loading } = useDashboardData<Booking[]>("bookings");
  const bookings = data ?? [];

  return (
    <div className="rounded-xl border border-line bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h2 className="text-heading font-medium text-ink">Upcoming Bookings</h2>
          <p className="mt-0.5 text-body-sm text-ink-muted">Next deliveries and collections</p>
        </div>
        {!loading && (
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-green px-2 font-num text-label font-medium text-paper">
            {bookings.length}
          </span>
        )}
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-3 p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-ink-muted" />
          </div>
        ) : bookings.length === 0 ? (
          <p className="py-6 text-center text-body-sm text-ink-muted">No upcoming bookings.</p>
        ) : (
          bookings.map((booking) => {
            const listing = booking.slot?.listing;
            const commodity = listing?.commodity?.name ?? "Produce";
            const buyerName = listing?.buyer?.name ?? "Buyer";
            const location = listing?.location_area ?? "—";
            const unit = listing?.commodity?.unit ?? "unit";
            const priceKobo = listing?.unit_price_kobo ?? 0;
            const date = booking.slot?.date ? formatDate(booking.slot.date) : "—";
            const window =
              booking.slot?.window_start && booking.slot?.window_end
                ? formatWindow(booking.slot.window_start, booking.slot.window_end)
                : "—";
            const status = (booking.status as keyof typeof STATUS_STYLES) ?? "pending";

            return (
              <div
                key={booking.id}
                className="group relative flex gap-4 rounded-lg border border-line bg-paper px-5 py-4 transition-all hover:shadow-md"
              >
                <div className="flex shrink-0 flex-col items-center justify-start pt-0.5">
                  <Calendar strokeWidth={1.5} className="size-4 text-ink-muted" />
                  <div className="mt-1.5 h-full w-px bg-line" />
                </div>

                <div className="min-w-0 flex-1 pb-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{commodity}</p>
                      <p className="text-body-sm text-ink-muted">with {buyerName}</p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-0.5 font-num text-label font-medium capitalize",
                        STATUS_STYLES[status] ?? "bg-line text-ink-muted",
                      )}
                    >
                      {status}
                    </span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    <span className="flex items-center gap-1.5 text-body-sm text-ink-muted">
                      <Clock strokeWidth={1.5} className="size-3.5 shrink-0" />
                      {date} · {window}
                    </span>
                    <span className="flex items-center gap-1.5 text-body-sm text-ink-muted">
                      <MapPin strokeWidth={1.5} className="size-3.5 shrink-0" />
                      {location}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-num text-body-sm font-medium text-ink">
                      {booking.qty} {unit}
                    </span>
                    <span className="text-ink-muted">·</span>
                    <span className="font-num text-body-sm font-medium text-amber">
                      {formatKobo(priceKobo)}/{unit}
                    </span>
                    <span className="ml-auto font-num text-label text-ink-muted">{booking.code}</span>
                  </div>

                  <div className="mt-3 flex gap-2 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
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
          })
        )}
      </div>

      <div className="border-t border-line px-5 py-3">
        <a href="/dashboard/bookings" className="text-body-sm font-medium text-green hover:underline">
          View all bookings →
        </a>
      </div>
    </div>
  );
}
