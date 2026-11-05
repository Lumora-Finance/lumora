"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, ChevronDown, ChevronUp, Wallet } from "lucide-react";

import { LogoVideo } from "@/components/dashboard/logo-video";
import { Reveal } from "@/components/motion/reveal";
import { fx, playOnEnter, useGSAP } from "@/lib/gsap/effects";
import { cn } from "@/lib/utils";

type Filter = "all" | "trade" | "wallet" | "received" | "paid";
type Tx = {
  id: string;
  category: "trade" | "wallet";
  type: "received" | "paid";
  label: string;
  counterparty: string;
  amount: number;
  fee?: string;
  date: string;
  status: "settled" | "pending" | "completed" | "failed";
  code: string;
  detail: string;
  method?: string;
};

const TXS: Tx[] = [
  // Trade transactions
  { id: "1", category: "trade", type: "received", label: "Live Broilers", counterparty: "Rayfield Restaurant", amount: 323400, date: "Today, 2:15pm", status: "settled", code: "LM-4821", detail: "92.4 kg × ₦3,500/kg = ₦323,400" },
  { id: "2", category: "trade", type: "paid", label: "Tomatoes", counterparty: "Barkin Ladi Farm", amount: 63750, fee: "₦956 fee", date: "Yesterday", status: "settled", code: "LM-4839", detail: "75 baskets × ₦850/basket = ₦63,750" },
  // Wallet transactions
  { id: "3", category: "wallet", type: "received", label: "Wallet funding", counterparty: "Card · ending 4242", amount: 50000, date: "Yesterday, 4:30pm", status: "completed", code: "FLW-9912", detail: "Flutterwave card payment", method: "Card" },
  { id: "4", category: "wallet", type: "paid", label: "Withdrawal", counterparty: "GTBank ····7891", amount: 120000, date: "Today, 9:00am", status: "pending", code: "FLW-3344", detail: "Bank transfer via Flutterwave", method: "Bank transfer" },
  // Trade
  { id: "5", category: "trade", type: "received", label: "Eggs", counterparty: "Grand Hotel Jos", amount: 126000, date: "Mon, Nov 4", status: "settled", code: "LM-4802", detail: "60 crates × ₦2,100/crate = ₦126,000" },
  // Wallet
  { id: "6", category: "wallet", type: "paid", label: "Withdrawal", counterparty: "Access Bank ····2345", amount: 80000, date: "Sun, Nov 3", status: "completed", code: "FLW-3201", detail: "Bank transfer via Flutterwave", method: "Bank transfer" },
  // Trade
  { id: "7", category: "trade", type: "paid", label: "Live Broilers", counterparty: "Bukuru Farms Coop", amount: 455000, fee: "₦6,825 fee", date: "Sun, Nov 3", status: "settled", code: "LM-4790", detail: "130 kg × ₦3,500/kg = ₦455,000" },
  { id: "8", category: "trade", type: "received", label: "Live Turkey", counterparty: "Hotels Collective", amount: 218400, date: "Fri, Nov 1", status: "settled", code: "LM-4771", detail: "52 kg × ₦4,200/kg = ₦218,400" },
  // Wallet
  { id: "9", category: "wallet", type: "received", label: "Wallet funding", counterparty: "Bank transfer · GTBank", amount: 100000, date: "Fri, Nov 1", status: "completed", code: "FLW-8821", detail: "Flutterwave bank transfer", method: "Bank transfer" },
];

const CROPS = [
  { src: "/images/step-scale.jpg", pos: "object-[50%_40%]", cls: "absolute top-4 right-10 size-14 hidden sm:block" },
  { src: "/images/hero-farm.jpg", pos: "object-[52%_25%]", cls: "absolute bottom-4 right-4 size-12" },
];

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

