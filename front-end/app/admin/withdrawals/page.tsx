"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuthUser } from "@/components/auth/use-auth-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatKobo } from "@/lib/money/rules";

// ─── Types ─────────────────────────────────────────────────────────────────

type WithdrawalStatus = "pending" | "approved" | "rejected" | "paid";

type WithdrawalRequest = {
  id: string;
  user_id: string;
  amount_kobo: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: WithdrawalStatus;
  admin_note: string | null;
  requested_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  user: {
    id: string;
    name: string;
    phone: string;
    area: string | null;
  } | null;
};

// ─── Helpers ───────────────────────────────────────────────────────────────

const TAB_LABELS: { value: WithdrawalStatus | "all"; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "paid", label: "Paid" },
  { value: "all", label: "All" },
];

const STATUS_STYLES: Record<WithdrawalStatus, string> = {
  pending: "bg-amber/10 text-amber-700 border-amber/30",
  approved: "bg-green/10 text-green-700 border-green/30",
  rejected: "bg-danger/10 text-danger border-danger/30",
  paid: "bg-sage/10 text-sage-700 border-sage/30",
};

const STATUS_LABELS: Record<WithdrawalStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

// ─── Card ──────────────────────────────────────────────────────────────────

function WithdrawalCard({
  request,
  token,
  onDone,
}: {
  request: WithdrawalRequest;
  token: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [adminNote, setAdminNote] = useState("");

  async function update(status: WithdrawalStatus, note?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: request.id,
          status,
          admin_note: note ?? null,
        }),
      });
      const result = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (result.ok) {
        onDone();
      } else {
        setError(result.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleApprove() {
    setRejectMode(false);
    void update("approved");
  }

  function handleRejectSubmit() {
    void update("rejected", adminNote.trim() || undefined);
  }

  const isPending = request.status === "pending";

  return (
    <li className="rounded-xl border border-line bg-white p-5">
      {/* Header row */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="font-semibold">{request.user?.name ?? "Unknown user"}</p>
          <span className="font-num text-body-sm text-ink-muted">{request.user?.phone}</span>
          {request.user?.area && (
            <span className="text-body-sm text-ink-muted">· {request.user.area}</span>
          )}
        </div>
        <span
          className={`rounded-full border px-2.5 py-0.5 font-num text-label font-medium uppercase tracking-wide ${STATUS_STYLES[request.status]}`}
        >
          {STATUS_LABELS[request.status]}
        </span>
      </div>

      {/* Amount */}
      <p className="mt-3 font-num text-number font-semibold">
        {formatKobo(request.amount_kobo)}
      </p>

      {/* Bank details */}
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-label text-ink-muted">Bank</dt>
          <dd className="font-num text-body-sm font-medium">{request.bank_name}</dd>
        </div>
        <div>
          <dt className="text-label text-ink-muted">Account number</dt>
          <dd className="font-num text-body-sm font-medium tracking-wider">{request.account_number}</dd>
        </div>
        <div>
          <dt className="text-label text-ink-muted">Account name</dt>
          <dd className="font-num text-body-sm font-medium">{request.account_name}</dd>
        </div>
      </dl>

      {/* Dates and notes */}
      <div className="mt-3 flex flex-wrap gap-4 text-label text-ink-muted">
        <span>Requested {formatDate(request.requested_at)}</span>
        {request.resolved_at && (
          <span>Resolved {formatDate(request.resolved_at)}</span>
        )}
      </div>
      {request.admin_note && (
        <p className="mt-2 text-body-sm text-ink-muted">
          <span className="font-medium">Note:</span> {request.admin_note}
        </p>
      )}

      {/* Actions — only for pending */}
      {isPending && (
        <div className="mt-5 border-t border-line pt-4">
          {!rejectMode ? (
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={handleApprove}>
                Approve
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setRejectMode(true)}
              >
                Reject
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-label">
                Rejection note (optional)
                <Input
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Reason for rejection…"
                  className="max-w-sm"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={handleRejectSubmit}
                  className="border-danger/40 text-danger hover:bg-danger/10"
                >
                  Confirm rejection
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setRejectMode(false);
                    setAdminNote("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="mt-3 text-body-sm text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function WithdrawalsPage() {
  const { user, loading: authLoading } = useAuthUser();
  const [activeTab, setActiveTab] = useState<WithdrawalStatus | "all">("pending");
  const [requests, setRequests] = useState<WithdrawalRequest[] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setRequests(null);
    setFetchError(null);
    setDenied(false);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/admin/withdrawals?status=${activeTab}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (res.status === 403 || res.status === 401) {
        setDenied(true);
        return;
      }
      if (!res.ok) {
        setFetchError("Failed to load withdrawal requests.");
        return;
      }

      setToken(idToken);
      setRequests((await res.json()) as WithdrawalRequest[]);
    } catch {
      setFetchError("Network error. Please refresh.");
    }
  }, [user, activeTab]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Render states ──
  let body: React.ReactNode;

  if (authLoading || (user && requests === null && !denied && !fetchError)) {
    body = (
      <div className="flex items-center gap-3 text-ink-muted">
        <div className="size-5 animate-spin rounded-full border-2 border-line border-t-green" />
        <span className="text-body-sm">Loading…</span>
      </div>
    );
  } else if (!user || denied) {
    body = (
      <div className="rounded-xl border border-line bg-white p-6 text-center text-ink-muted">
        You need an admin account to view this page.
      </div>
    );
  } else if (fetchError) {
    body = (
      <div className="rounded-xl border border-danger/30 bg-danger/5 p-6 text-center text-danger">
        {fetchError}
      </div>
    );
  } else if (requests?.length === 0) {
    body = (
      <div className="rounded-xl border border-line bg-white p-10 text-center text-ink-muted">
        <p className="text-body font-medium">No {activeTab === "all" ? "" : activeTab} withdrawal requests.</p>
        <p className="mt-1 text-body-sm">Nothing to action right now.</p>
      </div>
    );
  } else {
    body = (
      <ul className="space-y-4">
        {requests?.map((req) => (
          <WithdrawalCard
            key={req.id}
            request={req}
            token={token as string}
            onDone={load}
          />
        ))}
      </ul>
    );
  }

  return (
    <main className="mx-auto max-w-[960px] px-4 py-8 md:px-6">
      <h1 className="text-title font-semibold">Withdrawal Requests</h1>
      <p className="mt-1 mb-6 text-ink-muted">
        Review and approve or reject producer withdrawal requests.
      </p>

      {/* Tab filter */}
      <div className="mb-6 flex flex-wrap gap-1 rounded-xl border border-line bg-white p-1">
        {TAB_LABELS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setActiveTab(value)}
            className={`rounded-lg px-3 py-1.5 font-num text-label font-medium transition-colors ${
              activeTab === value
                ? "bg-field text-paper shadow-sm"
                : "text-ink-muted hover:bg-sage-soft hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {body}
    </main>
  );
}
