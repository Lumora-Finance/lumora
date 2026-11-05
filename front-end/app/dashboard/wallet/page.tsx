"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, Wallet as WalletIcon, Plus, ChevronUp,
  CheckCircle2, History, X,
} from "lucide-react";
import { getAuth } from "firebase/auth";

import app from "@/lib/firebase/config";
import { LogoVideo } from "@/components/dashboard/logo-video";
import { Reveal } from "@/components/motion/reveal";
import { useAuthUser } from "@/components/auth/use-auth-user";
import { cn } from "@/lib/utils";
import { RowsSkeleton } from "@/components/loader/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { trackTask } from "@/lib/loading/progress";
import { FundModal, WithdrawModal } from "@/components/wallet/wallet-modals";

type WalletData = {
  available_kobo: number;
  total_in_kobo: number;
  total_out_kobo: number;
  pending_kobo: number;
  history: WalletTx[];
};

type WalletTx = {
  id: string;
  kind: "funding" | "withdrawal" | "settlement";
  amount_kobo: number;
  status: "completed" | "pending" | "failed";
  label: string;
  created_at: string;
  ref: string;
};

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-sage-soft text-green",
  pending: "bg-amber-soft text-amber",
  failed: "bg-danger/10 text-danger",
};

function formatKobo(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: kobo % 100 ? 2 : 0 })}`;
}

function relDate(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 86_400_000) return "Today";
  if (diff < 172_800_000) return "Yesterday";
  return d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
}

async function getToken() {
  return getAuth(app).currentUser?.getIdToken() ?? null;
}

export default function WalletPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthUser();

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);

  const [modal, setModal] = useState<"fund" | "withdraw" | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const displayName = user?.displayName ?? user?.email?.split("@")[0] ?? "there";
  const firstName = displayName.split(" ")[0];

  // Load wallet data
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setWalletLoading(true);
      const finished = trackTask("wallet");
      try {
        const token = await getToken();
        const res = await fetch("/api/wallet", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = (await res.json()) as WalletData;
          if (!cancelled) setWallet(data);
        }
      } catch {
        // Wallet data fails silently — show zero balances
      } finally {
        finished();
        if (!cancelled) setWalletLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const available = wallet?.available_kobo ?? 0;
  const totalIn = wallet?.total_in_kobo ?? 0;
  const totalOut = wallet?.total_out_kobo ?? 0;
  const pending = wallet?.pending_kobo ?? 0;
  const history = wallet?.history ?? [];

  function announce(message: string) {
    setSuccess(message);
    window.setTimeout(() => setSuccess(null), 5000);
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-6 lg:px-8">

      {/* Hero */}
      <div
        ref={heroRef}
        data-rhythm="field"
        className="relative isolate mb-8 overflow-hidden rounded-2xl bg-field px-6 py-8 text-paper md:px-8 md:py-10 lg:px-12 lg:py-14"
      >
        <LogoVideo />

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

        {/* Balance card */}
        <div className="mt-8 overflow-hidden rounded-[24px_8px_24px_8px] border border-sage/15 bg-gradient-to-br from-sage/10 via-field-soft/40 to-field-soft/10 p-6 md:p-8">
          <p className="text-body-sm font-medium text-sage/50">Available balance</p>
          {walletLoading ? (
            <Skeleton aria-label="Checking your balance" className="mt-3 h-11 w-52" />
          ) : (
            <p className="mt-3 font-num text-[2.4rem] font-medium leading-none tracking-tight text-paper md:text-[3rem]">
              {formatKobo(available)}
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <p className="font-num text-label text-sage/40">TOTAL IN</p>
              <p className="mt-0.5 font-num text-body-sm font-medium text-sage">{formatKobo(totalIn)}</p>
            </div>
            <div>
              <p className="font-num text-label text-sage/40">TOTAL OUT</p>
              <p className="mt-0.5 font-num text-body-sm font-medium text-amber">{formatKobo(totalOut)}</p>
            </div>
            {pending > 0 && (
              <div>
                <p className="font-num text-label text-sage/40">PENDING</p>
                <p className="mt-0.5 font-num text-body-sm font-medium text-paper/70">{formatKobo(pending)}</p>
              </div>
            )}
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setModal("fund")}
              className="flex items-center justify-center gap-2 rounded-xl bg-amber px-6 py-3 text-body font-medium text-ink transition-all duration-200 hover:bg-amber/90 hover:shadow-lg hover:shadow-amber/20"
            >
              <Plus strokeWidth={2} className="size-4" /> Add funds
            </button>
            <button
              type="button"
              onClick={() => setModal("withdraw")}
              className="flex items-center justify-center gap-2 rounded-xl border border-sage/25 bg-field-soft/40 px-6 py-3 text-body font-medium text-paper transition-all duration-200 hover:bg-field-soft hover:border-sage/40"
            >
              <ChevronUp strokeWidth={2} className="size-4" /> Withdraw
            </button>
          </div>
        </div>
      </div>

      {/* Banners */}
      {success && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-success/30 bg-sage-soft/50 px-4 py-3.5">
          <CheckCircle2 strokeWidth={1.5} className="size-5 shrink-0 text-success" />
          <p className="flex-1 text-body-sm text-ink">{success}</p>
          <button onClick={() => setSuccess(null)} className="text-ink-muted hover:text-ink"><X className="size-4" /></button>
        </div>
      )}

      {/* Transaction history */}
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
            {!walletLoading && (totalIn > 0 || totalOut > 0) && (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-lg bg-sage-soft px-3 py-1.5 font-num text-body-sm font-medium text-green">
                  <ArrowDownLeft strokeWidth={2} className="size-3.5" /> +{formatKobo(totalIn)}
                </span>
                <span className="flex items-center gap-1.5 rounded-lg bg-amber-soft px-3 py-1.5 font-num text-body-sm font-medium text-amber">
                  <ArrowUpRight strokeWidth={2} className="size-3.5" /> −{formatKobo(totalOut)}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 p-3">
            {walletLoading ? (
              <RowsSkeleton rows={3} label="Loading your history" className="px-5" />
            ) : history.length === 0 ? (
              <p className="py-8 text-center text-body-sm text-ink-muted">No wallet activity yet.</p>
            ) : (
              history.map((tx) => {
                const isIn = tx.amount_kobo > 0;
                return (
                  <div key={tx.id} className="flex items-center gap-4 rounded-lg bg-paper px-4 py-3.5 transition-all hover:shadow-sm hover:-translate-y-px">
                    <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", isIn ? "bg-sage-soft" : "bg-amber-soft")}>
                      {isIn ? <ArrowDownLeft strokeWidth={2} className="size-4 text-green" /> : <ArrowUpRight strokeWidth={2} className="size-4 text-amber" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink capitalize">{tx.kind}</p>
                      <p className="truncate text-body-sm text-ink-muted">{tx.label}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={cn("font-num text-number font-medium", isIn ? "text-green" : "text-amber")}>
                        {isIn ? "+" : "−"}{formatKobo(Math.abs(tx.amount_kobo))}
                      </p>
                      <div className="mt-1 flex items-center justify-end gap-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-label font-medium capitalize", STATUS_STYLE[tx.status] ?? "bg-line text-ink-muted")}>{tx.status}</span>
                        <span className="font-num text-label text-ink-muted">{relDate(tx.created_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Reveal>

      <FundModal open={modal === "fund"} onClose={() => setModal(null)} email={user?.email ?? ""} onDone={announce} />
      <WithdrawModal
        open={modal === "withdraw"}
        onClose={() => setModal(null)}
        availableKobo={wallet ? wallet.available_kobo : null}
        onDone={announce}
      />
    </div>
  );
}
