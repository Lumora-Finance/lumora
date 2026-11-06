"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type CommodityOption = {
  id?: string;
  name: string;
  unit: "kg" | "bag" | "basket" | "crate" | "litre" | "unit" | "dozen" | "tonne" | "bundle" | "bunch" | string;
  /** Earliest window_end for time-sensitive produce, null = no constraint */
  latest: string | null;
  /** Max per crate note to append to spec, null = none */
  crate: number | null;
};

type Category = { label: string; items: CommodityOption[] };

// ---------------------------------------------------------------------------
// Static fallback data — used before the DB fetch resolves or if it fails.
// This is intentionally minimal; the real list comes from /api/commodities.
// ---------------------------------------------------------------------------
export const ALL_COMMODITIES: Category[] = [
  {
    label: "Live poultry",
    items: [
      { name: "Live broilers", unit: "kg", latest: "11:00", crate: 10 },
      { name: "Live Turkey", unit: "kg", latest: "11:00", crate: 10 },
      { name: "Live guinea fowl", unit: "kg", latest: "11:00", crate: null },
      { name: "Live ducks", unit: "kg", latest: "11:00", crate: null },
      { name: "Live geese", unit: "kg", latest: "11:00", crate: null },
      { name: "Day-old chicks", unit: "unit", latest: null, crate: null },
      { name: "Point-of-lay pullets", unit: "unit", latest: null, crate: null },
    ],
  },
  {
    label: "Eggs & dairy",
    items: [
      { name: "Eggs", unit: "crate", latest: null, crate: null },
      { name: "Duck eggs", unit: "crate", latest: null, crate: null },
      { name: "Quail eggs", unit: "crate", latest: null, crate: null },
      { name: "Fresh cow milk", unit: "litre", latest: null, crate: null },
      { name: "Goat milk", unit: "litre", latest: null, crate: null },
      { name: "Wara (fresh cheese)", unit: "kg", latest: null, crate: null },
      { name: "Yoghurt", unit: "litre", latest: null, crate: null },
      { name: "Nono (fermented milk)", unit: "litre", latest: null, crate: null },
    ],
  },
  {
    label: "Live animals",
    items: [
      { name: "Goats", unit: "unit", latest: null, crate: null },
      { name: "Sheep", unit: "unit", latest: null, crate: null },
      { name: "Cattle", unit: "unit", latest: null, crate: null },
      { name: "Pigs", unit: "unit", latest: null, crate: null },
      { name: "Rabbits", unit: "unit", latest: null, crate: null },
      { name: "Catfish (live)", unit: "kg", latest: null, crate: null },
      { name: "Tilapia (live)", unit: "kg", latest: null, crate: null },
      { name: "Snails", unit: "kg", latest: null, crate: null },
      { name: "Grass-cutter (cane rat)", unit: "unit", latest: null, crate: null },
    ],
  },
  {
    label: "Vegetables",
    items: [
      { name: "Tomatoes", unit: "basket", latest: null, crate: null },
      { name: "Pepper (tatashe)", unit: "basket", latest: null, crate: null },
      { name: "Scotch bonnet (rodo)", unit: "basket", latest: null, crate: null },
      { name: "Onions", unit: "bag", latest: null, crate: null },
      { name: "Spinach (efo)", unit: "bundle", latest: null, crate: null },
      { name: "Ugwu (fluted pumpkin)", unit: "bundle", latest: null, crate: null },
      { name: "Bitter leaf", unit: "bundle", latest: null, crate: null },
      { name: "Waterleaf", unit: "bundle", latest: null, crate: null },
      { name: "Cabbage", unit: "unit", latest: null, crate: null },
      { name: "Carrots", unit: "kg", latest: null, crate: null },
      { name: "Cucumber", unit: "bag", latest: null, crate: null },
      { name: "Lettuce", unit: "unit", latest: null, crate: null },
      { name: "Green beans", unit: "kg", latest: null, crate: null },
      { name: "Okra", unit: "kg", latest: null, crate: null },
      { name: "Aubergine (garden egg)", unit: "basket", latest: null, crate: null },
      { name: "Corn (fresh)", unit: "unit", latest: null, crate: null },
      { name: "Garlic", unit: "kg", latest: null, crate: null },
      { name: "Ginger", unit: "kg", latest: null, crate: null },
    ],
  },
  {
    label: "Fruits",
    items: [
      { name: "Watermelon", unit: "unit", latest: null, crate: null },
      { name: "Mango", unit: "bag", latest: null, crate: null },
      { name: "Banana", unit: "bunch", latest: null, crate: null },
      { name: "Plantain", unit: "bunch", latest: null, crate: null },
      { name: "Pineapple", unit: "unit", latest: null, crate: null },
      { name: "Pawpaw (papaya)", unit: "unit", latest: null, crate: null },
      { name: "Orange", unit: "bag", latest: null, crate: null },
      { name: "Lemon / lime", unit: "bag", latest: null, crate: null },
      { name: "Avocado", unit: "bag", latest: null, crate: null },
      { name: "Guava", unit: "basket", latest: null, crate: null },
      { name: "Coconut", unit: "unit", latest: null, crate: null },
      { name: "Grapes", unit: "kg", latest: null, crate: null },
      { name: "Strawberries", unit: "kg", latest: null, crate: null },
    ],
  },
  {
    label: "Root crops & tubers",
    items: [
      { name: "Irish Potato", unit: "bag", latest: null, crate: null },
      { name: "Sweet potato", unit: "bag", latest: null, crate: null },
      { name: "Yam", unit: "unit", latest: null, crate: null },
      { name: "Cassava", unit: "bag", latest: null, crate: null },
      { name: "Cocoyam", unit: "bag", latest: null, crate: null },
    ],
  },
  {
    label: "Grains & cereals",
    items: [
      { name: "Maize (dry)", unit: "bag", latest: null, crate: null },
      { name: "Rice (paddy)", unit: "bag", latest: null, crate: null },
      { name: "Rice (milled)", unit: "bag", latest: null, crate: null },
      { name: "Millet", unit: "bag", latest: null, crate: null },
      { name: "Sorghum", unit: "bag", latest: null, crate: null },
      { name: "Guinea corn", unit: "bag", latest: null, crate: null },
      { name: "Wheat", unit: "bag", latest: null, crate: null },
      { name: "Oats", unit: "bag", latest: null, crate: null },
    ],
  },
  {
    label: "Legumes & pulses",
    items: [
      { name: "Soybean", unit: "bag", latest: null, crate: null },
      { name: "Cowpea (black-eyed beans)", unit: "bag", latest: null, crate: null },
      { name: "Groundnuts", unit: "bag", latest: null, crate: null },
      { name: "Bambara nuts", unit: "bag", latest: null, crate: null },
      { name: "Sesame (beniseed)", unit: "bag", latest: null, crate: null },
      { name: "Melon seed (egusi)", unit: "bag", latest: null, crate: null },
    ],
  },
  {
    label: "Fish & seafood",
    items: [
      { name: "Catfish (dressed)", unit: "kg", latest: null, crate: null },
      { name: "Tilapia (dressed)", unit: "kg", latest: null, crate: null },
      { name: "Mackerel (titus)", unit: "kg", latest: null, crate: null },
      { name: "Stockfish", unit: "kg", latest: null, crate: null },
      { name: "Dried fish", unit: "kg", latest: null, crate: null },
      { name: "Shrimp", unit: "kg", latest: null, crate: null },
      { name: "Crayfish", unit: "kg", latest: null, crate: null },
      { name: "Periwinkle", unit: "kg", latest: null, crate: null },
    ],
  },
  {
    label: "Spices & condiments",
    items: [
      { name: "Uziza leaf", unit: "bundle", latest: null, crate: null },
      { name: "Ehuru (calabash nutmeg)", unit: "kg", latest: null, crate: null },
      { name: "Ogiri (fermented locust bean)", unit: "kg", latest: null, crate: null },
      { name: "Iru (locust bean)", unit: "kg", latest: null, crate: null },
      { name: "Turmeric", unit: "kg", latest: null, crate: null },
      { name: "Cinnamon", unit: "kg", latest: null, crate: null },
      { name: "Cloves", unit: "kg", latest: null, crate: null },
    ],
  },
  {
    label: "Processed & packaged",
    items: [
      { name: "Palm oil (crude)", unit: "litre", latest: null, crate: null },
      { name: "Groundnut oil", unit: "litre", latest: null, crate: null },
      { name: "Coconut oil", unit: "litre", latest: null, crate: null },
      { name: "Honey", unit: "litre", latest: null, crate: null },
      { name: "Shea butter", unit: "kg", latest: null, crate: null },
    ],
  },
];

