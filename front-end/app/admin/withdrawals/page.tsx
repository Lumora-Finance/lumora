"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle, Banknote, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import { getAuth } from "firebase/auth";

import app from "@/lib/firebase/config";
import { formatKobo } from "@/lib/money/rules";
import { RowsSkeleton } from "@/components/loader/skeletons";

// ─── Types ──────────────────────────────────────────────────────────────────

type WStatus = "pending" | "approved" | "rejected" | "paid";

type WRequest = {
  id: string;
  user_id: string;
  amount_kobo: number;
  fee_kobo: number;
  net_kobo: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: WStatus;
  admin_note: string | null;
  requested_at: string;
  resolved_at: string | null;
  user: { id: string; name: string; phone: string; area: string | null } | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TABS: { value: WStatus | "all"; label: string }[] = [
  { value: "pending",  label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "paid",     label: "Paid" },
  { value: "all",      label: "All" },
];

const STATUS_CHIP: Record<WStatus, string> = {
  pending:  "bg-amber-50  text-amber-700  border-amber-200",
  approved: "bg-blue-50   text-blue-700   border-blue-200",
  rejected: "bg-red-50    text-red-700    border-red-200",
  paid:     "bg-green-50  text-green-700  border-green-200",
};

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

async function authToken(): Promise<string> {
  const tok = await getAuth(app).currentUser?.getIdToken();
  if (!tok) throw new Error("Not signed in");
  return tok;
}

// ─── Card ────────────────────────────────────────────────────────────────────

function WithdrawalCard({ wr, onDone }: { wr: WRequest; onDone: () => void }) {
  const [busy, setBusy]   = useState(false);
  const [err,  setErr]    = useState<string | null>(null);
  const [note, setNote]   = useState("");
  const [mode, setMode]   = useState<"idle" | "reject">("idle");

  // Fee breakdown — fall back to computing if columns are zero
  const gross = wr.amount_kobo;
  const fee   = wr.fee_kobo > 0 ? wr.fee_kobo  : Math.floor(gross * 0.015);
  const net   = wr.net_kobo > 0 ? wr.net_kobo  : gross - fee;

  async function doAction(act: "approved" | "rejected" | "paid", adminNote?: string) {
    setBusy(true);
    setErr(null);
    try {
      const tok = await authToken();
      const res = await fetch("/api/admin/withdrawals", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: wr.id, action: act, admin_note: adminNote ?? null }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (json.ok) {
        onDone();
      } else {
        setErr(json.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setErr("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="font-semibold text-ink">{wr.user?.name ?? "Unknown user"}</p>
          <p className="mt-0.5 font-num text-body-sm text-ink-muted">
            {wr.user?.phone}
            {wr.user?.area ? ` · ${wr.user.area}` : ""}
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 font-num text-label font-medium uppercase tracking-wide ${STATUS_CHIP[wr.status]}`}>
          {wr.status}
        </span>
      </div>

      {/* Fee breakdown — always visible */}
      <div className="grid grid-cols-3 divide-x divide-line border-b border-line text-center">
        <div className="px-4 py-3">
          <p className="text-label text-ink-muted">Requested</p>
          <p className="mt-0.5 font-num text-body font-semibold text-ink">{formatKobo(gross)}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-label text-ink-muted">Fee (1.5%)</p>
          <p className="mt-0.5 font-num text-body font-medium text-amber-700">−{formatKobo(fee)}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-label text-ink-muted">Send to user</p>
          <p className="mt-0.5 font-num text-body font-bold text-green">{formatKobo(net)}</p>
        </div>
      </div>

      {/* Bank details */}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 border-b border-line px-5 py-4 sm:grid-cols-3">
        <div>
          <dt className="text-label text-ink-muted">Bank</dt>
          <dd className="font-num text-body-sm font-medium text-ink">{wr.bank_name}</dd>
        </div>
        <div>
          <dt className="text-label text-ink-muted">Account number</dt>
          <dd className="font-num text-body-sm font-bold tracking-widest text-ink">{wr.account_number}</dd>
        </div>
        <div>
          <dt className="text-label text-ink-muted">Account name</dt>
          <dd className="font-num text-body-sm font-medium text-ink">{wr.account_name}</dd>
        </div>
      </dl>

      {/* Meta */}
      <div className="flex flex-wrap gap-4 px-5 py-3 text-label text-ink-muted">
        <span className="flex items-center gap-1.5">
          <Clock strokeWidth={1.5} className="size-3.5 shrink-0" />
          Requested {fmtDate(wr.requested_at)}
        </span>
        {wr.resolved_at && (
          <span className="flex items-center gap-1.5">
            <CheckCircle2 strokeWidth={1.5} className="size-3.5 shrink-0 text-green" />
            Resolved {fmtDate(wr.resolved_at)}
          </span>
        )}
      </div>
      {wr.admin_note && (
        <p className="border-t border-line px-5 py-2.5 text-body-sm text-ink-muted">
          <span className="font-medium text-ink">Note: </span>{wr.admin_note}
        </p>
      )}

      {/* ── Actions: pending ── */}
      {wr.status === "pending" && (
        <div className="space-y-3 border-t border-line bg-paper px-5 py-4">

          {/* Instruction banner */}
          <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-3 text-body-sm text-blue-800">
            <AlertTriangle strokeWidth={1.75} className="mt-px size-4 shrink-0 text-blue-500" />
            <span>
              Transfer <strong className="font-num">{formatKobo(net)}</strong> to{" "}
              <strong>{wr.account_name}</strong> at <strong>{wr.bank_name}</strong> ({wr.account_number})
              from your bank first, then click <strong>Approve</strong>.
              To decline and refund the full amount click <strong>Reject</strong>.
            </span>
          </div>

          {mode === "idle" && (
            <div className="flex flex-wrap gap-2">
              <button
                disabled={busy}
                onClick={() => void doAction("approved")}
                className="flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 font-num text-body-sm font-medium text-paper transition-colors hover:bg-green-hover disabled:opacity-50"
              >
                <CheckCircle2 strokeWidth={2} className="size-4" />
                Approve — I have sent {formatKobo(net)}
              </button>
              <button
                disabled={busy}
                onClick={() => setMode("reject")}
                className="flex items-center gap-2 rounded-xl border border-danger/40 bg-danger/5 px-5 py-2.5 font-num text-body-sm font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
              >
                <XCircle strokeWidth={2} className="size-4" />
                Reject &amp; refund user
              </button>
            </div>
          )}

          {mode === "reject" && (
            <div className="space-y-3 rounded-xl border border-danger/20 bg-danger/5 p-4">
              <p className="text-body-sm font-medium text-danger">
                Rejecting will refund <strong className="font-num">{formatKobo(gross)}</strong> back to the
                user&apos;s Lumora wallet. They will be told their money will appear within 3 business days.
              </p>
              <div className="flex flex-col gap-1">
                <label className="text-label font-medium text-ink">
                  Reason (optional — shown to user)
                </label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Bank details could not be verified"
                  className="rounded-xl border border-line bg-white px-4 py-2.5 text-body-sm text-ink outline-none transition-[border-color,box-shadow] focus:border-danger focus:ring-3 focus:ring-danger/20"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={busy}
                  onClick={() => void doAction("rejected", note.trim() || undefined)}
                  className="flex items-center gap-2 rounded-xl bg-danger px-5 py-2.5 font-num text-body-sm font-medium text-paper transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  <XCircle strokeWidth={2} className="size-4" />
                  Confirm rejection &amp; refund
                </button>
                <button
                  disabled={busy}
                  onClick={() => { setMode("idle"); setNote(""); }}
                  className="rounded-xl border border-line px-5 py-2.5 font-num text-body-sm font-medium text-ink-muted transition-colors hover:border-ink-muted/50 hover:text-ink disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {err && (
            <p role="alert" className="flex items-center gap-1.5 text-body-sm text-danger">
              <AlertTriangle strokeWidth={1.75} className="size-4 shrink-0" />
              {err}
            </p>
          )}
        </div>
      )}

      {/* ── Actions: approved → mark paid ── */}
      {wr.status === "approved" && (
        <div className="space-y-3 border-t border-line bg-paper px-5 py-4">
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-3 text-body-sm text-amber-800">
            <Banknote strokeWidth={1.75} className="mt-px size-4 shrink-0 text-amber-500" />
            <span>
              You approved this withdrawal. Once you confirm the user received{" "}
              <strong className="font-num">{formatKobo(net)}</strong>, click <strong>Mark as paid</strong>.
            </span>
          </div>
          <button
            disabled={busy}
            onClick={() => void doAction("paid")}
            className="flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 font-num text-body-sm font-medium text-paper transition-colors hover:bg-green-hover disabled:opacity-50"
          >
            <CheckCircle2 strokeWidth={2} className="size-4" />
            Mark as paid
          </button>
          {err && (
            <p role="alert" className="flex items-center gap-1.5 text-body-sm text-danger">
              <AlertTriangle strokeWidth={1.75} className="size-4 shrink-0" />
              {err}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WithdrawalsPage() {
  const [tab,     setTab]     = useState<WStatus | "all">("pending");
  const [rows,    setRows]    = useState<WRequest[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState<string | null>(null);
  const [denied,  setDenied]  = useState(false);

  const load = useCallback(async () => {
    setRows(null);
    setLoading(true);
    setErr(null);
    setDenied(false);
    try {
      const tok = await authToken();
      const res = await fetch(`/api/admin/withdrawals?status=${tab}`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (res.status === 401 || res.status === 403) { setDenied(true); return; }
      if (!res.ok) { setErr("Failed to load. Please refresh."); return; }
      setRows((await res.json()) as WRequest[]);
    } catch {
      setErr("Network error. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { void load(); }, [load]);

  const pendingTotal = (rows ?? [])
    .filter((r) => r.status === "pending")
    .reduce((s, r) => s + r.amount_kobo, 0);

  return (
    <main className="mx-auto max-w-[960px] px-4 py-8 md:px-6">

      {/* ── Header ── */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-ink">Withdrawal Requests</h1>
          <p className="mt-0.5 text-body-sm text-ink-muted">
            Review each request, send the money manually, then approve or reject.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-label font-medium text-ink-muted transition-colors hover:border-green hover:text-green"
        >
          <RefreshCw strokeWidth={1.5} className="size-4" />
          Refresh
        </button>
      </div>

      {/* ── Pending banner ── */}
      {tab === "pending" && !loading && (rows?.length ?? 0) > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3.5">
          <Banknote strokeWidth={1.5} className="size-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800">
              {rows!.length} pending request{rows!.length !== 1 ? "s" : ""} —{" "}
              <span className="font-num">{formatKobo(pendingTotal)}</span> total requested
            </p>
            <p className="text-label text-amber-700">
              Send each net amount manually, then click Approve to confirm.
            </p>
          </div>
        </div>
      )}

      {/* ── Tab filter ── */}
      <div className="mb-6 flex flex-wrap gap-1 rounded-xl border border-line bg-white p-1 shadow-sm">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`rounded-lg px-3 py-1.5 font-num text-label font-medium transition-colors ${
              tab === value
                ? "bg-field text-paper shadow-sm"
                : "text-ink-muted hover:bg-sage-soft hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          <RowsSkeleton rows={4} className="px-5" />
        </div>
      ) : denied ? (
        <div className="rounded-2xl border border-danger/20 bg-danger/5 p-10 text-center">
          <p className="font-medium text-danger">Admin access required.</p>
        </div>
      ) : err ? (
        <div className="rounded-2xl border border-danger/20 bg-danger/5 p-10 text-center">
          <p className="font-medium text-danger">{err}</p>
          <button onClick={() => void load()} className="mt-3 text-body-sm text-ink-muted underline hover:text-ink">
            Try again
          </button>
        </div>
      ) : (rows?.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-line bg-white px-5 py-16 text-center shadow-sm">
          <CheckCircle2 strokeWidth={1.25} className="mx-auto mb-3 size-10 text-green/30" />
          <p className="font-medium text-ink">No {tab === "all" ? "" : tab + " "}withdrawal requests</p>
          <p className="mt-1 text-body-sm text-ink-muted">Nothing to action right now.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {rows!.map((wr) => (
            <WithdrawalCard key={wr.id} wr={wr} onDone={load} />
          ))}
        </ul>
      )}
    </main>
  );
}
