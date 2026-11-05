"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Pencil, MoreHorizontal, Sparkles, Trash2, X, Check } from "lucide-react";
import Link from "next/link";

import { getToken } from "@/lib/firebase/auth";
import { LogoVideo } from "@/components/dashboard/logo-video";
import { PostModal } from "@/components/dashboard/post-button";
import { Reveal } from "@/components/motion/reveal";
import { fx, playOnEnter, useGSAP } from "@/lib/gsap/effects";
import { cn } from "@/lib/utils";
import { BusyBar } from "@/components/loader/busy-bar";
import { RowsSkeleton } from "@/components/loader/skeletons";
import { trackTask } from "@/lib/loading/progress";

type Post = {
  id: string;
  spec: string | null;
  unit_price_kobo: number;
  capacity_per_day: number;
  status: "active" | "paused" | "closed";
  commodity: { id: string; name: string; unit: string } | null;
};

type EditState = { spec: string; price: string; capacity: string };

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
  const token = await getToken();
  const res = await fetch(`/api/listings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return res.json();
}

function PostCard({
  post,
  onUpdate,
}: {
  post: Post;
  onUpdate: (id: string, updates: Partial<Post>) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editState, setEditState] = useState<EditState>({
    spec: post.spec ?? "",
    price: String(post.unit_price_kobo / 100),
    capacity: String(post.capacity_per_day),
  });
  const unit = post.commodity?.unit ?? "unit";
  const name = post.commodity?.name ?? "Produce";

  async function handlePause() {
    setMenuOpen(false);
    setSaving(true);
    const result = await patchListing(post.id, { action: "pause" });
    if (result.ok) onUpdate(post.id, { status: result.status });
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Close this listing? Farmers won't be able to book it.")) return;
    setMenuOpen(false);
    setSaving(true);
    const result = await patchListing(post.id, { action: "delete" });
    if (result.ok) onUpdate(post.id, { status: "closed" });
    else alert(result.code === "has_active_bookings" ? "This listing has active bookings. Cancel them first." : "Couldn't delete. Try again.");
    setSaving(false);
  }

  async function handleEdit() {
    setSaving(true);
    const priceKobo = Math.round(parseFloat(editState.price) * 100);
    const capacity = parseInt(editState.capacity);
    if (!priceKobo || !capacity) { alert("Check your price and capacity."); setSaving(false); return; }
    const result = await patchListing(post.id, { action: "edit", spec: editState.spec, unitPriceKobo: priceKobo, capacity });
    if (result.ok) {
      onUpdate(post.id, { spec: editState.spec, unit_price_kobo: priceKobo, capacity_per_day: capacity });
      setEditing(false);
    } else {
      alert(result.code ?? "Edit failed. Try again.");
    }
    setSaving(false);
  }

  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border border-line border-l-[3px] bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md",
      ACCENT[post.status] ?? "border-l-ink-muted",
    )}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-green/10 px-2 py-0.5 font-num text-label font-medium text-green">DEMAND</span>
          <span className={cn("rounded-full px-2.5 py-0.5 text-label font-medium capitalize", STATUS_STYLES[post.status] ?? "bg-line text-ink-muted")}>
            {saving ? "Saving" : post.status}
          </span>
        </div>

        {/* 3-dot menu — always visible */}
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Post options"
            className="flex size-8 items-center justify-center rounded-md border border-line bg-paper text-ink-muted transition-colors hover:bg-sage-soft hover:text-ink"
          >
            <MoreHorizontal strokeWidth={1.5} className="size-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-9 z-20 min-w-[150px] overflow-hidden rounded-lg border border-line bg-white py-1 shadow-xl">
                <Link href={`/dashboard/marketplace/${post.id}`}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-body-sm text-ink hover:bg-sage-soft"
                  onClick={() => setMenuOpen(false)}>
                  <Sparkles strokeWidth={1.5} className="size-3.5" /> View
                </Link>
                <button
                  onClick={() => { setMenuOpen(false); setEditing(true); }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-body-sm text-ink hover:bg-sage-soft">
                  <Pencil strokeWidth={1.5} className="size-3.5" /> Edit
                </button>
                <button onClick={handlePause}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-body-sm text-ink hover:bg-sage-soft">
                  {post.status === "active"
                    ? <><Pause strokeWidth={1.5} className="size-3.5" /> Pause</>
                    : <><Play strokeWidth={1.5} className="size-3.5" /> Activate</>}
                </button>
                <button onClick={handleDelete}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-body-sm text-danger hover:bg-danger/10">
                  <Trash2 strokeWidth={1.5} className="size-3.5" /> Close listing
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Name + spec */}
      <p className="mt-2 font-medium text-ink">{name}</p>
      {!editing && post.spec && <p className="text-body-sm text-ink-muted">{post.spec}</p>}

      {/* Price + capacity */}
      {!editing && (
        <div className="mt-3 flex items-center gap-4">
          <span className="font-num text-number font-medium text-amber">
            {formatKobo(post.unit_price_kobo)}<span className="font-sans text-body-sm text-ink-muted">/{unit}</span>
          </span>
          <span className="font-num text-label text-ink-muted">{post.capacity_per_day} {unit}/day</span>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="mt-3 space-y-3 rounded-lg border border-line bg-paper p-4">
          <div>
            <label className="mb-1 block text-body-sm font-medium text-ink">Spec</label>
            <input value={editState.spec} onChange={(e) => setEditState((s) => ({ ...s, spec: e.target.value }))}
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-body text-ink outline-none focus:border-green" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-body-sm font-medium text-ink">Price (₦/{unit})</label>
              <input type="number" value={editState.price} onChange={(e) => setEditState((s) => ({ ...s, price: e.target.value }))}
                className="w-full rounded-md border border-line bg-white px-3 py-2 font-num text-body text-ink outline-none focus:border-green" />
            </div>
            <div>
              <label className="mb-1 block text-body-sm font-medium text-ink">Capacity/{unit}/day</label>
              <input type="number" value={editState.capacity} onChange={(e) => setEditState((s) => ({ ...s, capacity: e.target.value }))}
                className="w-full rounded-md border border-line bg-white px-3 py-2 font-num text-body text-ink outline-none focus:border-green" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleEdit} disabled={saving}
              aria-busy={saving}
              className="relative flex items-center gap-1.5 overflow-hidden rounded-lg bg-green px-4 py-2 text-body-sm font-medium text-paper hover:bg-green-hover disabled:opacity-50">
              <Check strokeWidth={2} className="size-3.5" /> Save
              <BusyBar active={saving} />
            </button>
            <button onClick={() => setEditing(false)}
              className="flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-body-sm font-medium text-ink-muted hover:text-ink">
              <X strokeWidth={2} className="size-3.5" /> Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PostsPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [postOpen, setPostOpen] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadPosts() {
    setLoading(true);
    const finished = trackTask("posts-page");
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/dashboard/posts", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as Post[];
      setPosts(Array.isArray(data) ? data : []);
    } catch {
      setError("Couldn't load posts. Please refresh.");
    } finally {
      finished();
      setLoading(false);
    }
  }

  useEffect(() => { loadPosts(); }, []);

  function handleUpdate(id: string, updates: Partial<Post>) {
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, ...updates } : p));
  }

  useGSAP(() => {
    const root = heroRef.current;
    if (!root) return;
    playOnEnter(fx("chipPop", root.querySelectorAll("[data-chip]"), { stagger: 0.1 }), root, "top 85%");
  }, { scope: heroRef });

  const active = posts.filter((p) => p.status === "active");
  const paused = posts.filter((p) => p.status === "paused");

  return (
    <>
      <div className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-6 lg:px-8">

        <div ref={heroRef} data-rhythm="field"
          className="relative isolate mb-8 overflow-hidden rounded-2xl bg-field px-6 py-10 text-paper lg:px-10 lg:py-12">
          <LogoVideo />
          <p className="text-label font-medium text-sage/70">Your Market Presence</p>
          <h1 className="mt-2 font-display text-display-lg-sm font-medium text-paper md:text-[2rem]">My Posts</h1>

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

          <button onClick={() => setPostOpen(true)}
            className="mt-6 flex items-center gap-2 rounded-full bg-paper px-5 py-2.5 text-body font-medium text-field transition-all hover:bg-sage-soft hover:shadow-md">
            <Sparkles strokeWidth={1.5} className="size-4" /> New post
          </button>
        </div>

        {loading ? (
          <RowsSkeleton label="Loading your posts" />
        ) : error ? (
          <div className="rounded-xl border border-danger/30 bg-danger/5 p-6 text-center text-danger">{error}</div>
        ) : posts.length === 0 ? (
          <Reveal effect="riseIn">
            <div className="flex flex-col items-center gap-4 rounded-2xl bg-field px-8 py-16 text-center text-paper">
              <p className="font-display text-title font-medium">No posts yet</p>
              <p className="text-body text-paper/60">Post your first demand to start receiving bookings.</p>
              <button onClick={() => setPostOpen(true)}
                className="mt-2 rounded-full bg-paper px-5 py-2.5 text-body-sm font-medium text-field hover:bg-sage-soft">
                Create your first post →
              </button>
            </div>
          </Reveal>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {posts.map((post) => (
              <Reveal key={post.id} effect="riseIn" config={{ stagger: 0 }}>
                <PostCard post={post} onUpdate={handleUpdate} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
      <PostModal open={postOpen} onClose={() => { setPostOpen(false); loadPosts(); }} />
    </>
  );
}
