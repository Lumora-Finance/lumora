"use client";

import { useState } from "react";
import {
  useAdminData, formatKobo, StatusBadge, AdminPageShell,
  SearchInput, TabFilter, DataTable, EmptyState,
} from "../_shared";

type Listing = {
  id: string; spec: string | null; unit_price_kobo: number; capacity_per_day: number;
  status: string; created_at: string;
  commodity: { name: string; unit: string } | null;
  buyer: { name: string } | null;
};

type StatusFilter = "all" | "active" | "paused" | "closed";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "closed", label: "Closed" },
];

export default function AdminListingsPage() {
  const { data, loading, error } = useAdminData<Listing[]>("/api/admin/listings");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = (data ?? []).filter((l) => {
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (l.commodity?.name ?? "").toLowerCase().includes(q) ||
      (l.buyer?.name ?? "").toLowerCase().includes(q) ||
      (l.spec ?? "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <AdminPageShell
      title="Listings"
      subtitle="demand listings"
      count={loading ? undefined : filtered.length}
      loading={loading}
      error={error}
      actions={
        <>
          <SearchInput value={search} onChange={setSearch} placeholder="Commodity, buyer, spec…" />
          <TabFilter value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
        </>
      }
    >
      {filtered.length === 0 ? (
        <EmptyState
          message={search || statusFilter !== "all" ? "No listings match your filters." : "No listings yet."}
          detail={search || statusFilter !== "all" ? "Try adjusting your search or filter." : undefined}
        />
      ) : (
        <DataTable footer={`${filtered.length} of ${(data ?? []).length} listings`}>
          {filtered.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{l.commodity?.name ?? "Produce"}</p>
                <p className="truncate text-body-sm text-ink-muted">
                  {l.buyer?.name ?? "—"}{l.spec ? ` · ${l.spec.slice(0, 60)}${l.spec.length > 60 ? "…" : ""}` : ""}
                </p>
              </div>
              <span className="font-num text-body-sm font-medium text-amber-700">
                {formatKobo(l.unit_price_kobo)}/{l.commodity?.unit ?? "unit"}
              </span>
              <span className="font-num text-body-sm text-ink-muted">{l.capacity_per_day}/day</span>
              <StatusBadge status={l.status} />
            </div>
          ))}
        </DataTable>
      )}
    </AdminPageShell>
  );
}
