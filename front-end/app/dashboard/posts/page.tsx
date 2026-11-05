"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Pause, Pencil, MoreHorizontal, Sparkles, Loader2 } from "lucide-react";
import { getAuth } from "firebase/auth";

import app from "@/lib/firebase/config";
import { LogoVideo } from "@/components/dashboard/logo-video";
import { PostModal } from "@/components/dashboard/post-button";
import { Reveal } from "@/components/motion/reveal";
import { fx, playOnEnter, useGSAP } from "@/lib/gsap/effects";
import { cn } from "@/lib/utils";

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

function PostCard({ post, onPost }: { post: Post; onPost?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const unit = post.commodity?.unit ?? "unit";
  const name = post.commodity?.name ?? "Produce";

  return (
    <div className={cn(
      "group relative overflow-hidden rounded-xl border border-line border-l-[3px] bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md",
      ACCENT[post.status] ?? "border-l-ink-muted",
    )}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-green/10 px-2 py-0.5 font-num text-label font-medium text-green">
              DEMAND
            </span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-label font-medium capitalize", STATUS_STYLES[post.status] ?? "bg-line text-ink-muted")}>
              {post.status}
            </span>
          </div>
          <p className="mt-2 font-medium text-ink">{name}</p>
          {post.spec && <p className="text-body-sm text-ink-muted">{post.spec}</p>}
        </div>

        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Post options"
            className="flex size-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-sage-soft sm:opacity-0 sm:group-hover:opacity-100"
          >
            <MoreHorizontal strokeWidth={1.5} className="size-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
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

      <div className="mt-4 flex items-center gap-4">
        <span className="font-num text-number font-medium text-amber">
          {formatKobo(post.unit_price_kobo)}
          <span className="font-sans text-body-sm text-ink-muted">/{unit}</span>
        </span>
        <span className="font-num text-label text-ink-muted">
          {post.capacity_per_day} {unit}/day
        </span>
      </div>
    </div>
  );
}

export default function PostsPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [postOpen, setPostOpen] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = await getAuth(app).currentUser?.getIdToken();
        const res = await fetch("/api/dashboard/posts", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as Post[];
        if (!cancelled) setPosts(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setError("Couldn't load posts. Please refresh.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useGSAP(
    () => {
      const root = heroRef.current;
      if (!root) return;
      playOnEnter(fx("chipPop", root.querySelectorAll("[data-chip]"), { stagger: 0.1 }), root, "top 85%");
      fx("floatDrift", root.querySelectorAll("[data-crop]"));
    },
    { scope: heroRef },
  );

  const active = posts.filter((p) => p.status === "active");
  const paused = posts.filter((p) => p.status === "paused");

  return (
    <>
      <div className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-6 lg:px-8">

        {/* Hero */}
        <div
          ref={heroRef}
          data-rhythm="field"
          className="relative isolate mb-8 overflow-hidden rounded-2xl bg-field px-6 py-10 text-paper lg:px-10 lg:py-12"
        >
          <LogoVideo />

          <p className="text-label font-medium text-sage/70">Your Market Presence</p>
          <h1 className="mt-2 font-display text-display-lg-sm font-medium text-paper md:text-[2rem]">
            My Posts
          </h1>

          {!loading && (
            <div className="mt-6 flex flex-wrap gap-3">
              <div data-chip className="flex flex-col rounded-xl bg-sage/20 px-4 py-3">
                <span className="text-label text-sage/70">Active</span>
                <span className="font-num text-number-lg font-medium text-paper">{active.length}</span>
              </div>
              <div data-chip className="flex flex-col rounded-xl bg-field-soft/70 px-4 py-3">
                <span className="text-label text-paper/50">Paused</span>
                <span className="font-num text-number-lg font-medium text-paper/80">{paused.length}</span>
              </div>
              <div data-chip className="flex flex-col rounded-xl bg-amber/20 px-4 py-3">
                <span className="text-label text-amber/70">Total</span>
                <span className="font-num text-number-lg font-medium text-amber">{posts.length}</span>
              </div>
            </div>
          )}

          <button
            onClick={() => setPostOpen(true)}
            className="mt-6 flex items-center gap-2 rounded-full bg-paper px-5 py-2.5 text-body font-medium text-field transition-all hover:bg-sage-soft hover:shadow-md"
          >
            <Sparkles strokeWidth={1.5} className="size-4" />
            New post
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-ink-muted" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-danger/30 bg-danger/5 p-6 text-center text-danger">{error}</div>
        ) : posts.length === 0 ? (
          <Reveal effect="riseIn">
            <div className="flex flex-col items-center gap-4 rounded-2xl bg-field px-8 py-16 text-center text-paper">
              <p className="font-display text-title font-medium">No posts yet</p>
              <p className="text-body text-paper/60">Post your first demand or listing to start receiving bookings.</p>
              <button
                onClick={() => setPostOpen(true)}
                className="mt-2 rounded-full bg-paper px-5 py-2.5 text-body-sm font-medium text-field hover:bg-sage-soft"
              >
                Create your first post →
              </button>
            </div>
          </Reveal>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {posts.map((post) => (
              <Reveal key={post.id} effect="riseIn" config={{ stagger: 0 }}>
                <PostCard post={post} onPost={() => setPostOpen(true)} />
              </Reveal>
            ))}
          </div>
        )}
      </div>

      <PostModal open={postOpen} onClose={() => setPostOpen(false)} />
    </>
  );
}
