"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type FilterState = {
  commodity: string;
  area: string;
  type: "all" | "demand" | "listing";
  sort: "newest" | "price-high" | "price-low";
};

const COMMODITIES = ["All", "Live Broilers", "Tomatoes", "Eggs", "Live Turkey"];
const AREAS = ["All areas", "Jos North", "Rayfield", "Bukuru", "Barkin Ladi", "Farin Gada", "Angwan Rukuba", "GRA, Jos"];

export function FilterPanel({
  open,
  onClose,
  filters,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  filters: FilterState;
  onApply: (f: FilterState) => void;
}) {
  const [local, setLocal] = useState(filters);

  useEffect(() => {
    if (open) setLocal(filters);
  }, [open, filters]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-field/60 backdrop-blur-sm"
        style={{ animation: "fade-in 200ms ease-out both" }}
        onClick={onClose}
      />

      {/* Panel — slides from left */}
      <div
        className="absolute left-0 top-0 h-full w-full max-w-sm overflow-y-auto bg-paper shadow-2xl"
        style={{ animation: "slide-in-left 300ms cubic-bezier(0.22,1,0.36,1) both" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal strokeWidth={1.5} className="size-5 text-green" />
            <h2 className="text-heading font-medium text-ink">Filters</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close filters"
            className="flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-sage-soft hover:text-ink"
          >
            <X strokeWidth={1.5} className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-6 p-5">
          {/* Type */}
          <div>
            <p className="mb-3 text-body-sm font-medium text-ink">Show me</p>
            <div className="flex gap-2">
              {([
                { key: "all", label: "Everything" },
                { key: "demand", label: "📣 Demand" },
                { key: "listing", label: "🌾 Listings" },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setLocal({ ...local, type: opt.key })}
                  className={cn(
                    "rounded-full px-3.5 py-2 text-body-sm font-medium transition-all",
                    local.type === opt.key
                      ? "bg-green text-paper"
                      : "border border-line text-ink-muted hover:border-green hover:text-green",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Commodity */}
          <div>
            <p className="mb-3 text-body-sm font-medium text-ink">Commodity</p>
            <div className="flex flex-wrap gap-2">
              {COMMODITIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setLocal({ ...local, commodity: c })}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-body-sm font-medium transition-all",
                    local.commodity === c
                      ? "border-green bg-sage-soft text-green"
                      : "border-line text-ink-muted hover:border-green hover:text-green",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Area */}
          <div>
            <p className="mb-3 text-body-sm font-medium text-ink">Location</p>
            <div className="flex flex-wrap gap-2">
              {AREAS.map((a) => (
                <button
                  key={a}
                  onClick={() => setLocal({ ...local, area: a })}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-body-sm font-medium transition-all",
                    local.area === a
                      ? "border-green bg-sage-soft text-green"
                      : "border-line text-ink-muted hover:border-green hover:text-green",
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <p className="mb-3 text-body-sm font-medium text-ink">Sort by</p>
            <div className="flex flex-col gap-2">
              {[
                { key: "newest", label: "Newest first" },
                { key: "price-high", label: "Highest price" },
                { key: "price-low", label: "Lowest price" },
              ].map((s) => (
                <button
                  key={s.key}
                  onClick={() => setLocal({ ...local, sort: s.key as FilterState["sort"] })}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-body-sm font-medium transition-all",
                    local.sort === s.key
                      ? "bg-sage-soft text-green"
                      : "text-ink-muted hover:bg-sage-soft/50",
                  )}
                >
                  <span className={cn(
                    "flex size-4 items-center justify-center rounded-full border-2",
                    local.sort === s.key ? "border-green" : "border-line",
                  )}>
                    {local.sort === s.key && <span className="size-2 rounded-full bg-green" />}
                  </span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex gap-3 border-t border-line bg-paper px-5 py-4">
          <button
            onClick={() => onApply({ commodity: "All", area: "All areas", type: "all", sort: "newest" })}
            className="rounded-lg border border-line px-4 py-2.5 text-body-sm font-medium text-ink-muted hover:text-ink"
          >
            Reset
          </button>
          <button
            onClick={() => { onApply(local); onClose(); }}
            className="flex-1 rounded-lg bg-green py-2.5 text-body-sm font-medium text-paper hover:bg-green-hover"
          >
            Apply filters
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; } }
        @keyframes slide-in-left { from { transform: translateX(-100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
}
