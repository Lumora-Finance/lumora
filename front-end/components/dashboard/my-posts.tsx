"use client";

import { MoreHorizontal, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { getAuth } from "firebase/auth";
import Link from "next/link";
import { useState } from "react";

import { RowsSkeleton } from "@/components/loader/skeletons";
import type { DashboardPost } from "@/lib/dashboard-data";
import app from "@/lib/firebase/config";
import { useDashboardData } from "@/lib/hooks/use-dashboard-data";
import { formatKobo } from "@/lib/money/rules";
import { cn } from "@/lib/utils";

import { Panel, PanelHeading, PanelLink } from "./panel";

const MOST_SHOWN = 4;
const ACTION =
  "flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-line text-body-sm font-medium transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
const ACTION_PLAIN = `${ACTION} text-ink hover:border-green hover:text-green`;

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
  const { data, loading, refetch } = useDashboardData<DashboardPost[]>("posts");
  const posts = (Array.isArray(data) ? data : []).slice(0, MOST_SHOWN);

  async function act(id: string, action: "pause" | "delete") {
    setActiveMenu(null);
    setSaving(id);
    await patchListing(id, { action });
    setSaving(null);
    refetch();
  }

  return (
    <Panel className="flex h-full flex-col">
      <PanelHeading
        title="My posts"
        sub="What you've asked for"
        action={
          <div className="flex items-center gap-1">
            <PanelLink href="/dashboard/posts">All posts</PanelLink>
            <button
              type="button"
              onClick={onPost}
              aria-label="New post"
              className="flex size-9 items-center justify-center rounded-xl bg-sage-soft text-green transition-colors duration-150 hover:bg-green hover:text-paper focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none max-lg:size-11"
            >
              <Plus aria-hidden="true" strokeWidth={2} className="size-4" />
            </button>
          </div>
        }
      />
      {loading ? (
        <RowsSkeleton rows={3} label="Loading your posts" className="mt-2 flex-1 px-5 sm:px-6" />
      ) : posts.length === 0 ? (
        <div className="flex-1 px-5 py-8 text-center sm:px-6">
          <p className="text-body-sm text-ink-muted">No posts yet.</p>
          <button type="button" onClick={onPost} className="mt-1 min-h-11 font-medium text-green underline-offset-4 hover:underline">
            Create your first post
          </button>
        </div>
      ) : (
        <ul className="mt-2 flex-1 divide-y divide-line px-5 pb-2 sm:px-6">
          {posts.map((post) => {
            const unit = post.commodity?.unit ?? "unit";
            const status = saving === post.id ? "Saving" : post.status !== "active" ? post.status : null;
            return (
              <li key={post.id}>
                <div className="flex items-center gap-1">
                  <Link href="/dashboard/posts" className="block min-w-0 flex-1 py-3.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 truncate font-medium text-ink">{post.commodity?.name ?? "Produce"}</p>
                      <p className="shrink-0 text-body-sm text-ink-muted">
                        <span className="font-num font-medium text-ink">{formatKobo(post.unit_price_kobo)}</span>/{unit}
                      </p>
                    </div>
                    <div className="mt-0.5 flex items-baseline justify-between gap-3 text-body-sm text-ink-muted">
                      <p className="min-w-0 truncate">{post.spec || `${post.capacity_per_day} a day`}</p>
                      {status && <p className="shrink-0 text-xs font-medium text-ink capitalize">{status}</p>}
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setActiveMenu(activeMenu === post.id ? null : post.id)}
                    aria-label="Post options"
                    aria-expanded={activeMenu === post.id}
                    className={cn(
                      "-mr-2 flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-150 hover:bg-sage-soft hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                      activeMenu === post.id ? "bg-sage-soft text-ink" : "text-ink-muted",
                    )}
                  >
                    <MoreHorizontal aria-hidden="true" strokeWidth={1.5} className="size-4" />
                  </button>
                </div>

                {/* In the row, not floating over it, because the panel below would cover a floating menu. */}
                {activeMenu === post.id && (
                  <div className="grid grid-cols-3 gap-2 pb-3.5">
                    <Link
                      href={`/dashboard/marketplace/${post.id}`}
                      onClick={() => setActiveMenu(null)}
                      className={ACTION_PLAIN}
                    >
                      <Pencil aria-hidden="true" strokeWidth={1.5} className="size-3.5 shrink-0" /> Edit
                    </Link>
                    <button type="button" onClick={() => act(post.id, "pause")} className={ACTION_PLAIN}>
                      {post.status === "active" ? (
                        <><Pause aria-hidden="true" strokeWidth={1.5} className="size-3.5 shrink-0" /> Pause</>
                      ) : (
                        <><Play aria-hidden="true" strokeWidth={1.5} className="size-3.5 shrink-0" /> Activate</>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Close this listing?")) act(post.id, "delete");
                      }}
                      className={`${ACTION} text-danger hover:border-danger/40`}
                    >
                      <Trash2 aria-hidden="true" strokeWidth={1.5} className="size-3.5 shrink-0" /> Close
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
