"use client";

/**
 * LumoraSelect — a custom dropdown that matches the commodity picker's style.
 * Drop-in replacement for <select>: same props, same height, same focus ring.
 *
 * Supports optional grouping: pass items as flat array or grouped array.
 * Supports portal rendering (portal prop) for use inside modals/sheets so the
 * dropdown panel isn't clipped by overflow:hidden containers.
 *
 * Usage:
 *   <LumoraSelect
 *     value={bankCode}
 *     onChange={setBankCode}
 *     placeholder="Select your bank"
 *     options={banks.map(b => ({ value: b.code, label: b.name }))}
 *   />
 *
 *   // Inside a modal (prevents clipping):
 *   <LumoraSelect portal ... />
 *
 *   // Grouped:
 *   <LumoraSelect
 *     value={commodity}
 *     onChange={setCommodity}
 *     groups={[{ label: "Poultry", items: [{ value: "broiler", label: "Live broilers" }] }]}
 *   />
 */

import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
  hint?: string;
};

export type SelectGroup = {
  label: string;
  items: SelectOption[];
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  /** Flat list of options */
  options?: SelectOption[];
  /** Grouped list (takes priority over options) */
  groups?: SelectGroup[];
  className?: string;
  id?: string;
  /**
   * Render the dropdown panel via a portal on document.body.
   * Use this whenever the select is inside a modal, sheet, or any container
   * with overflow:hidden — prevents the panel being clipped.
   */
  portal?: boolean;
};

type PanelRect = { top: number; left: number; width: number; maxHeight: number; openUp: boolean };

export function LumoraSelect({
  value,
  onChange,
  placeholder = "Choose…",
  disabled = false,
  searchable = false,
  options,
  groups,
  className,
  id: externalId,
  portal = false,
}: Props) {
  const autoId = useId();
  const id = externalId ?? autoId;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [panelRect, setPanelRect] = useState<PanelRect | null>(null);

  // Build a flat option list from whichever prop is provided
  const allGroups: SelectGroup[] = groups
    ? groups
    : options
    ? [{ label: "", items: options }]
    : [];

  // Derive the display label for the current value
  const displayLabel =
    allGroups.flatMap((g) => g.items).find((o) => o.value === value)?.label ?? "";

  // Filter by query
  const q = query.trim().toLowerCase();
  const filteredGroups: SelectGroup[] = q
    ? allGroups
        .map((g) => ({
          ...g,
          items: g.items.filter(
            (item) =>
              item.label.toLowerCase().includes(q) ||
              (item.hint ?? "").toLowerCase().includes(q) ||
              g.label.toLowerCase().includes(q),
          ),
        }))
        .filter((g) => g.items.length > 0)
    : allGroups;

  const totalItems = filteredGroups.reduce((s, g) => s + g.items.length, 0);

  // When portal mode: compute where to place the panel on open
  useLayoutEffect(() => {
    if (!portal || !open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const vpH = window.innerHeight;
    const spaceBelow = vpH - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(380, openUp ? spaceAbove : spaceBelow);
    setPanelRect({
      top: openUp ? rect.top - maxHeight - 6 : rect.bottom + 6,
      left: rect.left,
      width: rect.width,
      maxHeight,
      openUp,
    });
  }, [open, portal]);

  // Recompute panel position on scroll/resize while open
  useEffect(() => {
    if (!portal || !open) return;
    function update() {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const vpH = window.innerHeight;
      const spaceBelow = vpH - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
      const maxHeight = Math.min(380, openUp ? spaceAbove : spaceBelow);
      setPanelRect({
        top: openUp ? rect.top - maxHeight - 6 : rect.bottom + 6,
        left: rect.left,
        width: rect.width,
        maxHeight,
        openUp,
      });
    }
    window.addEventListener("scroll", update, { passive: true, capture: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, { capture: true });
      window.removeEventListener("resize", update);
    };
  }, [open, portal]);

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

  // Focus search on open
  useEffect(() => {
    if (open && searchable) {
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setQuery("");
    }
  }, [open, searchable]);

  // Escape to close
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

  function select(option: SelectOption) {
    onChange(option.value);
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }

  const showGroups = allGroups.length > 1 || (groups && groups.length > 0);

  const panelContent = (
    <div
      ref={listRef}
      role="listbox"
      aria-label={placeholder}
      className={cn(
        "overflow-hidden rounded-2xl border border-line bg-white shadow-xl",
        portal
          ? "fixed z-[200]"
          : "absolute left-0 right-0 z-50 mt-1.5",
      )}
      style={
        portal && panelRect
          ? {
              top: panelRect.top,
              left: panelRect.left,
              width: panelRect.width,
              maxHeight: panelRect.maxHeight,
            }
          : { maxHeight: "min(380px, 60svh)" }
      }
    >
      {/* Search bar — shown when searchable or > 8 options */}
      {(searchable || totalItems > 8) && (
        <div className="sticky top-0 z-10 border-b border-line bg-white px-3 py-2.5">
          <div className="flex items-center gap-2 rounded-xl border border-line bg-paper/60 px-3">
            <Search strokeWidth={1.5} className="size-4 shrink-0 text-ink-muted" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted/60"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                className="flex size-5 items-center justify-center rounded-full text-ink-muted hover:text-ink"
                aria-label="Clear search"
              >
                <X strokeWidth={2} className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* List */}
      <div className="overflow-y-auto" style={{ maxHeight: portal && panelRect ? panelRect.maxHeight - 56 : "calc(min(380px, 60svh) - 56px)" }}>
        {filteredGroups.length === 0 ? (
          <p className="px-4 py-6 text-center text-body-sm text-ink-muted">
            No match for &ldquo;{query}&rdquo;
          </p>
        ) : (
          filteredGroups.map((group) => (
            <div key={group.label}>
              {showGroups && group.label && (
                <p className="sticky top-0 bg-paper/80 px-4 py-1.5 text-label font-semibold uppercase tracking-wider text-ink-muted backdrop-blur-sm">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                const selected = value === item.value;
                return (
                  <button
                    key={item.value}
                    role="option"
                    aria-selected={selected}
                    type="button"
                    onClick={() => select(item)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-sage-soft",
                      selected && "bg-sage-soft font-medium text-green",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{item.label}</span>
                      {item.hint && (
                        <span className="block truncate text-xs text-ink-muted">{item.hint}</span>
                      )}
                    </span>
                    {selected && (
                      <Check strokeWidth={2.5} className="size-3.5 shrink-0 text-green" />
                    )}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          "flex h-[52px] w-full items-center justify-between gap-2 rounded-2xl border border-line bg-white px-4 text-base text-ink outline-none transition-colors duration-150",
          "focus-visible:border-green focus-visible:ring-3 focus-visible:ring-ring/40",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "sm:h-14 sm:bg-paper/60",
          open && "border-green ring-3 ring-ring/40",
          !value && "text-ink-muted/70",
        )}
      >
        <span className="min-w-0 flex-1 truncate text-left">
          {displayLabel || placeholder}
        </span>
        <ChevronDown
          strokeWidth={1.5}
          className={cn(
            "size-4 shrink-0 text-ink-muted transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        portal
          ? createPortal(panelContent, document.body)
          : panelContent
      )}
    </div>
  );
}
