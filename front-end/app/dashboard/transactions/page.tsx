"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, ChevronDown, ChevronUp, Loader2, Wallet } from "lucide-react";
import { getAuth } from "firebase/auth";

import app from "@/lib/firebase/config";
import { LogoVideo } from "@/components/dashboard/logo-video";
import { Reveal } from "@/components/motion/reveal";
import { fx, playOnEnter, useGSAP } from "@/lib/gsap/effects";
import { cn } from "@/lib/utils";

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
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
}

function relativeDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86_400_000) return "Today";
  if (diff < 172_800_000) return "Yesterday";
  return d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
}

const CROPS = [
  { src: "/images/step-scale.jpg", pos: "object-[50%_40%]", cls: "absolute top-4 right-10 size-14 hidden sm:block" },
  { src: "/images/hero-farm.jpg", pos: "object-[52%_25%]", cls: "absolute bottom-4 right-4 size-12" },
];

export default function TransactionsPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [txs, setTxs] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = await getAuth(app).currentUser?.getIdToken();
        const res = await fetch("/api/dashboard/transactions", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as Settlement[];
        if (!cancelled) setTxs(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setError("Couldn't load transactions. Please refresh.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useGSAP(
    () => {
      const root = heroRef.current;
      if (!root) return;
      playOnEnter(fx("chipPop", root.querySelectorAll("[data-chip]"), { stagger: 0.1 }), root, "top 85%");
      fx("floatDrift", root.querySelectorAll("[data-crop]"));
    },
    { scope: heroRef },
  );

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

      {/* Hero */}
      <div
        ref={heroRef}
        data-rhythm="field"
        className="relative isolate mb-8 overflow-hidden rounded-2xl bg-field px-6 py-10 text-paper lg:px-10 lg:py-12"
      >
        <LogoVideo />
        {CROPS.map((c, i) => (
          <div key={i} aria-hidden className={cn("overflow-hidden rounded-full", c.cls)}>
            <img src={c.src} alt="" className={cn("size-full object-cover", c.pos)} />
          </div>
        ))}

        <p className="text-label font-medium text-sage/70">Financial Activity</p>
        <h1 className="mt-2 font-display text-display-lg-sm font-medium text-paper md:text-[2rem]">
          Transactions
        </h1>

        {!loading && (
          <div className="mt-6 flex flex-wrap gap-3">
            <div data-chip className="flex flex-col rounded-[16px_4px_16px_4px] bg-sage/20 px-4 py-3">
              <span className="text-label text-sage/70">Received</span>
              <span className="font-num text-number-lg font-medium text-paper">
                {formatKobo(received.reduce((s, t) => s + t.net_kobo, 0))}
              </span>
            </div>
            <div data-chip className="flex flex-col rounded-[4px_16px_4px_16px] bg-field-soft/70 px-4 py-3">
              <span className="text-label text-paper/50">Paid out</span>
              <span className="font-num text-number-lg font-medium text-paper/80">
                {formatKobo(Math.abs(paid.reduce((s, t) => s + t.net_kobo, 0)))}
              </span>
            </div>
            <div data-chip className="flex flex-col rounded-[4px_16px_4px_16px] bg-amber/20 px-4 py-3">
              <span className="text-label text-amber/70">Net total</span>
              <span className="font-num text-number-lg font-medium text-amber">
                {formatKobo(totalNet)}
              </span>
            </div>
          </div>
        )}
      </div>

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
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-ink-muted" />
        </div>
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
