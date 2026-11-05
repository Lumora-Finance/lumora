"use client";

import { useAdminData, formatKobo, StatusBadge, AdminPageShell } from "../_shared";

type Listing = {
  id: string; spec: string | null; unit_price_kobo: number; capacity_per_day: number;
  status: string; created_at: string;
  commodity: { name: string; unit: string } | null;
  buyer: { name: string } | null;
};

export default function AdminListingsPage() {
  const { data, loading, error } = useAdminData<Listing[]>("/api/admin/listings");
  const listings = data ?? [];

  return (
    <AdminPageShell title="Listings" subtitle="demand listings" count={listings.length} loading={loading} error={error}>
      {listings.length === 0 ? (
        <p className="py-12 text-center text-body-sm text-ink-muted">No listings yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
          <div className="divide-y divide-line">
            {listings.map((l) => (
              <div key={l.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{l.commodity?.name ?? "Produce"}</p>
                  <p className="truncate text-body-sm text-ink-muted">{l.spec ?? "No spec"}</p>
                </div>
                <span className="text-body-sm text-ink-muted">{l.buyer?.name ?? "—"}</span>
                <span className="font-num text-body-sm font-medium text-amber">{formatKobo(l.unit_price_kobo)}</span>
                <span className="font-num text-body-sm text-ink-muted">{l.capacity_per_day}/day</span>
                <StatusBadge status={l.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}
