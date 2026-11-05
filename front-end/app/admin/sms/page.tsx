"use client";

import { useAdminData, StatusBadge, relDate, AdminPageShell } from "../_shared";

type Sms = {
  id: string; phone: string; body: string; status: string; created_at: string; sent_at: string | null;
};

export default function AdminSmsPage() {
  const { data, loading, error } = useAdminData<Sms[]>("/api/admin/sms");
  const messages = data ?? [];

  return (
    <AdminPageShell title="SMS Log" subtitle="messages" count={messages.length} loading={loading} error={error}>
      {messages.length === 0 ? (
        <p className="py-12 text-center text-body-sm text-ink-muted">No SMS messages yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
          <div className="divide-y divide-line">
            {messages.map((m) => (
              <div key={m.id} className="flex items-start gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-num text-body-sm font-medium text-ink">{m.phone}</p>
                  <p className="mt-0.5 text-body-sm text-ink-muted">{m.body}</p>
                </div>
                <span className="text-body-sm text-ink-muted">{relDate(m.created_at)}</span>
                <StatusBadge status={m.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}
