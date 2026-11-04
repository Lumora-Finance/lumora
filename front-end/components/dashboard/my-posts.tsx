"use client";

import { MoreHorizontal, Pause, Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type Post = {
  id: string;
  type: "DEMAND" | "LISTING";
  commodity: string;
  spec: string;
  price: string;
  unit: string;
  remaining: string;
  total: string;
  status: "active" | "paused" | "full";
};

const POSTS: Post[] = [
  {
    id: "1",
    type: "DEMAND",
    commodity: "Live Broilers",
    spec: "2.5–3.5 kg each, healthy",
    price: "₦3,500",
    unit: "/ kg",
    remaining: "50",
    total: "80",
    status: "active",
  },
  {
    id: "2",
    type: "LISTING",
    commodity: "Tomatoes",
    spec: "Grade A, Plateau Roma",
    price: "₦850",
    unit: "/ basket",
    remaining: "20",
    total: "40",
    status: "active",
  },
  {
    id: "3",
    type: "DEMAND",
    commodity: "Eggs",
    spec: "Crates of 30, medium",
    price: "₦2,100",
    unit: "/ crate",
    remaining: "0",
    total: "15",
    status: "full",
  },
  {
    id: "4",
    type: "LISTING",
    commodity: "Live Turkey",
    spec: "5–7 kg, dressed or live",
    price: "₦4,200",
    unit: "/ kg",
    remaining: "10",
    total: "20",
    status: "paused",
  },
];

const STATUS_STYLES: Record<Post["status"], string> = {
  active: "bg-sage-soft text-green",
  paused: "bg-amber-soft text-amber",
  full: "bg-line text-ink-muted",
};

export function MyPosts({ onPost }: { onPost?: () => void }) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-line bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h2 className="text-heading font-medium text-ink">My Posts</h2>
          <p className="mt-0.5 text-body-sm text-ink-muted">
            Your active demand and listings
          </p>
        </div>
        <button
          onClick={onPost}
          className="flex items-center gap-1.5 rounded-lg bg-green px-3.5 py-2 text-body-sm font-medium text-paper transition-colors hover:bg-green-hover"
        >
          <Plus strokeWidth={2} className="size-4" />
          Post
        </button>
      </div>

      {/* Posts */}
      <div className="divide-y divide-line">
        {POSTS.map((post) => {
          const pct = post.total === "0" ? 0 : Math.round((parseInt(post.remaining) / parseInt(post.total)) * 100);

          return (
            <div
              key={post.id}
              className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-sage-soft/20"
            >
              {/* Type tag */}
              <span
                className={cn(
                  "mt-0.5 shrink-0 rounded-md px-2 py-0.5 font-num text-label font-medium tracking-wide",
                  post.type === "DEMAND"
                    ? "bg-green/10 text-green"
                    : "bg-amber-soft text-amber",
                )}
              >
                {post.type}
              </span>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">{post.commodity}</p>
                    <p className="text-body-sm text-ink-muted">{post.spec}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Status */}
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-label font-medium capitalize",
                        STATUS_STYLES[post.status],
                      )}
                    >
                      {post.status}
                    </span>

                    {/* Menu */}
                    <div className="relative">
                      <button
                        onClick={() => setActiveMenu(activeMenu === post.id ? null : post.id)}
                        className="flex size-7 items-center justify-center rounded-md text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-sage-soft hover:text-ink"
                      >
                        <MoreHorizontal strokeWidth={1.5} className="size-4" />
                      </button>
                      {activeMenu === post.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setActiveMenu(null)}
                          />
                          <div className="absolute right-0 top-8 z-20 min-w-[130px] overflow-hidden rounded-lg border border-line bg-white py-1 shadow-lg">
                            <button className="flex w-full items-center gap-2.5 px-3.5 py-2 text-body-sm text-ink hover:bg-sage-soft">
                              <Pencil strokeWidth={1.5} className="size-3.5" /> Edit
                            </button>
                            <button className="flex w-full items-center gap-2.5 px-3.5 py-2 text-body-sm text-ink hover:bg-sage-soft">
                              <Pause strokeWidth={1.5} className="size-3.5" /> Pause
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Price + capacity bar */}
                <div className="mt-2 flex items-center gap-4">
                  <span className="font-num text-number font-medium text-amber">
                    {post.price}
                    <span className="font-sans text-body-sm text-ink-muted">{post.unit}</span>
                  </span>

                  <div className="flex flex-1 items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          post.status === "full" ? "bg-ink-muted" : "bg-green",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="font-num text-label text-ink-muted">
                      {post.remaining}/{post.total} left
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-line px-5 py-3">
        <button className="text-body-sm font-medium text-green hover:underline">
          View all posts →
        </button>
      </div>
    </div>
  );
}
