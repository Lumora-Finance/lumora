"use client";

import { useAdminData, formatKobo, StatusBadge, relDate, AdminPageShell } from "../_shared";

type Payout = {
  id: string; amount_kobo: number; status: string; fee_kobo: number; attempts: number;
  created_at: string; paid_at: string | null;
  farmer: { name: string } | null;
};

export default function AdminPayoutsPage() {
  const { data, loading, error } = useAdminData<Payout[]>("/api/admin/payouts");
  const payouts = data ?? [];

  return (
    <AdminPageShell title="Payouts" subtitle="payouts" count={payouts.length} loading={loading} error={error}>
      {payouts.length === 0 ? (
        <p className="py-12 text-center text-body-sm text-ink-muted">No payouts yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
          <div className="divide-y divide-line">
            {payouts.map((p) => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{p.farmer?.name ?? "—"}</p>
                  <p className="text-body-sm text-ink-muted">
                    {p.attempts} attempt{p.attempts === 1 ? "" : "s"} {p.paid_at ? `· paid ${relDate(p.paid_at)}` : ""}
                  </p>
                </div>
                <span className="font-num text-body-sm font-medium text-green">{formatKobo(p.amount_kobo)}</span>
                <span className="font-num text-body-sm text-ink-muted">fee {formatKobo(p.fee_kobo)}</span>
                <span className="text-body-sm text-ink-muted">{relDate(p.created_at)}</span>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}
