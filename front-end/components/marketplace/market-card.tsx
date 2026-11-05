"use client";

import { MapPin, Clock, ArrowRight, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { MarketItem } from "@/lib/demo/market";

export function MarketCard({
  item,
  onOffer,
}: {
  item: MarketItem;
  onOffer?: (item: MarketItem) => void;
}) {
  const isDemand = item.type === "demand";
  const pct = item.capacity === 0 ? 0 : Math.round((item.remaining / item.capacity) * 100);

  return (
    <Link
      href={`/dashboard/marketplace/${item.id}`}
      className="group block overflow-hidden bg-white shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
      style={{
        clipPath: isDemand
          ? "polygon(0 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%)"
          : "polygon(16px 0, 100% 0, 100% 100%, 0 100%, 0 16px)",
      }}
    >
      {/* Image */}
      <div className="relative h-40 overflow-hidden bg-field-soft">
        {item.image && (
          <Image
            src={item.image}
            alt={item.commodity}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 350px"
          />
        )}
        {/* Gradient overlay */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-field/80 via-transparent to-transparent" />

        {/* Type badge */}
        <span
          className={cn(
            "absolute left-3 top-3 rounded-full px-2.5 py-1 font-num text-label font-medium backdrop-blur-sm",
            isDemand
              ? "bg-green/90 text-paper"
              : "bg-amber/90 text-ink",
          )}
        >
          {isDemand ? "📣 DEMAND" : "🌾 LISTING"}
        </span>

        {/* Price on image */}
        <div className="absolute bottom-3 left-3">
          <span className="font-num text-number-lg font-medium text-paper drop-shadow-lg">
            ₦{item.price.toLocaleString()}
            <span className="font-sans text-body-sm text-paper/80">/{item.priceUnit}</span>
          </span>
        </div>

        {/* Highest bid badge for demand */}
        {isDemand && item.remaining > 0 && (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-amber px-2 py-1 font-num text-label font-medium text-ink">
            <Zap strokeWidth={2} className="size-3" fill="currentColor" />
            Active
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-medium text-ink">{item.commodity}</h3>
            <p className="truncate text-body-sm text-ink-muted">{item.spec}</p>
          </div>
          <span className="shrink-0 text-label text-ink-muted">{item.postedAgo}</span>
        </div>

        {/* Poster */}
        <div className="mt-2.5 flex items-center gap-2">
          <div className={cn(
            "flex size-6 items-center justify-center rounded-full font-num text-label font-medium",
            isDemand ? "bg-green/10 text-green" : "bg-amber-soft text-amber",
          )}>
            {item.poster[0]}
          </div>
          <span className="text-body-sm font-medium text-ink">{item.poster}</span>
        </div>

        {/* Meta */}
        <div className="mt-3 flex items-center gap-3 text-body-sm text-ink-muted">
          <span className="flex items-center gap-1">
            <MapPin strokeWidth={1.5} className="size-3.5" />
            {item.area}
          </span>
          <span className="flex items-center gap-1">
            <Clock strokeWidth={1.5} className="size-3.5" />
            {item.day}
          </span>
        </div>

        {/* Capacity bar */}
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
            <div
              className={cn("h-full rounded-full", isDemand ? "bg-green" : "bg-amber")}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="font-num text-label text-ink-muted">
            {item.remaining}/{item.capacity} left
          </span>
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={(e) => {
              e.preventDefault();
              onOffer?.(item);
            }}
            className={cn(
              "flex-1 rounded-lg py-2 text-body-sm font-medium transition-all",
              isDemand
                ? "bg-sage-soft text-green hover:bg-green hover:text-paper"
                : "bg-amber-soft text-amber hover:bg-amber hover:text-ink",
            )}
          >
            Make offer
          </button>
          <button
            onClick={(e) => e.preventDefault()}
            className="flex size-9 items-center justify-center rounded-lg border border-line text-ink-muted transition-colors hover:border-green hover:text-green"
            aria-label="Message"
          >
            <ArrowRight strokeWidth={1.5} className="size-4" />
          </button>
        </div>
      </div>
    </Link>
  );
}
