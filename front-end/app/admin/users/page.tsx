"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getAuth } from "firebase/auth";
import app from "@/lib/firebase/config";
import { cn } from "@/lib/utils";

type User = {
  id: string;
  name: string;
  phone: string;
  role: string;
  area: string | null;
  is_admin: boolean;
  verified: boolean;
  created_at: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = await getAuth(app).currentUser?.getIdToken();
        const res = await fetch("/api/admin/users", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          setUsers(Array.isArray(data) ? data : []);
        }
      } catch { /* */ } finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-6 md:px-6 lg:px-8">
      <h1 className="font-display text-2xl font-medium text-ink">Users</h1>
      <p className="mt-1 text-body-sm text-ink-muted">{loading ? "Loading…" : `${users.length} registered`}</p>

      <div className="mt-6 overflow-hidden rounded-xl border border-line bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="size-6 animate-spin text-ink-muted" /></div>
        ) : users.length === 0 ? (
          <p className="py-12 text-center text-body-sm text-ink-muted">No users yet.</p>
        ) : (
          <div className="divide-y divide-line">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex size-9 items-center justify-center rounded-full bg-sage-soft font-num text-label font-medium text-green">
                  {(u.name ?? "?")[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{u.name}</p>
                  <p className="text-body-sm text-ink-muted">{u.phone}</p>
                </div>
                <span className={cn("rounded-full px-2.5 py-0.5 text-label font-medium capitalize", u.role === "admin" ? "bg-danger/10 text-danger" : "bg-sage-soft text-green")}>
                  {u.role}
                </span>
                {u.is_admin && <span className="rounded-full bg-danger/10 px-2.5 py-0.5 text-label font-medium text-danger">admin</span>}
                <span className="text-body-sm text-ink-muted">{u.area ?? "—"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
