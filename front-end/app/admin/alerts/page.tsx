"use client";

import { useAdminData, relDate, AdminPageShell } from "../_shared";

type Alert = {
  id: string; kind: string; detail: Record<string, unknown>; created_at: string; resolved_at: string | null;
};

export default function AdminAlertsPage() {
  const { data, loading, error } = useAdminData<Alert[]>("/api/admin/alerts");
  const alerts = data ?? [];

  return (
    <AdminPageShell title="Alerts" subtitle="alerts" count={alerts.length} loading={loading} error={error}>
      {alerts.length === 0 ? (
        <p className="py-12 text-center text-body-sm text-ink-muted">No alerts.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
          <div className="divide-y divide-line">
            {alerts.map((a) => (
              <div key={a.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{a.kind.replace(/_/g, " ")}</p>
                  <p className="truncate text-body-sm text-ink-muted">
                    {Object.keys(a.detail ?? {}).length > 0 ? JSON.stringify(a.detail) : "—"}
                  </p>
                </div>
                <span className="text-body-sm text-ink-muted">{relDate(a.created_at)}</span>
                {a.resolved_at ? (
                  <span className="rounded-full bg-sage-soft px-2.5 py-0.5 text-label font-medium text-green">resolved</span>
                ) : (
                  <span className="rounded-full bg-danger/10 px-2.5 py-0.5 text-label font-medium text-danger">open</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}
