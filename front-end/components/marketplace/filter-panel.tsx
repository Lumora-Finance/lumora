"use client";

import { Check, X } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useDrawer } from "@/lib/gsap/use-drawer";
import { cn } from "@/lib/utils";

export type FilterState = {
  commodity: string;
  area: string;
  type: "all" | "demand" | "listing";
  sort: "newest" | "price-high" | "price-low";
};

const COMMODITIES = ["All", "Live Broilers", "Tomatoes", "Eggs", "Live Turkey"];
const RESET: FilterState = { commodity: "All", area: "All areas", type: "all", sort: "newest" };

/** The same selected look as the Post demand form. */
function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-body-sm font-medium transition-[background-color,border-color,color,transform] duration-200 ease-out [-webkit-tap-highlight-color:transparent] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
        selected ? "border-field bg-field text-paper" : "border-line bg-white text-ink hover:border-sage",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex shrink-0 justify-center overflow-hidden text-[#9BD27A] transition-[width,margin,opacity] duration-200 ease-out motion-reduce:transition-none",
          selected ? "mr-1.5 w-3.5 opacity-100" : "mr-0 w-0 opacity-0",
        )}
      >
        <Check strokeWidth={3} className="size-3.5 shrink-0" />
      </span>
      {children}
    </button>
  );
}

const LABEL = "mb-2.5 font-num text-[11px] leading-4 tracking-[0.08em] text-ink-muted uppercase";

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
  // Each opening starts from what's applied, not from choices abandoned last time.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setLocal(filters);
  }
  const backdrop = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const drawer = useDrawer({ open, onClose, items: "[data-filter-group]", backdrop, panel });

  if (!drawer.shown) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        ref={backdrop}
        aria-hidden="true"
        className="absolute inset-0 bg-field/60 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="filters-title"
        tabIndex={-1}
        {...drawer.swipe}
        className="absolute top-0 left-0 flex h-full w-[min(24rem,88vw)] touch-pan-y flex-col rounded-r-[24px] bg-paper outline-none will-change-transform"
      >
        <div className="flex shrink-0 items-center justify-between px-5 pt-5 pb-3">
          <h2 id="filters-title" className="font-display text-[24px] leading-[1.2] font-medium text-ink">
            Filters
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="flex size-11 items-center justify-center rounded-full text-ink transition-colors duration-150 hover:bg-sage-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <X aria-hidden="true" strokeWidth={1.75} className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 pt-2 pb-6">
          <fieldset data-filter-group>
            <legend className={LABEL}>Show me</legend>
            <div className="flex flex-wrap gap-2">
              {([
                { key: "all", label: "Everything" },
                { key: "demand", label: "Demand" },
                { key: "listing", label: "Listings" },
              ] as const).map((option) => (
                <Chip key={option.key} selected={local.type === option.key} onClick={() => setLocal({ ...local, type: option.key })}>
                  {option.label}
                </Chip>
              ))}
            </div>
          </fieldset>

          <fieldset data-filter-group>
            <legend className={LABEL}>Produce</legend>
            <div className="flex flex-wrap gap-2">
              {COMMODITIES.map((commodity) => (
                <Chip key={commodity} selected={local.commodity === commodity} onClick={() => setLocal({ ...local, commodity })}>
                  {commodity}
                </Chip>
              ))}
            </div>
          </fieldset>

          <fieldset data-filter-group>
            <legend className={LABEL}>Location</legend>
            <div className="flex flex-wrap gap-2">
              {AREAS.map((area) => (
                <Chip key={area} selected={local.area === area} onClick={() => setLocal({ ...local, area })}>
                  {area}
                </Chip>
              ))}
            </div>
          </fieldset>

          <fieldset data-filter-group>
            <legend className={LABEL}>Sort by</legend>
            <div className="flex flex-wrap gap-2">
              {([
                { key: "newest", label: "Newest" },
                { key: "price-high", label: "Highest price" },
                { key: "price-low", label: "Lowest price" },
              ] as const).map((option) => (
                <Chip key={option.key} selected={local.sort === option.key} onClick={() => setLocal({ ...local, sort: option.key })}>
                  {option.label}
                </Chip>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex shrink-0 gap-3 border-t border-line px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => {
              setLocal(RESET);
              onApply(RESET);
            }}
            className="h-[52px] rounded-2xl px-5 font-medium text-ink transition-colors duration-150 hover:bg-sage-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(local);
              onClose();
            }}
            className="h-[52px] flex-1 rounded-2xl bg-green font-medium text-paper transition-[background-color,transform] duration-150 hover:bg-green-hover focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98] motion-reduce:active:scale-100"
          >
            Apply filters
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