// ---------------------------------------------------------------------------
// Registry — updated when DB data loads. findCommodity reads this.
// ---------------------------------------------------------------------------
let _registry: Map<string, CommodityOption> = new Map(
  ALL_COMMODITIES.flatMap((cat) => cat.items.map((item) => [item.name.toLowerCase(), item])),
);

function updateRegistry(categories: Category[]) {
  _registry = new Map(
    categories.flatMap((cat) => cat.items.map((item) => [item.name.toLowerCase(), item])),
  );
}

/** Look up a commodity by name (case-insensitive). Works with both static and DB data. */
export function findCommodity(name: string): CommodityOption | undefined {
  return _registry.get(name.toLowerCase());
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
type Props = {
  value: string;
  onChange: (name: string, unit: string) => void;
  /** Optional class for the trigger button */
  className?: string;
};

export function CommodityPicker({ value, onChange, className }: Props) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<Category[]>(ALL_COMMODITIES);

  // Fetch live commodity list from DB on first render
  useEffect(() => {
    let cancelled = false;
    fetch("/api/commodities")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Category[] | null) => {
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setCategories(data);
          updateRegistry(data);
        }
      })
      .catch(() => {
        // Silently keep the static fallback
      });
    return () => { cancelled = true; };
  }, []);

  // Derived: filter categories and items by search query
  const q = query.trim().toLowerCase();
  const filtered: Category[] = q
    ? categories
        .map((cat) => ({
          ...cat,
          items: cat.items.filter(
            (item) =>
              item.name.toLowerCase().includes(q) || cat.label.toLowerCase().includes(q),
          ),
        }))
        .filter((cat) => cat.items.length > 0)
    : categories;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      const trigger = triggerRef.current;
      const list = listRef.current;
      if (
        trigger && !trigger.contains(e.target as Node) &&
        list && !list.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setQuery("");
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [open]);

  function select(item: CommodityOption) {
    onChange(item.name, item.unit);
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }

  const displayUnit = value ? (findCommodity(value)?.unit ?? "") : "";

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "mt-2 flex h-[52px] w-full items-center justify-between gap-2 rounded-2xl border border-line bg-white px-4 text-base text-ink outline-none transition-colors duration-150 focus-visible:border-green focus-visible:ring-3 focus-visible:ring-ring/40 sm:h-14 sm:bg-paper/60",
          !value && "text-ink-muted/70",
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate text-left">
          {value || "Choose a commodity…"}
        </span>
        {displayUnit && (
          <span className="shrink-0 rounded-full bg-sage-soft px-2 py-0.5 text-body-sm font-medium text-green">
            {displayUnit}
          </span>
        )}
        <ChevronDown
          strokeWidth={1.5}
          className={cn(
            "size-4 shrink-0 text-ink-muted transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={listRef}
          role="listbox"
          aria-label="Commodities"
          className="absolute left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-2xl border border-line bg-white shadow-lg"
          style={{ maxHeight: "min(420px, 60svh)" }}
        >
          {/* Search */}
          <div className="sticky top-0 z-10 border-b border-line bg-white px-3 py-2.5">
            <div className="flex items-center gap-2 rounded-xl border border-line bg-paper/60 px-3">
              <Search strokeWidth={1.5} className="size-4 shrink-0 text-ink-muted" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search produce…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted/60"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="flex size-5 items-center justify-center rounded-full text-ink-muted hover:text-ink"
                  aria-label="Clear search"
                >
                  <X strokeWidth={2} className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: "calc(min(420px, 60svh) - 56px)" }}>
            {filtered.length === 0 ? (
              <p className="px-4 py-6 text-center text-body-sm text-ink-muted">
                No match for &ldquo;{query}&rdquo;
              </p>
            ) : (
              filtered.map((cat) => (
                <div key={cat.label}>
                  <p className="sticky top-0 bg-paper/80 px-4 py-1.5 text-label font-semibold uppercase tracking-wider text-ink-muted backdrop-blur-sm">
                    {cat.label}
                  </p>
                  {cat.items.map((item) => (
                    <button
                      key={item.name}
                      role="option"
                      aria-selected={value === item.name}
                      type="button"
                      onClick={() => select(item)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-sage-soft",
                        value === item.name && "bg-sage-soft font-medium text-green",
                      )}
                    >
                      <span>{item.name}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-label font-medium",
                          value === item.name
                            ? "bg-green/10 text-green"
                            : "bg-line text-ink-muted",
                        )}
                      >
                        {item.unit}
                      </span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
