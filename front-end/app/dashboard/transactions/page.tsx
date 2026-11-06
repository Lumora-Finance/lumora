"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, Landmark, Lock, LockOpen, ReceiptText, Wallet,
} from "lucide-react";

import { getToken } from "@/lib/firebase/auth";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";
import { RowsSkeleton } from "@/components/loader/skeletons";
import { HillsCard, HillsStats } from "@/components/profile/hills-card";
import { trackTask } from "@/lib/loading/progress";

type TxKind = "deposit" | "withdrawal" | "trade" | "hold" | "release" | "fee" | "other";
type Direction = "credit" | "debit";

type TxRow = {
  id: string;
  kind: TxKind;
  label: string;
  amount_kobo: number;
  direction: Direction;
  status: "completed" | "pending";
  ref: string;
  created_at: string;
  detail: string;
};

type Filter = "all" | "deposits" | "withdrawals" | "trades" | "holds";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "deposits", label: "Deposits" },
  { key: "withdrawals", label: "Withdrawals" },
  { key: "trades", label: "Trades" },
  { key: "holds", label: "Holds" },
];

function formatKobo(kobo: number) {
  return `₦${(Math.abs(kobo) / 100).toLocaleString("en-NG", {
    minimumFractionDigits: kobo % 100 ? 2 : 0,
  })}`;
}

function relativeDate(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 86_400_000) return "Today";
  if (diff < 172_800_000) return "Yesterday";
  return d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
}

function kindIcon(kind: TxKind, direction: Direction) {
  if (kind === "deposit") return <ArrowDownLeft strokeWidth={2} className="size-4 text-green" />;
  if (kind === "withdrawal") return <ArrowUpRight strokeWidth={2} className="size-4 text-amber" />;
  if (kind === "trade") return direction === "credit"
    ? <ArrowDownLeft strokeWidth={2} className="size-4 text-green" />
    : <ArrowUpRight strokeWidth={2} className="size-4 text-amber" />;
  if (kind === "hold") return <Lock strokeWidth={2} className="size-4 text-ink-muted" />;
  if (kind === "release") return <LockOpen strokeWidth={2} className="size-4 text-green" />;
  if (kind === "fee") return <ReceiptText strokeWidth={2} className="size-4 text-ink-muted" />;
  return <Landmark strokeWidth={2} className="size-4 text-ink-muted" />;
}

function kindBg(kind: TxKind, direction: Direction) {
  if (kind === "deposit" || kind === "release") return "bg-sage-soft";
  if (kind === "withdrawal") return "bg-amber-soft";
  if (kind === "trade") return direction === "credit" ? "bg-sage-soft" : "bg-amber-soft";
  return "bg-line";
}

export default function TransactionsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [txs, setTxs] = useState<TxRow[]>([]);
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
        const data = (await res.json()) as TxRow[];
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

  const filtered = txs.filter((tx) => {
    if (filter === "deposits") return tx.kind === "deposit";
    if (filter === "withdrawals") return tx.kind === "withdrawal";
    if (filter === "trades") return tx.kind === "trade";
    if (filter === "holds") return tx.kind === "hold" || tx.kind === "release";
    return true;
  });

  const totalIn = txs.filter((t) => t.direction === "credit" && t.kind !== "hold").reduce((s, t) => s + t.amount_kobo, 0);
  const totalOut = txs.filter((t) => t.direction === "debit" && t.kind !== "release").reduce((s, t) => s + t.amount_kobo, 0);

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
                {
                  value: loading ? null : <span className="font-num whitespace-nowrap">{formatKobo(totalIn)}</span>,
                  label: "total in",
                },
                {
                  value: loading ? null : <span className="font-num whitespace-nowrap">{formatKobo(totalOut)}</span>,
                  label: "total out",
                },
                {
                  value: loading ? null : <span className="font-num whitespace-nowrap">{txs.length}</span>,
                  label: "movements",
                },
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

      {loading ? (
        <RowsSkeleton rows={6} label="Loading your money" />
      ) : error ? (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-6 text-center text-danger">{error}</div>
      ) : filtered.length === 0 ? (
        <Reveal effect="riseIn">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-field px-8 py-16 text-center text-paper">
            <Wallet strokeWidth={1} className="size-10 text-sage/40" />
            <p className="font-display text-title font-medium">No transactions yet</p>
            <p className="text-body text-paper/60">
              {filter === "all"
                ? "Every deposit, withdrawal and trade movement will appear here."
                : `No ${filter} yet.`}
            </p>
          </div>
        </Reveal>
      ) : (
        <Reveal effect="riseIn">
          <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
            {filtered.map((tx) => (
              <div key={tx.id} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-b-0 hover:bg-sage-soft/20 transition-colors">
                {/* Icon */}
                <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", kindBg(tx.kind, tx.direction))}>
                  {kindIcon(tx.kind, tx.direction)}
                </div>

                {/* Label + detail */}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{tx.label}</p>
                  {tx.detail && tx.detail !== tx.label && (
                    <p className="truncate text-body-sm text-ink-muted">{tx.detail}</p>
                  )}
                  {tx.ref && (
                    <p className="font-num text-label text-ink-muted">{tx.ref}</p>
                  )}
                </div>

                {/* Amount + date */}
                <div className="shrink-0 text-right">
                  <p className={cn(
                    "font-num text-number font-medium",
                    tx.direction === "credit" && tx.kind !== "hold" ? "text-green" : "text-amber",
                    tx.kind === "fee" && "text-ink-muted",
                  )}>
                    {tx.direction === "credit" && tx.kind !== "hold" ? "+" : "−"}{formatKobo(tx.amount_kobo)}
                  </p>
                  <p className="font-num text-label text-ink-muted">{relativeDate(tx.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      )}
    </div>
  );
}
