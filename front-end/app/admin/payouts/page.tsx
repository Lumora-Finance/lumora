"use client";

import { useState } from "react";
import {
  useAdminData, formatKobo, StatusBadge, relDate, AdminPageShell,
  SearchInput, TabFilter, DataTable, EmptyState,
} from "../_shared";

type Payout = {
  id: string; amount_kobo: number; status: string; fee_kobo: number;
  attempts: number; created_at: string; paid_at: string | null;
  farmer: { name: string } | null;
};

type StatusFilter = "all" | "pending" | "in_flight" | "paid" | "failed";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "in_flight", label: "In flight" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
];

export default function AdminPayoutsPage() {
  const { data, loading, error } = useAdminData<Payout[]>("/api/admin/payouts");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = (data ?? []).filter((p) => {
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || (p.farmer?.name ?? "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const totalPaid = filtered.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount_kobo, 0);
  const totalPending = filtered.filter((p) => p.status !== "paid" && p.status !== "failed").reduce((s, p) => s + p.amount_kobo, 0);

  return (
    <AdminPageShell
      title="Payouts"
      subtitle="payouts"
      count={loading ? undefined : filtered.length}
      loading={loading}
      error={error}
      actions={
        <>
          <SearchInput value={search} onChange={setSearch} placeholder="Farmer name…" />
          <TabFilter value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
        </>
      }
    >
      {filtered.length === 0 ? (
        <EmptyState
          message={search || statusFilter !== "all" ? "No payouts match your filters." : "No payouts yet."}
          detail={search || statusFilter !== "all" ? "Try adjusting your search or filter." : undefined}
        />
      ) : (
        <>
          {/* Summary */}
          <div className="mb-4 flex flex-wrap gap-4 rounded-xl border border-line bg-white px-5 py-3.5 shadow-sm">
            <div>
              <p className="text-label text-ink-muted">Paid out</p>
              <p className="font-num text-body font-semibold text-green">{formatKobo(totalPaid)}</p>
            </div>
            <div>
              <p className="text-label text-ink-muted">Pending</p>
              <p className="font-num text-body font-semibold text-amber-700">{formatKobo(totalPending)}</p>
            </div>
          </div>

          <DataTable footer={`${filtered.length} of ${(data ?? []).length} payouts`}>
            {filtered.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{p.farmer?.name ?? "—"}</p>
                  <p className="text-body-sm text-ink-muted">
                    {p.attempts} attempt{p.attempts !== 1 ? "s" : ""}
                    {p.paid_at ? ` · paid ${relDate(p.paid_at)}` : ""}
                  </p>
                </div>
                <span className="font-num text-body-sm font-medium text-ink">{formatKobo(p.amount_kobo)}</span>
                <span className="font-num text-body-sm text-ink-muted">fee {formatKobo(p.fee_kobo)}</span>
                <span className="text-body-sm text-ink-muted">{relDate(p.created_at)}</span>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </DataTable>
        </>
      )}
    </AdminPageShell>
  );
}
