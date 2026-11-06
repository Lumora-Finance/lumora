"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { RowsSkeleton } from "@/components/loader/skeletons";
import { useDashboardData } from "@/lib/hooks/use-dashboard-data";
import { formatKobo } from "@/lib/money/rules";
import { cn } from "@/lib/utils";

import { Panel, PanelHeading, PanelLink } from "./panel";

const MOST_SHOWN = 4;

/**
 * Shape returned by /api/dashboard/transactions — a normalised ledger row.
 */
type TxRow = {
  id: string;
  kind: "deposit" | "withdrawal" | "trade" | "payout" | "hold" | "release" | "fee" | "other";
  label: string;
  amount_kobo: number;
  direction: "credit" | "debit";
  status: "completed" | "pending";
  ref: string;
  created_at: string;
  detail: string;
};

function whenWords(iso: string) {
  const age = Date.now() - new Date(iso).getTime();
  if (age < 86_400_000) return "Today";
  if (age < 172_800_000) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

/** Only show rows that represent actual money moving to/from the user — not internal holds/fees. */
function isVisible(row: TxRow) {
  return row.kind !== "hold" && row.kind !== "release" && row.kind !== "fee" && row.kind !== "other";
}

export function RecentTransactions() {
  const { data, loading } = useDashboardData<TxRow[]>("transactions");

  const rows = (Array.isArray(data) ? data : [])
    .filter(isVisible)
    .slice(0, MOST_SHOWN);

  return (
    <Panel>
      <PanelHeading
        title="Recent money"
        sub="Your latest deposits, payouts and withdrawals"
        action={<PanelLink href="/dashboard/transactions">All transactions</PanelLink>}
      />
      {loading ? (
        <RowsSkeleton rows={2} label="Loading your money" className="mt-2 px-5 sm:px-6" />
      ) : rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-body-sm text-ink-muted sm:px-6">
          Nothing yet. Money from your deliveries will show here.
        </p>
      ) : (
        <ul className="mt-2 grid grid-cols-1 divide-y divide-line px-5 pb-2 sm:px-6 lg:grid-cols-2 lg:gap-x-10 lg:divide-y-0">
          {rows.map((row) => {
            const isCredit = row.direction === "credit";
            return (
              <li
                key={row.id}
                className="flex items-center gap-3 py-3.5 lg:border-b lg:border-line lg:[&:nth-last-child(-n+2)]:border-b-0"
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full",
                    isCredit ? "bg-sage-soft" : "bg-amber-soft",
                  )}
                >
                  {isCredit ? (
                    <ArrowDownLeft aria-hidden="true" strokeWidth={1.75} className="size-4 text-green" />
                  ) : (
                    <ArrowUpRight aria-hidden="true" strokeWidth={1.75} className="size-4 text-amber" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink capitalize">
                    {row.label}
                  </span>
                  {row.detail && row.detail !== row.label ? (
                    <span className="block truncate text-body-sm text-ink-muted">{row.detail}</span>
                  ) : (
                    <span className="block truncate text-body-sm text-ink-muted capitalize">{row.kind}</span>
                  )}
                </span>

                <span className="shrink-0 text-right">
                  <span
                    className={cn(
                      "block font-num text-body-sm font-medium",
                      isCredit ? "text-green" : "text-amber",
                    )}
                  >
                    {isCredit ? "+" : "−"}{formatKobo(row.amount_kobo)}
                  </span>
                  <span className="block text-xs text-ink-muted">{whenWords(row.created_at)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
