"use client";

import { ArrowRight, Loader2, MapPin, Zap } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useDashboardData } from "@/lib/hooks/use-dashboard-data";

type Slot = {
  id: string;
  date: string;
  capacity_remaining: number;
  capacity_total: number;
  listing: {
    id: string;
    spec: string;
    unit_price_kobo: number;
    location_area: string | null;
    status: string;
    commodity: { name: string; unit: string };
    buyer: { id: string; name: string };
  } | null;
};

function formatKobo(kobo: number, unit: string) {
  return `₦${(kobo / 100).toLocaleString("en-NG")}/${unit}`;
}

/** Board response shape from /api/board. */
type BoardResponse = {
  cards: Slot[];
  area: string | null;
  stock: Record<string, number>;
  follows: string[];
};

export function BoardPreview() {
  const { data, loading } = useDashboardData<BoardResponse>("board");
  const slots = data?.cards ?? [];

  return (
    <div className="rounded-xl border border-line bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h2 className="text-heading font-medium text-ink">Near You</h2>
          <p className="mt-0.5 text-body-sm text-ink-muted">Top matches from the marketplace</p>
        </div>
        <Link
          href="/dashboard/marketplace"
          className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-body-sm font-medium text-ink-muted transition-colors hover:border-green hover:text-green"
        >
          All listings
          <ArrowRight strokeWidth={1.5} className="size-3.5" />
        </Link>
      </div>

      {/* Items */}
      <div className="flex flex-col gap-3 p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-ink-muted" />
          </div>
        ) : slots.length === 0 ? (
          <p className="py-6 text-center text-body-sm text-ink-muted">No open slots right now.</p>
        ) : (
          slots.map((slot, i) => {
            const listing = slot.listing;
            if (!listing) return null;
            const highlight = i === 0;
            const unit = listing.commodity?.unit ?? "unit";
            const priceStr = formatKobo(listing.unit_price_kobo, unit);
            const price = `₦${(listing.unit_price_kobo / 100).toLocaleString("en-NG")}`;
            const unitLabel = `/${unit}`;

            return (
              <div
                key={slot.id}
                className={cn(
                  "group relative flex items-start gap-4 rounded-lg border px-5 py-4 transition-all hover:shadow-md",
                  highlight ? "border-amber/30 bg-amber-soft/30" : "border-line bg-paper",
                )}
              >
                {highlight && (
                  <span className="absolute left-0 top-0 h-full w-0.5 rounded-r-full bg-amber" />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="shrink-0 rounded-md bg-green/10 px-2 py-0.5 font-num text-label font-medium text-green">
                        DEMAND
                      </span>
                      <p className="font-medium text-ink">{listing.commodity?.name}</p>
                      {highlight && (
                        <Zap strokeWidth={2} className="size-3.5 shrink-0 text-amber" fill="currentColor" />
                      )}
                    </div>
                    <p className="shrink-0 font-num text-number font-medium text-amber">
                      {price}
                      <span className="font-sans text-body-sm text-ink-muted">{unitLabel}</span>
                    </p>
                  </div>

                  <p className="mt-0.5 text-body-sm text-ink-muted">{listing.buyer?.name}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1 text-body-sm text-ink-muted">
                      <MapPin strokeWidth={1.5} className="size-3.5 shrink-0" />
                      {listing.location_area ?? "—"}
                    </span>
                    <span className="font-num text-body-sm text-ink-muted">
                      {slot.capacity_remaining} of {slot.capacity_total} {unit} left
                    </span>
                  </div>

                  <div className="mt-3 sm:hidden">
                    <button className="rounded-lg bg-green px-3.5 py-2 text-body-sm font-medium text-paper hover:bg-green-hover">
                      Book
                    </button>
                  </div>
                </div>

                <button className="hidden shrink-0 self-center rounded-lg bg-green px-3.5 py-2 text-body-sm font-medium text-paper opacity-0 transition-all duration-150 group-hover:opacity-100 hover:bg-green-hover sm:flex">
                  Book
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-line px-5 py-3">
        <Link href="/dashboard/marketplace" className="text-body-sm font-medium text-green hover:underline">
          See full marketplace →
        </Link>
      </div>
    </div>
  );
}
