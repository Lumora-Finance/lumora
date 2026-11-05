"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight,
  CheckCircle2, History, X,
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";

import { getToken } from "@/lib/firebase/auth";
import { Reveal } from "@/components/motion/reveal";
import { useAuthUser } from "@/components/auth/use-auth-user";
import { cn } from "@/lib/utils";
import { RowsSkeleton } from "@/components/loader/skeletons";
import { HILLS_ACTION, HILLS_ACTION_QUIET, HillsCard, HillsStats } from "@/components/profile/hills-card";
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

const FIGURE = "font-num whitespace-nowrap";

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


export default function WalletPage() {
  const { user } = useAuthUser();

  const searchParams = useSearchParams();
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [modal, setModal] = useState<"fund" | "withdraw" | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const reloadRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Paystack redirects back with ?reference=LUMORA-FUND-xxx
  // Verify immediately and credit wallet, then reload balance
  useEffect(() => {
    const ref = searchParams.get("reference") ?? searchParams.get("trxref") ?? "";
    if (!ref.startsWith("LUMORA-FUND-")) return;

    // Clean URL immediately
    router.replace("/dashboard/wallet", { scroll: false });
    setSuccess("Verifying payment…");

    (async () => {
      try {
        const token = await getToken();
        const headers: HeadersInit = {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        // Step 1: verify + credit wallet immediately (idempotent)
        const verifyRes = await fetch("/api/wallet/verify-payment", {
          method: "POST",
          headers,
          body: JSON.stringify({ reference: ref }),
        });
        const verifyData = (await verifyRes.json()) as { ok: boolean; amountKobo?: number; message?: string; duplicate?: boolean };

        // Step 2: reload wallet balance and history
        const walletRes = await fetch("/api/wallet", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (walletRes.ok) setWallet(await walletRes.json());

        if (verifyData.ok) {
          const naira = verifyData.amountKobo ? `₦${(verifyData.amountKobo / 100).toLocaleString("en-NG")}` : "";
          setSuccess(verifyData.duplicate ? "Payment already credited." : `${naira} added to your wallet!`);
        } else {
          setSuccess("Payment received. Balance may take a moment to update.");
        }
      } catch {
        setSuccess("Payment received. Refreshing your balance…");
        // Fallback: try reloading balance after 3s
        reloadRef.current = setTimeout(async () => {
          try {
            const token = await getToken();
            const res = await fetch("/api/wallet", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
            if (res.ok) setWallet(await res.json());
          } catch { /* */ }
        }, 3000);
      }
    })();

    return () => { if (reloadRef.current) clearTimeout(reloadRef.current); };
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

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

      <HillsCard className="mb-8">
        <div className="px-5 pt-24 pb-6 sm:px-10 sm:pt-28 sm:pb-9 lg:px-14 lg:pt-32 lg:pb-11">
          <p data-card="rise" className="text-body-sm font-medium text-ink/70">Lumora wallet</p>
          <h1 data-card="rise" className="mt-1 text-[26px] leading-tight font-medium tracking-tight break-words text-ink sm:text-[34px]">Hello, {firstName}</h1>

          <div data-card="rise" className="mt-5 sm:mt-6">
            <p className="text-body-sm text-ink/70">Available balance</p>
            {walletLoading ? (
              <Skeleton aria-label="Checking your balance" className="mt-1.5 h-11 w-52 max-w-full" />
            ) : (
              <p className="mt-0.5 font-num text-[28px] leading-tight font-medium tracking-tight break-words text-ink min-[400px]:text-[34px] sm:text-[44px]">
                {formatKobo(available)}
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-6 sm:mt-8 lg:flex-row lg:items-center lg:justify-between">
            <HillsStats
              rowsOnPhones
              stats={[
                { value: walletLoading ? null : <span className={FIGURE}>{formatKobo(totalIn)}</span>, label: "total in" },
                { value: walletLoading ? null : <span className={FIGURE}>{formatKobo(totalOut)}</span>, label: "total out" },
                ...(pending > 0 ? [{ value: <span className={FIGURE}>{formatKobo(pending)}</span>, label: "pending" }] : []),
              ]}
            />
            <div data-card="pop" className="flex flex-col gap-3 sm:flex-row lg:shrink-0">
              <button type="button" onClick={() => setModal("fund")} className={HILLS_ACTION}>Add funds</button>
              <button type="button" onClick={() => setModal("withdraw")} className={HILLS_ACTION_QUIET}>Withdraw</button>
            </div>
          </div>
        </div>
      </HillsCard>

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
