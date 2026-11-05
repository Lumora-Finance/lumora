"use client";

import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";

import app from "@/lib/firebase/config";
import { cn } from "@/lib/utils";
import { RowsSkeleton } from "@/components/loader/skeletons";

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

export function formatKobo(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
}

export function relDate(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 86_400_000) return "Today";
  if (diff < 172_800_000) return "Yesterday";
  return d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-sage-soft text-green", paused: "bg-amber-soft text-amber", closed: "bg-line text-ink-muted",
  booked: "bg-amber-soft text-amber", confirmed: "bg-sage-soft text-green", settled: "bg-sage-soft text-green",
  cancelled: "bg-danger/10 text-danger", no_show: "bg-danger/10 text-danger", delivered: "bg-sage-soft text-green",
  disputed: "bg-danger/10 text-danger", released: "bg-line text-ink-muted",
  pending: "bg-amber-soft text-amber", queued: "bg-amber-soft text-amber", sending: "bg-amber-soft text-amber",
  in_flight: "bg-amber-soft text-amber", paid: "bg-sage-soft text-green", failed: "bg-danger/10 text-danger",
  sent: "bg-sage-soft text-green",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-label font-medium capitalize", STATUS_STYLE[status] ?? "bg-line text-ink-muted")}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function AdminPageShell({ title, subtitle, count, loading, error, children }: {
  title: string; subtitle: string; count?: number; loading: boolean; error: string | null; children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-6 md:px-6 lg:px-8">
      <h1 className="font-display text-2xl font-medium text-ink">{title}</h1>
      <p className="mt-1 text-body-sm text-ink-muted">
        {loading ? "Loading" : error ? error : count !== undefined ? `${count} ${subtitle}` : subtitle}
      </p>
      <div className="mt-6">
        {loading ? (
          <RowsSkeleton rows={6} />
        ) : children}
      </div>
    </div>
  );
}
