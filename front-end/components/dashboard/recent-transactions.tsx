"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { Panel, PanelHeading, PanelLink } from "./panel";

type Tx = {
  id: string;
  received: boolean;
  commodity: string;
  counterparty: string;
  amount: string;
  fee?: string;
  date: string;
};

const TXS: Tx[] = [
  { id: "1", received: true, commodity: "Live broilers", counterparty: "Rayfield Restaurant", amount: "₦323,400", date: "Today, 2:15pm" },
  { id: "2", received: false, commodity: "Tomatoes", counterparty: "Barkin Ladi Farm", amount: "₦63,750", fee: "₦638 fee", date: "Yesterday" },
  { id: "3", received: true, commodity: "Eggs", counterparty: "Grand Hotel Jos", amount: "₦126,000", date: "3 days ago" },
  { id: "4", received: false, commodity: "Live broilers", counterparty: "Bukuru Farms Coop", amount: "₦455,000", fee: "₦4,550 fee", date: "4 days ago" },
];

export function RecentTransactions() {
  return (
    <Panel>
      <PanelHeading title="Recent money" sub="Last 30 days" action={<PanelLink href="/dashboard/transactions">All transactions</PanelLink>} />
      <ul className="mt-2 grid grid-cols-1 divide-y divide-line px-5 pb-2 sm:px-6 lg:grid-cols-2 lg:gap-x-10 lg:divide-y-0">
        {TXS.map((tx) => (
          <li key={tx.id} className="flex items-center gap-3 py-3.5 lg:border-b lg:border-line lg:[&:nth-last-child(-n+2)]:border-b-0">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-paper text-ink">
              {tx.received ? <ArrowDownLeft aria-hidden="true" strokeWidth={1.75} className="size-4" /> : <ArrowUpRight aria-hidden="true" strokeWidth={1.75} className="size-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-ink">{tx.commodity}</span>
              <span className="block truncate text-body-sm text-ink-muted">{tx.received ? "From" : "To"} {tx.counterparty}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-num text-body-sm font-medium text-ink">{tx.received ? "+" : "−"}{tx.amount}</span>
              <span className="block text-xs text-ink-muted">{tx.date}</span>
              {tx.fee && <span className="block text-xs text-ink-muted">{tx.fee}</span>}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
