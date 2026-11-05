"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, Wallet as WalletIcon, Plus, ChevronUp,
  CreditCard, Banknote, AlertCircle, CheckCircle2, Loader2, History, X,
} from "lucide-react";

import { Reveal } from "@/components/motion/reveal";
import { fx, playOnEnter, useGSAP } from "@/lib/gsap/effects";
import { useAuthUser } from "@/components/auth/use-auth-user";
import { cn } from "@/lib/utils";

type Tx = {
  id: string;
  type: "funding" | "withdrawal" | "settlement";
  amount: number;
  status: "completed" | "pending" | "failed";
  method: string;
  date: string;
  ref: string;
};

const TXS: Tx[] = [
  { id: "1", type: "settlement", amount: 323400, status: "completed", method: "Broiler delivery", date: "Today, 2:15pm", ref: "FLW-4821" },
  { id: "2", type: "funding", amount: 50000, status: "completed", method: "Card · ending 4242", date: "Yesterday, 4:30pm", ref: "FLW-9912" },
  { id: "3", type: "withdrawal", amount: -120000, status: "pending", method: "Bank · GTBank ····7891", date: "Today, 9:00am", ref: "FLW-3344" },
  { id: "4", type: "settlement", amount: 126000, status: "completed", method: "Eggs delivery", date: "Mon, Nov 4", ref: "FLW-4802" },
  { id: "5", type: "withdrawal", amount: -80000, status: "completed", method: "Bank · Access ····2345", date: "Sun, Nov 3", ref: "FLW-3201" },
];

const CROPS = [
  { src: "/images/step-scale.jpg", pos: "object-[50%_40%]", cls: "absolute top-6 right-12 size-16 hidden sm:block" },
  { src: "/images/hero-farm.jpg", pos: "object-[52%_25%]", cls: "absolute bottom-6 right-6 size-14" },
];

const STATUS_STYLE: Record<Tx["status"], string> = {
  completed: "bg-sage-soft text-green",
  pending: "bg-amber-soft text-amber",
  failed: "bg-danger/10 text-danger",
};

