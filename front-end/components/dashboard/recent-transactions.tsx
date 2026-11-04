"use client";

import { ArrowDownLeft, ArrowUpRight, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

type Tx = {
  id: string;
  type: "received" | "paid";
  commodity: string;
  counterparty: string;
  amount: string;
  fee?: string;
  date: string;
  status: "settled" | "pending";
};

const TXS: Tx[] = [
  {
    id: "1",
    type: "received",
    commodity: "Live Broilers",
    counterparty: "Rayfield Restaurant",
    amount: "₦323,400",
    date: "Today, 2:15pm",
    status: "settled",
  },
  {
    id: "2",
    type: "paid",
    commodity: "Tomatoes",
    counterparty: "Barkin Ladi Farm",
    amount: "₦63,750",
    fee: "₦956 fee",
    date: "Yesterday",
    status: "settled",
  },
  {
    id: "3",
    type: "received",
    commodity: "Eggs",
    counterparty: "Grand Hotel Jos",
    amount: "₦126,000",
    date: "Mon, Nov 4",
    status: "settled",
  },
  {
    id: "4",
    type: "paid",
    commodity: "Live Broilers",
    counterparty: "Bukuru Farms Coop",
    amount: "₦455,000",
    fee: "₦6,825 fee",
    date: "Sun, Nov 3",
    status: "settled",
  },
];

export function RecentTransactions() {
  const totalReceived = "₦449,400";
  const totalPaid = "₦518,750";

  return (
    <div className="rounded-xl border border-line bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h2 className="text-heading font-medium text-ink">Recent Transactions</h2>
          <p className="mt-0.5 text-body-sm text-ink-muted">Last 30 days</p>
        </div>

        {/* Summary chips */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-lg bg-sage-soft px-2.5 py-1.5 font-num text-body-sm font-medium text-green">
            <ArrowDownLeft strokeWidth={2} className="size-3.5" />
            {totalReceived}
          </span>
          <span className="flex items-center gap-1.5 rounded-lg bg-amber-soft px-2.5 py-1.5 font-num text-body-sm font-medium text-amber">
            <ArrowUpRight strokeWidth={2} className="size-3.5" />
            {totalPaid}
          </span>
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-2 p-3">
        {TXS.map((tx, index) => {
          const isIn = tx.type === "received";
          // Shape 7: alternating trapezoid rows
          const isOdd = index % 2 === 1;
          return (
            <div
              key={tx.id}
              className="flex items-center gap-4 bg-paper px-5 py-3.5 transition-all hover:shadow-sm hover:-translate-y-px"
              style={{
                clipPath: isOdd
                  ? "polygon(0 0, 100% 0, 100% 100%, 8px 100%, 0 calc(100% - 8px))"
                  : "polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)",
              }}
            >
              {/* Direction icon */}
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full",
                  isIn ? "bg-sage-soft" : "bg-amber-soft",
                )}
              >
                {isIn ? (
                  <ArrowDownLeft strokeWidth={2} className="size-4 text-green" />
                ) : (
                  <ArrowUpRight strokeWidth={2} className="size-4 text-amber" />
                )}
              </div>

              {/* Detail */}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{tx.commodity}</p>
                <p className="text-body-sm text-ink-muted">
                  {isIn ? "From" : "To"} {tx.counterparty}
                </p>
              </div>

              {/* Amount + date */}
              <div className="text-right shrink-0">
                <p
                  className={cn(
                    "font-num text-number font-medium",
                    isIn ? "text-green" : "text-amber",
                  )}
                >
                  {isIn ? "+" : "−"}{tx.amount}
                </p>
                <div className="mt-0.5 flex items-center justify-end gap-1.5">
                  {tx.status === "settled" && (
                    <CheckCircle2 strokeWidth={2} className="size-3 text-success" />
                  )}
                  <p className="text-label text-ink-muted">{tx.date}</p>
                </div>
                {tx.fee && (
                  <p className="font-num text-label text-ink-muted">{tx.fee}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-line px-5 py-3">
        <button className="text-body-sm font-medium text-green hover:underline">
          View all transactions →
        </button>
      </div>
    </div>
  );
}
