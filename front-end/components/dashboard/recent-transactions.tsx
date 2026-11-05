"use client";

import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardData } from "@/lib/hooks/use-dashboard-data";

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

export function RecentTransactions() {
  const { data, loading } = useDashboardData<Settlement[]>("transactions");
  const txs = data ?? [];

  const totalNet = txs.reduce((s, t) => s + t.net_kobo, 0);
  const totalFees = txs.reduce((s, t) => s + t.fees_kobo, 0);

  return (
    <div className="rounded-xl border border-line bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-heading font-medium text-ink">Recent Transactions</h2>
          <p className="mt-0.5 text-body-sm text-ink-muted">Your settled deliveries</p>
        </div>
        {!loading && txs.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-lg bg-sage-soft px-2.5 py-1.5 font-num text-body-sm font-medium text-green">
              <ArrowDownLeft strokeWidth={2} className="size-3.5" />
              {formatKobo(totalNet)} net
            </span>
            <span className="flex items-center gap-1.5 rounded-lg bg-amber-soft px-2.5 py-1.5 font-num text-body-sm font-medium text-amber">
              <ArrowUpRight strokeWidth={2} className="size-3.5" />
              {formatKobo(totalFees)} fees
            </span>
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex flex-col gap-2 p-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-ink-muted" />
          </div>
        ) : txs.length === 0 ? (
          <p className="py-6 text-center text-body-sm text-ink-muted">No transactions yet.</p>
        ) : (
          txs.map((tx) => {
            const commodity = tx.booking?.slot?.listing?.commodity?.name ?? "Produce";
            const counterparty = tx.booking?.slot?.listing?.buyer?.name ?? "Buyer";
            const feeKobo = tx.fees_kobo;
            return (
              <div
                key={tx.id}
                className="flex items-center gap-4 rounded-lg bg-paper px-4 py-3.5 transition-all hover:shadow-sm"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage-soft">
                  <ArrowDownLeft strokeWidth={2} className="size-4 text-green" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{commodity}</p>
                  <p className="truncate text-body-sm text-ink-muted">From {counterparty}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-num text-number font-medium text-green">
                    +{formatKobo(tx.net_kobo)}
                  </p>
                  <div className="mt-0.5 flex items-center justify-end gap-1.5">
                    <CheckCircle2 strokeWidth={2} className="size-3 text-success" />
                    <p className="text-label text-ink-muted">{relativeDate(tx.created_at)}</p>
                  </div>
                  {feeKobo > 0 && (
                    <p className="font-num text-label text-ink-muted">{formatKobo(feeKobo)} fee</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-line px-5 py-3">
        <a href="/dashboard/transactions" className="text-body-sm font-medium text-green hover:underline">
          View all transactions →
        </a>
      </div>
    </div>
  );
}
