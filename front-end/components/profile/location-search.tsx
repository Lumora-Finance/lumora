"use client";

import { MapPin, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type Area = { name: string; lga: string | null; lat: number; lng: number };

interface Props {
  value: string;
  onChange: (area: string) => void;
  disabled?: boolean;
  error?: string | null;
  id?: string;
}

export function LocationSearch({ value, onChange, disabled, error, id = "location" }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Area[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load(q: string) {
    setLoading(true);
    try {
      const r = await fetch(`/api/areas?q=${encodeURIComponent(q)}`);
      if (r.ok) { setResults(await r.json()); if (!q) setSeeded(true); }
    } catch { /* */ } finally { setLoading(false); }
  }

  function onInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => load(q), 220);
  }

  function onFocus() { setOpen(true); if (!seeded) load(""); }
  function pick(a: Area) { onChange(a.name); setQuery(""); setOpen(false); }
  function clear() { onChange(""); setQuery(""); setOpen(false); inputRef.current?.focus(); }

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  function onKey(e: React.KeyboardEvent) {
    const items = listRef.current?.querySelectorAll<HTMLButtonElement>("[data-a]");
    if (e.key === "ArrowDown" && items?.length) { e.preventDefault(); items[0].focus(); }
    if (e.key === "Escape") setOpen(false);
  }

  function onItemKey(e: React.KeyboardEvent<HTMLButtonElement>, idx: number, a: Area) {
    const items = listRef.current?.querySelectorAll<HTMLButtonElement>("[data-a]");
    if (!items) return;
    if (e.key === "ArrowDown") { e.preventDefault(); items[idx + 1]?.focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); idx === 0 ? inputRef.current?.focus() : items[idx - 1]?.focus(); }
    if (e.key === "Enter") { e.preventDefault(); pick(a); }
    if (e.key === "Escape") { setOpen(false); inputRef.current?.focus(); }
  }

  return (
    <div ref={rootRef} className="relative">
      <div className={cn(
        "flex h-[52px] w-full items-center overflow-hidden rounded-2xl border bg-white transition-colors duration-150 sm:h-14",
        error ? "border-danger ring-3 ring-danger/20"
          : open ? "border-green ring-3 ring-ring/40"
          : "border-line",
      )}>
        <MapPin strokeWidth={1.5} className="ml-4 size-[18px] shrink-0 text-ink-muted" aria-hidden />
        <input
          ref={inputRef} id={id} type="text" autoComplete="off" disabled={disabled}
          value={open ? query : (value ? `Near ${value}` : "")}
          onFocus={onFocus} onChange={onInput} onKeyDown={onKey}
          placeholder="Search Plateau State areas…"
          aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`}
          className="min-w-0 flex-1 bg-transparent px-3 text-base text-ink placeholder:text-ink-muted/70 outline-none disabled:opacity-50"
        />
        {(value || query) && (
          <button type="button" onClick={clear} aria-label="Clear location"
            className="mr-3 flex size-7 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-line">
            <X strokeWidth={2} className="size-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-2xl border border-line bg-white shadow-xl">
          {loading ? (
            <div className="flex items-center gap-2 px-4 py-3 text-body-sm text-ink-muted">
              <Search strokeWidth={1.5} className="size-4 animate-pulse" /> Searching…
            </div>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-body-sm text-ink-muted">
              {query ? `No areas match "${query}"` : "No areas found."}
            </p>
          ) : (
            <ul ref={listRef} id={`${id}-list`} role="listbox" className="max-h-64 overflow-y-auto py-1">
              {results.map((a, i) => (
                <li key={a.name} role="option" aria-selected={a.name === value}>
                  <button data-a type="button" onClick={() => pick(a)} onKeyDown={(e) => onItemKey(e, i, a)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-sage-soft focus:bg-sage-soft focus:outline-none",
                      a.name === value && "bg-sage-soft",
                    )}>
                    <MapPin strokeWidth={1.5} className="size-4 shrink-0 text-green" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm font-medium text-ink">{a.name}</p>
                      {a.lga && <p className="text-label text-ink-muted">{a.lga} LGA · Plateau State</p>}
                    </div>
                    {a.name === value && <span className="ml-auto text-label font-medium text-green">✓</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-1.5 text-body-sm text-danger">{error}</p>}
    </div>
  );
}
