"use client";

import { useState } from "react";
import {
  useAdminData, StatusBadge, relDate, AdminPageShell,
  SearchInput, DataTable, EmptyState,
} from "../_shared";

type Sms = {
  id: string; phone: string; body: string; status: string;
  created_at: string; sent_at: string | null;
};

export default function AdminSmsPage() {
  const { data, loading, error } = useAdminData<Sms[]>("/api/admin/sms");
  const [search, setSearch] = useState("");

  const filtered = (data ?? []).filter((m) => {
    const q = search.toLowerCase();
    return !q || m.phone.includes(q) || m.body.toLowerCase().includes(q);
  });

  return (
    <AdminPageShell
      title="SMS Log"
      subtitle="messages"
      count={loading ? undefined : filtered.length}
      loading={loading}
      error={error}
      actions={<SearchInput value={search} onChange={setSearch} placeholder="Phone or message…" />}
    >
      {filtered.length === 0 ? (
        <EmptyState
          message={search ? "No messages match your search." : "No SMS messages yet."}
          detail={search ? "Try a different search term." : "SMS messages appear here as they're sent."}
        />
      ) : (
        <DataTable footer={`${filtered.length} of ${(data ?? []).length} messages`}>
          {filtered.map((m) => (
            <div key={m.id} className="flex flex-wrap items-start gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="font-num text-body-sm font-medium text-ink">{m.phone}</p>
                <p className="mt-0.5 text-body-sm text-ink-muted">{m.body}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-body-sm text-ink-muted">{relDate(m.created_at)}</span>
                <StatusBadge status={m.status} />
              </div>
            </div>
          ))}
        </DataTable>
      )}
    </AdminPageShell>
  );
}