export default function TransactionsPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const totalRef = useRef<HTMLParagraphElement>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = TXS.filter((tx) => {
    if (filter === "trade") return tx.category === "trade";
    if (filter === "wallet") return tx.category === "wallet";
    if (filter === "received") return tx.type === "received";
    if (filter === "paid") return tx.type === "paid";
    return true;
  });

  useGSAP(
    () => {
      const root = heroRef.current;
      if (!root) return;
      playOnEnter(fx("chipPop", root.querySelectorAll("[data-chip]"), { stagger: 0.1 }), root, "top 85%");
      if (totalRef.current) {
        playOnEnter(fx("countUp", totalRef.current, { to: 842000, format: "naira" }), root, "top 85%");
      }
      fx("floatDrift", root.querySelectorAll("[data-crop]"));
    },
    { scope: heroRef },
  );

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
          <div key={i} data-crop aria-hidden className={cn("overflow-hidden rounded-full", c.cls)}>
            <Image src={c.src} alt="" width={140} height={140} className={cn("size-full object-cover", c.pos)} />
          </div>
        ))}

        <p className="text-label font-medium text-sage/70">Financial Activity</p>
        <h1 className="mt-2 font-display text-display-lg-sm font-medium text-paper md:text-[2rem]">
          Transactions
        </h1>

        <div className="mt-6 flex flex-wrap gap-3">
          <div data-chip className="flex flex-col rounded-[16px_4px_16px_4px] bg-sage/20 px-4 py-3">
            <span className="text-label text-sage/70">Trade received</span>
            <span className="font-num text-number-lg font-medium text-paper">₦667,800</span>
          </div>
          <div data-chip className="flex flex-col rounded-[4px_16px_4px_16px] bg-field-soft/70 px-4 py-3">
            <span className="text-label text-paper/50">Trade paid</span>
            <span className="font-num text-number-lg font-medium text-paper/80">₦518,750</span>
          </div>
          <div data-chip className="flex flex-col rounded-[16px_4px_16px_4px] bg-sage/10 px-4 py-3">
            <span className="text-label text-sage/70 flex items-center gap-1">
              <Wallet strokeWidth={1.5} className="size-3" /> Wallet funded
            </span>
            <span className="font-num text-number-lg font-medium text-paper">₦150,000</span>
          </div>
          <div data-chip className="flex flex-col rounded-[4px_16px_4px_16px] bg-amber/20 px-4 py-3">
            <span className="text-label text-amber/70">Net this month</span>
            <span ref={totalRef} className="font-num text-number-lg font-medium text-amber">₦842,000</span>
          </div>
        </div>
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
      <Reveal effect="riseIn">
        <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
          {filtered.map((tx, i) => {
            const isIn = tx.type === "received";
            const isWallet = tx.category === "wallet";
            const isExpanded = expanded === tx.id;
            return (
              <div key={tx.id} className={cn("border-b border-line last:border-b-0")}>
                <button
                  onClick={() => setExpanded(isExpanded ? null : tx.id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-sage-soft/20"
                >
                  <div className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full",
                    isIn ? "bg-sage-soft" : "bg-amber-soft",
                  )}>
                    {isIn
                      ? <ArrowDownLeft strokeWidth={2} className={cn("size-4", isWallet ? "text-sage" : "text-green")} />
                      : <ArrowUpRight strokeWidth={2} className="size-4 text-amber" />
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-ink">{tx.label}</p>
                      {isWallet && (
                        <span className="rounded-md bg-sage/10 px-1.5 py-0.5 text-label font-medium text-sage">
                          WALLET
                        </span>
                      )}
                    </div>
                    <p className="text-body-sm text-ink-muted">{isIn ? "From" : "To"} {tx.counterparty}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("font-num text-number font-medium", isIn ? "text-green" : "text-amber")}>
                      {isIn ? "+" : "−"}₦{tx.amount.toLocaleString()}
                    </p>
                    <p className="font-num text-label text-ink-muted">{tx.date}</p>
                  </div>
                  <div className="flex size-6 items-center justify-center text-ink-muted">
                    {isExpanded ? <ChevronUp strokeWidth={1.5} className="size-4" /> : <ChevronDown strokeWidth={1.5} className="size-4" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-line bg-sage-soft/20 px-5 py-4">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div>
                        <p className="text-label text-ink-muted">{isWallet ? "Reference" : "Booking code"}</p>
                        <p className="font-num text-body-sm font-medium text-ink">{tx.code}</p>
                      </div>
                      <div>
                        <p className="text-label text-ink-muted">Breakdown</p>
                        <p className="font-num text-body-sm text-ink">{tx.detail}</p>
                      </div>
                      {tx.fee && (
                        <div>
                          <p className="text-label text-ink-muted">Platform fee</p>
                          <p className="font-num text-body-sm text-ink">{tx.fee}</p>
                        </div>
                      )}
                      {tx.method && (
                        <div>
                          <p className="text-label text-ink-muted">Method</p>
                          <p className="text-body-sm text-ink">{tx.method}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-label text-ink-muted">Status</p>
                        <p className={cn("flex items-center gap-1.5 text-body-sm capitalize", STATUS_STYLE[tx.status])}>
                          <CheckCircle2 strokeWidth={2} className="size-3.5" /> {tx.status}
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
    </div>
  );
}
