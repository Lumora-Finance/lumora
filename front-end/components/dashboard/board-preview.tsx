"use client";

import { ArrowRight, MapPin, Zap } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type BoardItem = {
  id: string;
  type: "DEMAND" | "LISTING";
  commodity: string;
  org: string;
  price: string;
  unit: string;
  capacity: string;
  location: string;
  distance: string;
  highlight?: boolean;
};

const ITEMS: BoardItem[] = [
  {
    id: "1",
    type: "DEMAND",
    commodity: "Live Broilers",
    org: "Rayfield Restaurant",
    price: "₦3,800",
    unit: "/kg",
    capacity: "40 birds left",
    location: "Rayfield, Jos",
    distance: "3.2 km",
    highlight: true,
  },
  {
    id: "2",
    type: "LISTING",
    commodity: "Tomatoes",
    org: "Barkin Ladi Farm",
    price: "₦780",
    unit: "/basket",
    capacity: "60 baskets",
    location: "Barkin Ladi",
    distance: "8.7 km",
  },
  {
    id: "3",
    type: "DEMAND",
    commodity: "Live Broilers",
    org: "Grand Hotel Jos",
    price: "₦3,650",
    unit: "/kg",
    capacity: "25 birds left",
    location: "GRA, Jos",
    distance: "5.1 km",
  },
];

export function BoardPreview() {
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
        {ITEMS.map((item, index) => {
          // Shape 6: skewed parallelogram-ish via clip-path
          const isHighlight = item.highlight;
          const clipPath = isHighlight
            ? "polygon(16px 0, 100% 0, calc(100% - 16px) 100%, 0 100%)"
            : "polygon(0 0, 100% 0, 100% 100%, 0 100%)";

          return (
          <div
            key={item.id}
            className={cn(
              "group relative flex items-start gap-4 px-5 py-4 transition-all hover:shadow-md hover:-translate-y-px",
              item.highlight && "bg-amber-soft/40",
              !item.highlight && "bg-paper",
            )}
            style={{ clipPath }}
          >
            {/* Highest bid indicator */}
            {item.highlight && (
              <span className="absolute left-0 top-0 h-full w-0.5 rounded-r-full bg-amber" />
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-2 py-0.5 font-num text-label font-medium",
                      item.type === "DEMAND"
                        ? "bg-green/10 text-green"
                        : "bg-amber-soft text-amber",
                    )}
                  >
                    {item.type}
                  </span>
                  <p className="font-medium text-ink">{item.commodity}</p>
                  {item.highlight && (
                    <Zap
                      strokeWidth={2}
                      className="size-3.5 shrink-0 text-amber"
                      fill="currentColor"
                    />
                  )}
                </div>

                <p className="shrink-0 font-num text-number font-medium text-amber">
                  {item.price}
                  <span className="font-sans text-body-sm text-ink-muted">{item.unit}</span>
                </p>
              </div>

              <p className="mt-0.5 text-body-sm text-ink-muted">{item.org}</p>

              <div className="mt-2 flex items-center gap-4">
                <span className="flex items-center gap-1 text-body-sm text-ink-muted">
                  <MapPin strokeWidth={1.5} className="size-3.5 shrink-0" />
                  {item.location} · {item.distance}
                </span>
                <span className="font-num text-body-sm text-ink-muted">{item.capacity}</span>
              </div>
            </div>

            {/* CTA */}
            <button className="shrink-0 self-center rounded-lg bg-green px-3.5 py-2 text-body-sm font-medium text-paper opacity-0 transition-all duration-150 group-hover:opacity-100 hover:bg-green-hover">
              Book
            </button>
          </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-line px-5 py-3">
        <Link
          href="/dashboard/marketplace"
          className="text-body-sm font-medium text-green hover:underline"
        >
          See full marketplace →
        </Link>
      </div>
    </div>
  );
}
