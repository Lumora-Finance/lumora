"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, ChevronDown, ChevronUp, Wallet } from "lucide-react";


import { getToken } from "@/lib/firebase/auth";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";
import { RowsSkeleton } from "@/components/loader/skeletons";
import { HillsCard, HillsStats } from "@/components/profile/hills-card";
import { trackTask } from "@/lib/loading/progress";

type Filter = "all" | "trade" | "wallet" | "received" | "paid";

type Settlement = {
  id: string;
  gross_kobo: number;
  fees_kobo: number;
  net_kobo: number;
  kind: string;
  created_at: string;
  booking: {
    code: string;
    slot: {
      listing: {
        spec: string;
        commodity: { name: string; unit: string };
        buyer: { id: string; name: string };
      };
    } | null;
    farmer: { id: string; name: string };
  } | null;
};

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "trade", label: "Trades" },
  { key: "wallet", label: "Wallet" },
  { key: "received", label: "Received" },
  { key: "paid", label: "Paid" },
];

const STATUS_STYLE: Record<string, string> = {
  settled: "text-success",
  completed: "text-success",
  pending: "text-amber",
  failed: "text-danger",
};

function formatKobo(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: kobo % 100 ? 2 : 0 })}`;
}

function relativeDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86_400_000) return "Today";
  if (diff < 172_800_000) return "Yesterday";
  return d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
}

export default function TransactionsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [txs, setTxs] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const finished = trackTask("transactions-page");
      setError(null);
      try {
        const token = await getToken();
        const res = await fetch("/api/dashboard/transactions", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as Settlement[];
        if (!cancelled) setTxs(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setError("Couldn't load transactions. Please refresh.");
      } finally {
        finished();
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // All trade settlements come from kind = "farmer_pay" / "partial" etc.
  const received = txs.filter((t) => t.net_kobo > 0);
  const paid = txs.filter((t) => t.net_kobo <= 0);
  const totalNet = txs.reduce((s, t) => s + t.net_kobo, 0);
  const totalFees = txs.reduce((s, t) => s + t.fees_kobo, 0);

  const filtered = txs.filter((tx) => {
    if (filter === "received") return tx.net_kobo > 0;
    if (filter === "paid") return tx.net_kobo <= 0;
    // wallet / trade distinction not yet in data — show all for now
    return true;
  });

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-6 lg:px-8">

      <HillsCard className="mb-8">
        <div className="px-5 pt-24 pb-6 sm:px-10 sm:pt-28 sm:pb-9 lg:px-14 lg:pt-32 lg:pb-11">
          <p data-card="rise" className="text-body-sm font-medium text-ink/70">Financial activity</p>
          <h1 data-card="rise" className="mt-1 text-[26px] leading-tight font-medium tracking-tight text-ink sm:text-[34px]">Transactions</h1>
          <div className="mt-6 sm:mt-8">
            <HillsStats
              rowsOnPhones
              stats={[
                { value: loading ? null : <span className="font-num whitespace-nowrap">{formatKobo(received.reduce((s, t) => s + t.net_kobo, 0))}</span>, label: "received" },
                { value: loading ? null : <span className="font-num whitespace-nowrap">{formatKobo(Math.abs(paid.reduce((s, t) => s + t.net_kobo, 0)))}</span>, label: "paid out" },
                { value: loading ? null : <span className="font-num whitespace-nowrap">{formatKobo(totalNet)}</span>, label: "net total" },
              ]}
            />
          </div>
        </div>
      </HillsCard>

      {/* Filters */}
      <Reveal effect="riseIn">
        <div className="mb-6 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-body-sm font-medium transition-colors",
                filter === f.key
                  ? "border-green bg-sage-soft text-green"
                  : "border-line text-ink-muted hover:border-green hover:text-green",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Reveal>

      {/* Table */}
      {loading ? (
        <RowsSkeleton rows={6} label="Loading your money" />
      ) : error ? (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-6 text-center text-danger">{error}</div>
      ) : filtered.length === 0 ? (
        <Reveal effect="riseIn">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-field px-8 py-16 text-center text-paper">
            <Wallet strokeWidth={1} className="size-10 text-sage/40" />
            <p className="font-display text-title font-medium">No transactions yet</p>
            <p className="text-body text-paper/60">Completed deliveries and wallet activity will appear here.</p>
          </div>
        </Reveal>
      ) : (
        <Reveal effect="riseIn">
          <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
            {filtered.map((tx) => {
              const isIn = tx.net_kobo > 0;
              const commodity = tx.booking?.slot?.listing?.commodity?.name ?? "Settlement";
              const counterparty = isIn
                ? (tx.booking?.slot?.listing?.buyer?.name ?? "Buyer")
                : (tx.booking?.farmer?.name ?? "Farmer");
              const isExpanded = expanded === tx.id;

              return (
                <div key={tx.id} className="border-b border-line last:border-b-0">
                  <button
                    onClick={() => setExpanded(isExpanded ? null : tx.id)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-sage-soft/20"
                  >
                    <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", isIn ? "bg-sage-soft" : "bg-amber-soft")}>
                      {isIn
                        ? <ArrowDownLeft strokeWidth={2} className="size-4 text-green" />
                        : <ArrowUpRight strokeWidth={2} className="size-4 text-amber" />
                      }
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{commodity}</p>
                      <p className="text-body-sm text-ink-muted">{isIn ? "From" : "To"} {counterparty}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={cn("font-num text-number font-medium", isIn ? "text-green" : "text-amber")}>
                        {isIn ? "+" : "−"}{formatKobo(Math.abs(tx.net_kobo))}
                      </p>
                      <p className="font-num text-label text-ink-muted">{relativeDate(tx.created_at)}</p>
                    </div>
                    <div className="flex size-6 items-center justify-center text-ink-muted">
                      {isExpanded ? <ChevronUp strokeWidth={1.5} className="size-4" /> : <ChevronDown strokeWidth={1.5} className="size-4" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-line bg-sage-soft/20 px-5 py-4">
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <div>
                          <p className="text-label text-ink-muted">Booking code</p>
                          <p className="font-num text-body-sm font-medium text-ink">{tx.booking?.code ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-label text-ink-muted">Gross</p>
                          <p className="font-num text-body-sm text-ink">{formatKobo(tx.gross_kobo)}</p>
                        </div>
                        {tx.fees_kobo > 0 && (
                          <div>
                            <p className="text-label text-ink-muted">Platform fee</p>
                            <p className="font-num text-body-sm text-ink">{formatKobo(tx.fees_kobo)}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-label text-ink-muted">Status</p>
                          <p className="flex items-center gap-1.5 text-body-sm text-success">
                            <CheckCircle2 strokeWidth={2} className="size-3.5" /> settled
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Reveal>
      )}
    </div>
  );
}
