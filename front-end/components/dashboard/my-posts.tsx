"use client";

import { Loader2, MoreHorizontal, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { getAuth } from "firebase/auth";

import app from "@/lib/firebase/config";
import { cn } from "@/lib/utils";
import { useDashboardData } from "@/lib/hooks/use-dashboard-data";

type Post = {
  id: string;
  spec: string | null;
  unit_price_kobo: number;
  capacity_per_day: number;
  status: "active" | "paused" | "closed";
  commodity: { id: string; name: string; unit: string } | null;
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-sage-soft text-green",
  paused: "bg-amber-soft text-amber",
  closed: "bg-line text-ink-muted",
};

const ACCENT: Record<string, string> = {
  active: "border-l-green",
  paused: "border-l-amber",
  closed: "border-l-ink-muted",
};

function formatKobo(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`;
}

async function patchListing(id: string, body: object) {
  const token = await getAuth(app).currentUser?.getIdToken();
  const res = await fetch(`/api/listings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return res.json();
}

export function MyPosts({ onPost }: { onPost?: () => void }) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const { data, loading, refetch } = useDashboardData<Post[]>("posts");
  const posts = data ?? [];

  async function handlePause(post: Post) {
    setActiveMenu(null);
    setSaving(post.id);
    await patchListing(post.id, { action: "pause" });
    setSaving(null);
    refetch?.();
  }

  async function handleDelete(post: Post) {
    if (!confirm("Close this listing?")) return;
    setActiveMenu(null);
    setSaving(post.id);
    await patchListing(post.id, { action: "delete" });
    setSaving(null);
    refetch?.();
  }

  return (
    <div className="rounded-xl border border-line bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h2 className="text-heading font-medium text-ink">My Posts</h2>
          <p className="mt-0.5 text-body-sm text-ink-muted">Your active demand and listings</p>
        </div>
        <button
          onClick={onPost}
          className="flex items-center gap-1.5 rounded-lg bg-green px-3.5 py-2 text-body-sm font-medium text-paper transition-colors hover:bg-green-hover"
        >
          <Plus strokeWidth={2} className="size-4" /> Post
        </button>
      </div>

      {/* Posts */}
      <div className="flex flex-col gap-3 p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-ink-muted" />
          </div>
        ) : posts.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-body-sm text-ink-muted">No posts yet.</p>
            <button onClick={onPost} className="mt-2 text-body-sm font-medium text-green hover:underline">
              Create your first post →
            </button>
          </div>
        ) : (
          posts.map((post) => {
            const unit = post.commodity?.unit ?? "unit";
            const name = post.commodity?.name ?? "Produce";
            const isSaving = saving === post.id;

            return (
              <div
                key={post.id}
                className={cn(
                  "flex items-start gap-4 rounded-lg border border-line border-l-[3px] bg-paper px-5 py-4 transition-all hover:shadow-md",
                  ACCENT[post.status] ?? "border-l-ink-muted",
                )}
              >
                <span className="mt-0.5 shrink-0 rounded-md bg-green/10 px-2 py-0.5 font-num text-label font-medium text-green">
                  DEMAND
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink">{name}</p>
                      {post.spec && <p className="text-body-sm text-ink-muted">{post.spec}</p>}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-label font-medium capitalize", STATUS_STYLES[post.status] ?? "bg-line text-ink-muted")}>
                        {isSaving ? <Loader2 className="inline size-3 animate-spin" /> : post.status}
                      </span>

                      {/* Always-visible 3-dot menu */}
                      <div className="relative">
                        <button
                          onClick={() => setActiveMenu(activeMenu === post.id ? null : post.id)}
                          aria-label="Post options"
                          className="flex size-7 items-center justify-center rounded-md border border-line bg-white text-ink-muted transition-colors hover:bg-sage-soft hover:text-ink"
                        >
                          <MoreHorizontal strokeWidth={1.5} className="size-4" />
                        </button>
                        {activeMenu === post.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
                            <div className="absolute right-0 top-8 z-20 min-w-[150px] overflow-hidden rounded-lg border border-line bg-white py-1 shadow-xl">
                              <Link href={`/dashboard/marketplace/${post.id}`}
                                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-body-sm text-ink hover:bg-sage-soft"
                                onClick={() => setActiveMenu(null)}>
                                <Pencil strokeWidth={1.5} className="size-3.5" /> View / Edit
                              </Link>
                              <button onClick={() => handlePause(post)}
                                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-body-sm text-ink hover:bg-sage-soft">
                                {post.status === "active"
                                  ? <><Pause strokeWidth={1.5} className="size-3.5" /> Pause</>
                                  : <><Play strokeWidth={1.5} className="size-3.5" /> Activate</>}
                              </button>
                              <button onClick={() => handleDelete(post)}
                                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-body-sm text-danger hover:bg-danger/10">
                                <Trash2 strokeWidth={1.5} className="size-3.5" /> Close
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-4">
                    <span className="font-num text-number font-medium text-amber">
                      {formatKobo(post.unit_price_kobo)}
                      <span className="font-sans text-body-sm text-ink-muted">/{unit}</span>
                    </span>
                    <span className="font-num text-label text-ink-muted">{post.capacity_per_day} {unit}/day</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-line px-5 py-3">
        <a href="/dashboard/posts" className="text-body-sm font-medium text-green hover:underline">View all posts →</a>
      </div>
    </div>
  );
}
