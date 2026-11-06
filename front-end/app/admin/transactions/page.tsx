"use client";

import { useState } from "react";
import {
  useAdminData, formatKobo, relDate, AdminPageShell,
  SearchInput, DataTable, EmptyState,
} from "../_shared";

type Transaction = {
  id: string; gross_kobo: number; fees_kobo: number; net_kobo: number;
  kind: string; created_at: string;
  booking: { code: string } | null;
  farmer: { name: string } | null;
};

export default function AdminTransactionsPage() {
  const { data, loading, error } = useAdminData<Transaction[]>("/api/admin/transactions");
  const [search, setSearch] = useState("");

  const filtered = (data ?? []).filter((t) => {
    const q = search.toLowerCase();
    return !q ||
      (t.booking?.code ?? "").toLowerCase().includes(q) ||
      (t.farmer?.name ?? "").toLowerCase().includes(q) ||
      t.kind.toLowerCase().includes(q);
  });

  const totalGross = filtered.reduce((s, t) => s + t.gross_kobo, 0);
  const totalFees = filtered.reduce((s, t) => s + t.fees_kobo, 0);

  return (
    <AdminPageShell
      title="Transactions"
      subtitle="settlements"
      count={loading ? undefined : filtered.length}
      loading={loading}
      error={error}
      actions={<SearchInput value={search} onChange={setSearch} placeholder="Code, farmer, kind…" />}
    >
      {filtered.length === 0 ? (
        <EmptyState
          message={search ? "No transactions match your search." : "No transactions yet."}
          detail={search ? "Try a different search term." : "Transactions appear after bookings are settled."}
        />
      ) : (
        <>
          {/* Summary row */}
          <div className="mb-4 flex flex-wrap gap-4 rounded-xl border border-line bg-white px-5 py-3.5 shadow-sm">
            <div>
              <p className="text-label text-ink-muted">Gross GMV</p>
              <p className="font-num text-body font-semibold text-ink">{formatKobo(totalGross)}</p>
            </div>
            <div>
              <p className="text-label text-ink-muted">Platform fees</p>
              <p className="font-num text-body font-semibold text-green">{formatKobo(totalFees)}</p>
            </div>
            <div>
              <p className="text-label text-ink-muted">Paid to farmers</p>
              <p className="font-num text-body font-semibold text-ink">{formatKobo(totalGross - totalFees)}</p>
            </div>
          </div>

          <DataTable footer={`${filtered.length} of ${(data ?? []).length} transactions`}>
            {filtered.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{t.booking?.code ?? "—"}</p>
                  <p className="text-body-sm text-ink-muted capitalize">{t.farmer?.name ?? "—"} · {t.kind.replace(/_/g, " ")}</p>
                </div>
                <span className="font-num text-body-sm text-ink-muted">GMV {formatKobo(t.gross_kobo)}</span>
                <span className="font-num text-body-sm text-ink-muted">fee {formatKobo(t.fees_kobo)}</span>
                <span className="font-num text-body-sm font-medium text-green">{formatKobo(t.net_kobo)}</span>
                <span className="text-body-sm text-ink-muted">{relDate(t.created_at)}</span>
              </div>
            ))}
          </DataTable>
        </>
      )}
    </AdminPageShell>
  );
}
