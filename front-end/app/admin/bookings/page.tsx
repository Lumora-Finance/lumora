"use client";

import { useState } from "react";
import {
  useAdminData, relDate, StatusBadge, AdminPageShell,
  SearchInput, TabFilter, DataTable, EmptyState,
} from "../_shared";

type Booking = {
  id: string; code: string; qty: number; status: string; created_at: string;
  slot: { date: string; window_start: string } | null;
  listing: { spec: string | null; commodity: { name: string } | null } | null;
  farmer: { name: string } | null;
  buyer: { name: string } | null;
};

type StatusFilter = "all" | "booked" | "confirmed" | "settled" | "cancelled" | "disputed" | "no_show";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "booked", label: "Booked" },
  { value: "confirmed", label: "Confirmed" },
  { value: "settled", label: "Settled" },
  { value: "cancelled", label: "Cancelled" },
  { value: "disputed", label: "Disputed" },
  { value: "no_show", label: "No-show" },
];

export default function AdminBookingsPage() {
  const { data, loading, error } = useAdminData<Booking[]>("/api/admin/bookings");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = (data ?? []).filter((b) => {
    const matchStatus = statusFilter === "all" || b.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      b.code?.toLowerCase().includes(q) ||
      (b.farmer?.name ?? "").toLowerCase().includes(q) ||
      (b.buyer?.name ?? "").toLowerCase().includes(q) ||
      (b.listing?.commodity?.name ?? "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <AdminPageShell
      title="Bookings"
      subtitle="total bookings"
      count={loading ? undefined : filtered.length}
      loading={loading}
      error={error}
      actions={
        <>
          <SearchInput value={search} onChange={setSearch} placeholder="Code, farmer, buyer…" />
          <TabFilter value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
        </>
      }
    >
      {filtered.length === 0 ? (
        <EmptyState
          message={search || statusFilter !== "all" ? "No bookings match your filters." : "No bookings yet."}
          detail={search || statusFilter !== "all" ? "Try adjusting your search or filter." : undefined}
        />
      ) : (
        <DataTable footer={`${filtered.length} of ${(data ?? []).length} bookings`}>
          {filtered.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium text-ink">
                  <span className="font-num text-body-sm text-ink-muted">{b.code}</span>
                  <span>{b.listing?.commodity?.name ?? "Produce"}</span>
                  <span className="font-num text-body-sm text-ink-muted">× {b.qty}</span>
                </p>
                <p className="text-body-sm text-ink-muted">
                  {b.farmer?.name ?? "—"} → {b.buyer?.name ?? "—"}
                </p>
              </div>
              <span className="text-body-sm text-ink-muted">{b.slot ? relDate(b.slot.date) : relDate(b.created_at)}</span>
              <StatusBadge status={b.status} />
            </div>
          ))}
        </DataTable>
      )}
    </AdminPageShell>
  );
}
