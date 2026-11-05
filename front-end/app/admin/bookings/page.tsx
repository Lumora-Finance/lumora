"use client";

import { useAdminData, StatusBadge, AdminPageShell, relDate } from "../_shared";

type Booking = {
  id: string; code: string; qty: number; status: string; created_at: string;
  slot: { date: string; window_start: string } | null;
  listing: { spec: string | null; commodity: { name: string } | null } | null;
  farmer: { name: string } | null;
  buyer: { name: string } | null;
};

export default function AdminBookingsPage() {
  const { data, loading, error } = useAdminData<Booking[]>("/api/admin/bookings");
  const bookings = data ?? [];

  return (
    <AdminPageShell title="Bookings" subtitle="total bookings" count={bookings.length} loading={loading} error={error}>
      {bookings.length === 0 ? (
        <p className="py-12 text-center text-body-sm text-ink-muted">No bookings yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
          <div className="divide-y divide-line">
            {bookings.map((b) => (
              <div key={b.id} className="flex items-center gap-4 px-5 py-3.5">
                <span className="font-num text-body-sm font-medium text-ink">{b.code}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{b.listing?.commodity?.name ?? "Produce"}</p>
                  <p className="text-body-sm text-ink-muted">
                    {b.qty} units · {b.farmer?.name ?? "—"} → {b.buyer?.name ?? "—"}
                  </p>
                </div>
                <span className="text-body-sm text-ink-muted">{b.slot ? relDate(b.slot.date) : "—"}</span>
                <StatusBadge status={b.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}