export default function WalletPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const balanceRef = useRef<HTMLParagraphElement>(null);
  const { user } = useAuthUser();
  const [fundOpen, setFundOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [funding, setFunding] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fundAmount, setFundAmount] = useState("");
  const [fundMethod, setFundMethod] = useState<"card" | "bank">("card");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const displayName = user?.displayName ?? user?.email?.split("@")[0] ?? "there";
  const firstName = displayName.split(" ")[0];

  useGSAP(
    () => {
      const root = heroRef.current;
      if (!root) return;
      playOnEnter(fx("ledgerDraw", root.querySelectorAll("[data-ledger]")), root, "top 90%");
      playOnEnter(fx("chipPop", root.querySelectorAll("[data-chip]"), { stagger: 0.12 }), root, "top 85%");
      if (balanceRef.current) {
        playOnEnter(fx("countUp", balanceRef.current, { to: 449400, format: "naira" }), root, "top 85%");
      }
      fx("floatDrift", root.querySelectorAll("[data-crop]"));
    },
    { scope: heroRef },
  );

  async function handleFund() {
    const amount = parseFloat(fundAmount);
    if (!amount || amount < 100) { setError("Minimum funding amount is ₦100"); return; }
    setFunding(true); setError(null);
    try {
      const res = await fetch("/api/wallet/fund", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount, method: fundMethod }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Funding failed");
      setSuccess(`₦${amount.toLocaleString()} added to your wallet`);
      setFundAmount(""); setFundOpen(false);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) { setError(err instanceof Error ? err.message : "Funding failed"); }
    finally { setFunding(false); }
  }

  async function handleWithdraw() {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount < 500) { setError("Minimum withdrawal is ₦500"); return; }
    if (!bankName || !accountNumber || !accountName) { setError("Fill in all bank details"); return; }
    setWithdrawing(true); setError(null);
    try {
      const res = await fetch("/api/wallet/withdraw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount, bankName, accountNumber, accountName }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Withdrawal failed");
      setSuccess(`Withdrawal of ₦${amount.toLocaleString()} initiated. You'll receive it within 24 hours.`);
      setWithdrawAmount(""); setBankName(""); setAccountNumber(""); setAccountName(""); setWithdrawOpen(false);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) { setError(err instanceof Error ? err.message : "Withdrawal failed"); }
    finally { setWithdrawing(false); }
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-6 lg:px-8">

      {/* ── Hero with balance card ──────────────────────────── */}
      <div
        ref={heroRef}
        data-rhythm="field"
        className="relative isolate mb-8 overflow-hidden rounded-2xl bg-field px-6 py-8 text-paper md:px-8 md:py-10 lg:px-12 lg:py-14"
      >
        {/* Ledger decoration */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 flex flex-col justify-center gap-12 px-8">
          <span data-ledger aria-hidden className="h-px w-full bg-sage/12" />
          <span data-ledger aria-hidden className="h-px w-[68%] bg-sage/8" />
          <span data-ledger aria-hidden className="h-px w-[40%] bg-sage/6" />
        </div>

        {/* Floating crops */}
        {CROPS.map((c, i) => (
          <div key={i} data-crop aria-hidden className={cn("overflow-hidden rounded-full", c.cls)}>
            <Image src={c.src} alt="" width={120} height={120} className={cn("size-full object-cover", c.pos)} />
          </div>
        ))}

        {/* Header row */}
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-sage/15">
            <WalletIcon strokeWidth={1.5} className="size-5 text-sage" />
          </div>
          <div>
            <p className="text-label font-medium text-sage/60">Lumora Wallet</p>
            <h1 className="font-display text-[1.6rem] font-medium leading-tight text-paper md:text-[2rem]">
              Hello, {firstName}
            </h1>
          </div>
        </div>

        {/* Balance card — the centerpiece */}
        <div
          data-chip
          className="mt-8 overflow-hidden rounded-[24px_8px_24px_8px] border border-sage/15 bg-gradient-to-br from-sage/10 via-field-soft/40 to-field-soft/10 p-6 md:p-8 backdrop-blur-sm"
        >
          <p className="text-body-sm font-medium text-sage/50">Available balance</p>
          <p ref={balanceRef} className="mt-3 font-num text-[2.4rem] font-medium leading-none tracking-tight text-paper md:text-[3rem]">
            ₦449,400
          </p>

          {/* Quick stats row */}
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <p className="font-num text-label text-sage/40">TOTAL IN</p>
              <p className="mt-0.5 font-num text-body-sm font-medium text-sage">₦899,400</p>
            </div>
            <div>
              <p className="font-num text-label text-sage/40">TOTAL OUT</p>
              <p className="mt-0.5 font-num text-body-sm font-medium text-amber">₦200,000</p>
            </div>
            <div>
              <p className="font-num text-label text-sage/40">PENDING</p>
              <p className="mt-0.5 font-num text-body-sm font-medium text-paper/70">₦120,000</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => { setFundOpen(true); setWithdrawOpen(false); setError(null); }}
              className="flex items-center justify-center gap-2 rounded-xl bg-amber px-6 py-3 text-body font-medium text-ink transition-all duration-200 hover:bg-amber/90 hover:shadow-lg hover:shadow-amber/20"
            >
              <Plus strokeWidth={2} className="size-4" />
              Add funds
            </button>
            <button
              onClick={() => { setWithdrawOpen(true); setFundOpen(false); setError(null); }}
              className="flex items-center justify-center gap-2 rounded-xl border border-sage/25 bg-field-soft/40 px-6 py-3 text-body font-medium text-paper transition-all duration-200 hover:bg-field-soft hover:border-sage/40"
            >
              <ChevronUp strokeWidth={2} className="size-4" />
              Withdraw
            </button>
          </div>
        </div>
      </div>

      {/* ── Success / error banners ─────────────────────────── */}
      {success && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-success/30 bg-sage-soft/50 px-4 py-3.5" style={{ animation: "slide-down 250ms cubic-bezier(0.22,1,0.36,1) both" }}>
          <CheckCircle2 strokeWidth={1.5} className="size-5 shrink-0 text-success" />
          <p className="flex-1 text-body-sm text-ink">{success}</p>
          <button onClick={() => setSuccess(null)} className="text-ink-muted hover:text-ink"><X className="size-4" /></button>
        </div>
      )}
      {error && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3.5" style={{ animation: "slide-down 250ms cubic-bezier(0.22,1,0.36,1) both" }}>
          <AlertCircle strokeWidth={1.5} className="size-5 shrink-0 text-danger" />
          <p className="flex-1 text-body-sm text-ink">{error}</p>
          <button onClick={() => setError(null)} className="text-ink-muted hover:text-ink"><X className="size-4" /></button>
        </div>
      )}

      {/* ── Fund form ────────────────────────────────────────── */}
      {fundOpen && (
        <div className="mb-6 overflow-hidden rounded-xl border border-line bg-white shadow-sm" style={{ animation: "expand-down 300ms cubic-bezier(0.22,1,0.36,1) both" }}>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h2 className="text-heading font-medium text-ink">Add funds</h2>
              <p className="mt-0.5 text-body-sm text-ink-muted">Available immediately after payment</p>
            </div>
            <button onClick={() => setFundOpen(false)} className="flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-sage-soft hover:text-ink"><X className="size-4" /></button>
          </div>
          <div className="flex flex-col gap-5 p-5">
            <div>
              <label className="mb-2 block text-body-sm font-medium text-ink">Amount (₦)</label>
              <input
                type="number"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full rounded-xl border border-line bg-paper px-4 py-3 font-num text-[1.1rem] text-ink placeholder-ink-muted outline-none transition-all duration-200 focus:border-green focus:ring-3 focus:ring-green/20"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {[1000, 5000, 10000, 50000].map((amt) => (
                  <button key={amt} onClick={() => setFundAmount(amt.toString())} className="rounded-full border border-line px-3.5 py-1.5 text-label font-medium text-ink-muted transition-all hover:border-green hover:text-green">
                    ₦{amt.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-2.5 block text-body-sm font-medium text-ink">Payment method</label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setFundMethod("card")} className={cn("flex items-center gap-3 rounded-xl border p-4 transition-all duration-200", fundMethod === "card" ? "border-green bg-sage-soft shadow-sm" : "border-line hover:border-green hover:bg-sage-soft/30")}>
                  <CreditCard strokeWidth={1.5} className={cn("size-5 transition-colors", fundMethod === "card" ? "text-green" : "text-ink-muted")} />
                  <div className="text-left"><p className="text-body-sm font-medium text-ink">Card</p><p className="text-label text-ink-muted">Visa, Mastercard</p></div>
                </button>
                <button onClick={() => setFundMethod("bank")} className={cn("flex items-center gap-3 rounded-xl border p-4 transition-all duration-200", fundMethod === "bank" ? "border-green bg-sage-soft shadow-sm" : "border-line hover:border-green hover:bg-sage-soft/30")}>
                  <Banknote strokeWidth={1.5} className={cn("size-5 transition-colors", fundMethod === "bank" ? "text-green" : "text-ink-muted")} />
                  <div className="text-left"><p className="text-body-sm font-medium text-ink">Bank transfer</p><p className="text-label text-ink-muted">Direct deposit</p></div>
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-3 border-t border-line px-5 py-4">
            <button onClick={() => setFundOpen(false)} className="rounded-xl border border-line px-5 py-3 text-body-sm font-medium text-ink-muted transition-colors hover:text-ink">Cancel</button>
            <button onClick={handleFund} disabled={funding} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green py-3 text-body-sm font-medium text-paper transition-all hover:bg-green-hover disabled:opacity-50">
              {funding ? <><Loader2 className="size-4 animate-spin" /> Processing…</> : <><Plus strokeWidth={2} className="size-4" /> Fund wallet</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Withdraw form ───────────────────────────────────── */}
      {withdrawOpen && (
        <div className="mb-6 overflow-hidden rounded-xl border border-line bg-white shadow-sm" style={{ animation: "expand-down 300ms cubic-bezier(0.22,1,0.36,1) both" }}>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h2 className="text-heading font-medium text-ink">Withdraw to bank</h2>
              <p className="mt-0.5 text-body-sm text-ink-muted">Funds arrive within 24 hours</p>
            </div>
            <button onClick={() => setWithdrawOpen(false)} className="flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-sage-soft hover:text-ink"><X className="size-4" /></button>
          </div>
          <div className="flex flex-col gap-5 p-5">
            <div>
              <label className="mb-2 block text-body-sm font-medium text-ink">Amount (₦)</label>
              <input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="e.g. 20000" className="w-full rounded-xl border border-line bg-paper px-4 py-3 font-num text-[1.1rem] text-ink placeholder-ink-muted outline-none transition-all duration-200 focus:border-green focus:ring-3 focus:ring-green/20" />
              <div className="mt-2 flex items-center gap-2">
                <span className="text-label text-ink-muted">Available:</span>
                <span className="font-num text-body-sm font-medium text-green">₦449,400</span>
                <button onClick={() => setWithdrawAmount("449400")} className="rounded-full border border-line px-2.5 py-0.5 text-label font-medium text-ink-muted transition-all hover:border-green hover:text-green">Max</button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-body-sm font-medium text-ink">Bank name</label>
                <select value={bankName} onChange={(e) => setBankName(e.target.value)} className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-body text-ink outline-none transition-all duration-200 focus:border-green focus:ring-3 focus:ring-green/20">
                  <option value="">Select bank</option>
                  <option>GTBank</option><option>Access Bank</option><option>UBA</option><option>Zenith Bank</option><option>First Bank</option><option>Stanbic IBTC</option><option>Opay</option><option>Kuda Bank</option><option>Wema Bank</option><option>Fidelity Bank</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-body-sm font-medium text-ink">Account number</label>
                <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))} placeholder="10-digit number" maxLength={10} className="w-full rounded-xl border border-line bg-paper px-4 py-3 font-num text-body text-ink placeholder-ink-muted outline-none transition-all duration-200 focus:border-green focus:ring-3 focus:ring-green/20" />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-body-sm font-medium text-ink">Account name</label>
              <input type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Name on the account" className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-body text-ink placeholder-ink-muted outline-none transition-all duration-200 focus:border-green focus:ring-3 focus:ring-green/20" />
            </div>
          </div>
          <div className="flex gap-3 border-t border-line px-5 py-4">
            <button onClick={() => setWithdrawOpen(false)} className="rounded-xl border border-line px-5 py-3 text-body-sm font-medium text-ink-muted transition-colors hover:text-ink">Cancel</button>
            <button onClick={handleWithdraw} disabled={withdrawing} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green py-3 text-body-sm font-medium text-paper transition-all hover:bg-green-hover disabled:opacity-50">
              {withdrawing ? <><Loader2 className="size-4 animate-spin" /> Processing…</> : <><ChevronUp strokeWidth={2} className="size-4" /> Withdraw funds</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Transaction history ─────────────────────────────── */}
      <Reveal effect="riseIn">
        <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-heading font-medium text-ink">
                <History strokeWidth={1.5} className="size-4 text-green" />
                Wallet History
              </h2>
              <p className="mt-0.5 text-body-sm text-ink-muted">All funding, withdrawals and settlements</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-lg bg-sage-soft px-3 py-1.5 font-num text-body-sm font-medium text-green">
                <ArrowDownLeft strokeWidth={2} className="size-3.5" /> +₦899,400
              </span>
              <span className="flex items-center gap-1.5 rounded-lg bg-amber-soft px-3 py-1.5 font-num text-body-sm font-medium text-amber">
                <ArrowUpRight strokeWidth={2} className="size-3.5" /> −₦200,000
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 p-3">
            {TXS.map((tx, i) => {
              const isIn = tx.amount > 0;
              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-4 rounded-lg bg-paper px-4 py-3.5 transition-all duration-200 hover:shadow-sm hover:-translate-y-px"
                >
                  <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", isIn ? "bg-sage-soft" : "bg-amber-soft")}>
                    {isIn ? <ArrowDownLeft strokeWidth={2} className="size-4 text-green" /> : <ArrowUpRight strokeWidth={2} className="size-4 text-amber" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink capitalize">{tx.type}</p>
                    <p className="truncate text-body-sm text-ink-muted">{tx.method}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn("font-num text-number font-medium", isIn ? "text-green" : "text-amber")}>
                      {isIn ? "+" : "−"}₦{Math.abs(tx.amount).toLocaleString()}
                    </p>
                    <div className="mt-1 flex items-center justify-end gap-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-label font-medium capitalize", STATUS_STYLE[tx.status])}>{tx.status}</span>
                      <span className="font-num text-label text-ink-muted">{tx.date}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-line px-5 py-3">
            <button className="text-body-sm font-medium text-green hover:underline">View all transactions →</button>
          </div>
        </div>
      </Reveal>

      <style>{`
        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes expand-down {
          from { opacity: 0; transform: translateY(-12px); max-height: 0; }
          to { opacity: 1; transform: translateY(0); max-height: 600px; }
        }
      `}</style>
    </div>
  );
}
