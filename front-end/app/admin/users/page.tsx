"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  useAdminData, relDate, AdminPageShell, SearchInput, TabFilter,
  DataTable, EmptyState,
} from "../_shared";

type User = {
  id: string; name: string; phone: string; role: string;
  area: string | null; is_admin: boolean; verified: boolean; created_at: string;
};

type RoleFilter = "all" | "farmer" | "buyer" | "agent" | "admin";

const ROLE_OPTIONS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "farmer", label: "Farmers" },
  { value: "buyer", label: "Buyers" },
  { value: "agent", label: "Agents" },
  { value: "admin", label: "Admins" },
];

const ROLE_STYLE: Record<string, string> = {
  farmer: "bg-sage-soft text-green",
  buyer: "bg-amber-soft text-amber-700",
  agent: "bg-purple-100 text-purple-700",
  admin: "bg-danger/10 text-danger",
};

export default function AdminUsersPage() {
  const { data, loading, error } = useAdminData<User[]>("/api/admin/users");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const filtered = (data ?? []).filter((u) => {
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || u.name?.toLowerCase().includes(q) || u.phone?.includes(q) || (u.area ?? "").toLowerCase().includes(q);
    return matchRole && matchSearch;
  });

  return (
    <AdminPageShell
      title="Users"
      subtitle="registered users"
      count={loading ? undefined : filtered.length}
      loading={loading}
      error={error}
      actions={
        <>
          <SearchInput value={search} onChange={setSearch} placeholder="Name, phone, area…" />
          <TabFilter value={roleFilter} onChange={setRoleFilter} options={ROLE_OPTIONS} />
        </>
      }
    >
      {filtered.length === 0 ? (
        <EmptyState
          message={search || roleFilter !== "all" ? "No users match your filters." : "No users yet."}
          detail={search || roleFilter !== "all" ? "Try adjusting your search or filter." : undefined}
        />
      ) : (
        <DataTable footer={`${filtered.length} of ${(data ?? []).length} users`}>
          {filtered.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage-soft font-num text-label font-medium text-green">
                {(u.name ?? "?")[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{u.name ?? "—"}</p>
                <p className="text-body-sm text-ink-muted">{u.phone} {u.area ? `· ${u.area}` : ""}</p>
              </div>
              {u.verified && (
                <span className="rounded-full bg-sage-soft px-2 py-0.5 text-label font-medium text-green">verified</span>
              )}
              <span className={cn("rounded-full px-2.5 py-0.5 text-label font-medium capitalize", ROLE_STYLE[u.role] ?? "bg-line text-ink-muted")}>
                {u.role}
              </span>
              <span className="text-label text-ink-muted">{relDate(u.created_at)}</span>
            </div>
          ))}
        </DataTable>
      )}
    </AdminPageShell>
  );
}
