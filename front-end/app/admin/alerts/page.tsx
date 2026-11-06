"use client";

import { useState } from "react";
import {
  useAdminData, relDate, AdminPageShell,
  SearchInput, TabFilter, DataTable, EmptyState,
} from "../_shared";

type Alert = {
  id: string; kind: string; detail: Record<string, unknown>;
  created_at: string; resolved_at: string | null;
};

type ResolvedFilter = "all" | "open" | "resolved";

const FILTER_OPTIONS: { value: ResolvedFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
];

export default function AdminAlertsPage() {
  const { data, loading, error } = useAdminData<Alert[]>("/api/admin/alerts");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ResolvedFilter>("open");

  const filtered = (data ?? []).filter((a) => {
    const matchFilter =
      filter === "all" ||
      (filter === "open" && !a.resolved_at) ||
      (filter === "resolved" && !!a.resolved_at);
    const q = search.toLowerCase();
    const matchSearch = !q || a.kind.toLowerCase().includes(q) || JSON.stringify(a.detail).toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  return (
    <AdminPageShell
      title="Alerts"
      subtitle="alerts"
      count={loading ? undefined : filtered.length}
      loading={loading}
      error={error}
      actions={
        <>
          <SearchInput value={search} onChange={setSearch} placeholder="Kind, detail…" />
          <TabFilter value={filter} onChange={setFilter} options={FILTER_OPTIONS} />
        </>
      }
    >
      {filtered.length === 0 ? (
        <EmptyState
          message={filter === "open" ? "No open alerts." : search ? "No alerts match your search." : "No alerts yet."}
          detail={filter === "open" ? "The platform is clear." : undefined}
        />
      ) : (
        <DataTable footer={`${filtered.length} of ${(data ?? []).length} alerts`}>
          {filtered.map((a) => (
            <div key={a.id} className="flex flex-wrap items-start gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink capitalize">{a.kind.replace(/_/g, " ")}</p>
                {Object.keys(a.detail ?? {}).length > 0 && (
                  <p className="mt-0.5 truncate text-body-sm text-ink-muted font-num">
                    {Object.entries(a.detail).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}
                  </p>
                )}
              </div>
              <span className="text-body-sm text-ink-muted shrink-0">{relDate(a.created_at)}</span>
              {a.resolved_at ? (
                <span className="shrink-0 rounded-full bg-sage-soft px-2.5 py-0.5 text-label font-medium text-green">resolved</span>
              ) : (
                <span className="shrink-0 rounded-full bg-danger/10 px-2.5 py-0.5 text-label font-medium text-danger">open</span>
              )}
            </div>
          ))}
        </DataTable>
      )}
    </AdminPageShell>
  );
}
