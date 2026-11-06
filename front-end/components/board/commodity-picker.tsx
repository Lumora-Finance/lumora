"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import {
  ALL_COMMODITIES,
  findCommodity,
  updateRegistry,
  type CommodityCategory,
  type CommodityOption,
} from "@/lib/logistics/commodities";
import { cn } from "@/lib/utils";

export type { CommodityOption };
export { ALL_COMMODITIES, findCommodity };

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
  const [categories, setCategories] = useState<CommodityCategory[]>(ALL_COMMODITIES);

  // Fetch live commodity list from DB on first render
  useEffect(() => {
    let cancelled = false;
    fetch("/api/commodities")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: CommodityCategory[] | null) => {
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
  const filtered: CommodityCategory[] = q
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
