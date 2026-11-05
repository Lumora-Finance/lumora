"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { Panel, PanelHeading, PanelLink } from "./panel";

type Post = {
  id: string;
  type: "Demand" | "Listing";
  commodity: string;
  spec: string;
  price: string;
  unit: string;
  remaining: number;
  total: number;
  status?: "Paused" | "Full";
};

const POSTS: Post[] = [
  { id: "1", type: "Demand", commodity: "Live broilers", spec: "2.5 to 3.5 kg each", price: "₦3,500", unit: "kg", remaining: 50, total: 80 },
  { id: "2", type: "Listing", commodity: "Tomatoes", spec: "Grade A, Plateau Roma", price: "₦850", unit: "basket", remaining: 20, total: 40 },
  { id: "3", type: "Demand", commodity: "Eggs", spec: "Crates of 30, medium", price: "₦2,100", unit: "crate", remaining: 0, total: 15, status: "Full" },
  { id: "4", type: "Listing", commodity: "Live turkey", spec: "5 to 7 kg each", price: "₦4,200", unit: "kg", remaining: 10, total: 20, status: "Paused" },
];

const progressWords = (post: Post) => {
  if (post.remaining === 0) return "All booked";
  return post.type === "Demand" ? `Needs ${post.remaining} more` : `${post.remaining} left`;
};

export function MyPosts({ onPost }: { onPost?: () => void }) {
  return (
    <Panel className="flex h-full flex-col">
      <PanelHeading
        title="My posts"
        sub="How each one is filling up"
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
      <ul className="mt-2 flex-1 divide-y divide-line px-5 pb-2 sm:px-6">
        {POSTS.map((post) => {
          const filled = Math.round(((post.total - post.remaining) / post.total) * 100);
          return (
            <li key={post.id}>
              <Link href="/dashboard/posts" className="group block py-3.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate font-medium text-ink">
                    {post.commodity}
                    <span className="ml-2 font-num text-[11px] font-normal tracking-[0.04em] text-ink-muted uppercase">{post.type}</span>
                  </p>
                  <p className="shrink-0 text-body-sm text-ink-muted">
                    <span className="font-num font-medium text-ink">{post.price}</span>/{post.unit}
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sage-soft">
                    <span
                      className={cn("block h-full rounded-full transition-[width] duration-500", post.status === "Paused" ? "bg-sage" : "bg-green")}
                      style={{ width: `${filled}%` }}
                    />
                  </span>
                  <span className="shrink-0 text-xs text-ink-muted">
                    {post.status === "Paused" ? "Paused" : progressWords(post)}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
