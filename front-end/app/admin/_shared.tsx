"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getAuth } from "firebase/auth";

import app from "@/lib/firebase/config";
import { cn } from "@/lib/utils";
import { RowsSkeleton } from "@/components/loader/skeletons";

// ─── Data fetcher ─────────────────────────────────────────────────────────────

/** Fetch helper for admin pages — attaches the Firebase auth token. */
export function useAdminData<T>(endpoint: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = await getAuth(app).currentUser?.getIdToken();
        const res = await fetch(endpoint, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const json = (await res.json()) as T;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("Couldn't load data. Please refresh.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [endpoint]);

  return { data, loading, error };
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export function formatKobo(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
}

export function relDate(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 172_800_000) return "Yesterday";
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  active: "bg-sage-soft text-green", paused: "bg-amber-soft text-amber-700",
  closed: "bg-line text-ink-muted",
  booked: "bg-amber-soft text-amber-700", confirmed: "bg-sage-soft text-green",
  settled: "bg-sage-soft text-green", cancelled: "bg-danger/10 text-danger",
  no_show: "bg-danger/10 text-danger", delivered: "bg-sage-soft text-green",
  disputed: "bg-danger/10 text-danger", released: "bg-line text-ink-muted",
  pending: "bg-amber-soft text-amber-700", queued: "bg-amber-soft text-amber-700",
  sending: "bg-amber-soft text-amber-700", in_flight: "bg-amber-soft text-amber-700",
  paid: "bg-sage-soft text-green", failed: "bg-danger/10 text-danger",
  sent: "bg-sage-soft text-green", open: "bg-danger/10 text-danger",
  resolved: "bg-sage-soft text-green", approved: "bg-sage-soft text-green",
  rejected: "bg-danger/10 text-danger",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      "shrink-0 rounded-full px-2.5 py-0.5 text-label font-medium capitalize",
      STATUS_STYLE[status] ?? "bg-line text-ink-muted",
    )}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ─── Search input ─────────────────────────────────────────────────────────────

export function SearchInput({ value, onChange, placeholder = "Search…" }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative max-w-xs">
      <Search strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-sm text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-muted/60 focus:border-green focus:ring-3 focus:ring-green/20"
      />
      {value && (
        <button
          type="button"
          onClick={() => { onChange(""); ref.current?.focus(); }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
          aria-label="Clear"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ─── Tab filter ───────────────────────────────────────────────────────────────

export function TabFilter<T extends string>({
  value, onChange, options,
}: {
  value: T; onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-white p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg px-3 py-1.5 font-num text-label font-medium transition-colors",
            value === o.value
              ? "bg-field text-paper shadow-sm"
              : "text-ink-muted hover:bg-sage-soft hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────

export function AdminPageShell({
  title, subtitle, count, loading, error, children, actions,
}: {
  title: string; subtitle: string; count?: number; loading: boolean;
  error: string | null; children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1080px] px-4 py-6 md:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-ink">{title}</h1>
          <p className="mt-0.5 text-body-sm text-ink-muted">
            {loading ? "Loading…" : error ? error : count !== undefined ? `${count.toLocaleString()} ${subtitle}` : subtitle}
          </p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
            <RowsSkeleton rows={8} className="px-5" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-danger/20 bg-danger/5 p-8 text-center">
            <p className="font-medium text-danger">{error}</p>
            <p className="mt-1 text-body-sm text-ink-muted">Check your connection and refresh.</p>
          </div>
        ) : children}
      </div>
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

export function EmptyState({ message, detail }: { message: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white px-5 py-14 text-center shadow-sm">
      <p className="font-medium text-ink">{message}</p>
      {detail && <p className="mt-1 text-body-sm text-ink-muted">{detail}</p>}
    </div>
  );
}

// ─── Data table wrapper ───────────────────────────────────────────────────────

export function DataTable({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
      <div className="divide-y divide-line">{children}</div>
      {footer && <div className="border-t border-line px-5 py-3 text-body-sm text-ink-muted">{footer}</div>}
    </div>
  );
}
