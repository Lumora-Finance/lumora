"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import type { DashboardPost } from "@/lib/dashboard-data";
import { useDashboardData } from "@/lib/hooks/use-dashboard-data";
import { formatKobo } from "@/lib/money/rules";

import { Panel, PanelHeading, PanelLink } from "./panel";

const MOST_SHOWN = 4;

export function MyPosts({ onPost }: { onPost?: () => void }) {
  const { data, loading } = useDashboardData<DashboardPost[]>("posts");
  const posts = (Array.isArray(data) ? data : []).slice(0, MOST_SHOWN);

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
        <p className="flex-1 px-5 py-8 text-center text-ink-muted sm:px-6">Loading your posts…</p>
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
            return (
              <li key={post.id}>
                <Link href="/dashboard/posts" className="block py-3.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 truncate font-medium text-ink">{post.commodity?.name ?? "Produce"}</p>
                    <p className="shrink-0 text-body-sm text-ink-muted">
                      <span className="font-num font-medium text-ink">{formatKobo(post.unit_price_kobo)}</span>/{unit}
                    </p>
                  </div>
                  <div className="mt-0.5 flex items-baseline justify-between gap-3 text-body-sm text-ink-muted">
                    <p className="min-w-0 truncate">{post.spec || `${post.capacity_per_day} a day`}</p>
                    {post.status !== "active" && <p className="shrink-0 text-xs font-medium text-ink capitalize">{post.status}</p>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
