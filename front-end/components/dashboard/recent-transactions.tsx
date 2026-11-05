"use client";

import { ArrowDownLeft } from "lucide-react";

import type { DashboardSettlement } from "@/lib/dashboard-data";
import { useDashboardData } from "@/lib/hooks/use-dashboard-data";
import { formatKobo } from "@/lib/money/rules";

import { Panel, PanelHeading, PanelLink } from "./panel";

const MOST_SHOWN = 4;

function whenWords(iso: string) {
  const age = Date.now() - new Date(iso).getTime();
  if (age < 86_400_000) return "Today";
  if (age < 172_800_000) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
}

export function RecentTransactions() {
  const { data, loading } = useDashboardData<DashboardSettlement[]>("transactions");
  const rows = (Array.isArray(data) ? data : []).slice(0, MOST_SHOWN);

  return (
    <Panel>
      <PanelHeading title="Recent money" sub="Your settled deliveries" action={<PanelLink href="/dashboard/transactions">All transactions</PanelLink>} />
      {loading ? (
        <p className="px-5 py-8 text-center text-ink-muted sm:px-6">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-body-sm text-ink-muted sm:px-6">Nothing yet. Money from your deliveries will show here.</p>
      ) : (
        <ul className="mt-2 grid grid-cols-1 divide-y divide-line px-5 pb-2 sm:px-6 lg:grid-cols-2 lg:gap-x-10 lg:divide-y-0">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 py-3.5 lg:border-b lg:border-line lg:[&:nth-last-child(-n+2)]:border-b-0">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-paper text-ink">
                <ArrowDownLeft aria-hidden="true" strokeWidth={1.75} className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">{row.booking?.slot?.listing?.commodity?.name ?? "Produce"}</span>
                <span className="block truncate text-body-sm text-ink-muted">From {row.booking?.slot?.listing?.buyer?.name ?? "your buyer"}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-num text-body-sm font-medium text-ink">+{formatKobo(row.net_kobo)}</span>
                <span className="block text-xs text-ink-muted">{whenWords(row.created_at)}</span>
                {row.fees_kobo > 0 && <span className="block text-xs text-ink-muted">{formatKobo(row.fees_kobo)} fee</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
