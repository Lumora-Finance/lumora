"use client";

import { useAdminData, formatKobo, relDate, AdminPageShell } from "../_shared";

type Transaction = {
  id: string; gross_kobo: number; fees_kobo: number; net_kobo: number; kind: string; created_at: string;
  booking: { code: string } | null;
  farmer: { name: string } | null;
};

export default function AdminTransactionsPage() {
  const { data, loading, error } = useAdminData<Transaction[]>("/api/admin/transactions");
  const txs = data ?? [];

  return (
    <AdminPageShell title="Transactions" subtitle="settlements" count={txs.length} loading={loading} error={error}>
      {txs.length === 0 ? (
        <p className="py-12 text-center text-body-sm text-ink-muted">No transactions yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
          <div className="divide-y divide-line">
            {txs.map((t) => (
              <div key={t.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{t.booking?.code ?? "—"}</p>
                  <p className="text-body-sm text-ink-muted">{t.farmer?.name ?? "—"} · {t.kind}</p>
                </div>
                <span className="font-num text-body-sm text-ink-muted">gross {formatKobo(t.gross_kobo)}</span>
                <span className="font-num text-body-sm text-ink-muted">fee {formatKobo(t.fees_kobo)}</span>
                <span className="font-num text-body-sm font-medium text-green">{formatKobo(t.net_kobo)}</span>
                <span className="text-body-sm text-ink-muted">{relDate(t.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}
