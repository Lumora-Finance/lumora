"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Plus, Pause, Pencil, MoreHorizontal, Sparkles } from "lucide-react";

import { LogoVideo } from "@/components/dashboard/logo-video";
import { PostModal } from "@/components/dashboard/post-button";
import { Reveal } from "@/components/motion/reveal";
import { fx, playOnEnter, useGSAP } from "@/lib/gsap/effects";
import { cn } from "@/lib/utils";

type Post = { id: string; type: "DEMAND" | "LISTING"; commodity: string; spec: string; price: string; unit: string; remaining: number; total: number; status: "active" | "paused" | "full"; bookings: number };

const POSTS: Post[] = [
  { id: "1", type: "DEMAND", commodity: "Live Broilers", spec: "2.5–3.5 kg each, healthy", price: "₦3,500", unit: "/kg", remaining: 50, total: 80, status: "active", bookings: 4 },
  { id: "2", type: "LISTING", commodity: "Tomatoes", spec: "Grade A, Plateau Roma", price: "₦850", unit: "/basket", remaining: 20, total: 40, status: "active", bookings: 2 },
  { id: "3", type: "DEMAND", commodity: "Eggs", spec: "Crates of 30, medium", price: "₦2,100", unit: "/crate", remaining: 0, total: 15, status: "full", bookings: 15 },
  { id: "4", type: "LISTING", commodity: "Live Turkey", spec: "5–7 kg, dressed or live", price: "₦4,200", unit: "/kg", remaining: 10, total: 20, status: "paused", bookings: 1 },
];

const CROPS = [
  { src: "/images/step-farmer.jpg", pos: "object-[28%_10%]", cls: "absolute top-4 right-8 size-14 hidden sm:block" },
  { src: "/images/hero-farm.jpg", pos: "object-[52%_25%]", cls: "absolute bottom-4 right-4 size-12" },
];

const STATUS_STYLES: Record<"active" | "paused" | "full", string> = {
  active: "bg-sage-soft text-green",
  paused: "bg-amber-soft text-amber",
  full: "bg-line text-ink-muted",
};

export default function PostsPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [postOpen, setPostOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const demand = POSTS.filter((p) => p.type === "DEMAND");
  const listings = POSTS.filter((p) => p.type === "LISTING");

  useGSAP(
    () => {
      const root = heroRef.current;
      if (!root) return;
      playOnEnter(fx("chipPop", root.querySelectorAll("[data-chip]"), { stagger: 0.1 }), root, "top 85%");
      fx("floatDrift", root.querySelectorAll("[data-crop]"));
    },
    { scope: heroRef },
  );

  const PostCard = ({ post }: { post: Post }) => {
    const pct = post.total === 0 ? 0 : Math.round((post.remaining / post.total) * 100);
    const isDemand = post.type === "DEMAND";
    return (
      <div
        className={cn(
          "group relative overflow-hidden rounded-xl border bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:rotate-0",
          isDemand ? "border-l-[3px] border-l-green border-line" : "border-l-[3px] border-l-amber border-line",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={cn("rounded-md px-2 py-0.5 font-num text-label font-medium", isDemand ? "bg-green/10 text-green" : "bg-amber-soft text-amber")}>
                {post.type}
              </span>
              <span className={cn("rounded-full px-2.5 py-0.5 text-label font-medium capitalize", STATUS_STYLES[post.status])}>
                {post.status}
              </span>
            </div>
            <p className="mt-2 font-medium text-ink">{post.commodity}</p>
            <p className="text-body-sm text-ink-muted">{post.spec}</p>
          </div>

          {/* Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === post.id ? null : post.id)}
              className="flex size-7 items-center justify-center rounded-md text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-sage-soft"
            >
              <MoreHorizontal strokeWidth={1.5} className="size-4" />
            </button>
            {activeMenu === post.id && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
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

        {/* Price + capacity */}
        <div className="mt-4 flex items-center gap-4">
          <span className="font-num text-number font-medium text-amber">
            {post.price}<span className="font-sans text-body-sm text-ink-muted">{post.unit}</span>
          </span>
          <div className="flex flex-1 items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <div className={cn("h-full rounded-full transition-all", post.status === "full" ? "bg-ink-muted" : "bg-green")} style={{ width: `${pct}%` }} />
            </div>
            <span className="font-num text-label text-ink-muted">{post.remaining}/{post.total}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <span className="text-body-sm text-ink-muted">
            <span className="font-num font-medium text-ink">{post.bookings}</span> booking{post.bookings !== 1 ? "s" : ""}
          </span>
          <button className="text-body-sm font-medium text-green hover:underline">View bookings →</button>
        </div>
      </div>
    );
  };

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
          {CROPS.map((c, i) => (
            <div key={i} data-crop aria-hidden className={cn("overflow-hidden rounded-full", c.cls)}>
              <Image src={c.src} alt="" width={140} height={140} className={cn("size-full object-cover", c.pos)} />
            </div>
          ))}

          <p className="text-label font-medium text-sage/70">Your Market Presence</p>
          <h1 className="mt-2 font-display text-display-lg-sm font-medium text-paper md:text-[2rem]">My Posts</h1>

          <div className="mt-6 flex flex-wrap gap-3">
            {[
              { label: "Active", value: POSTS.filter((p) => p.status === "active").length.toString(), style: "bg-sage/20 text-paper" },
              { label: "Paused", value: POSTS.filter((p) => p.status === "paused").length.toString(), style: "bg-field-soft/70 text-paper/80" },
              { label: "Total bookings", value: POSTS.reduce((a, p) => a + p.bookings, 0).toString(), style: "bg-amber/20 text-amber" },
            ].map((s) => (
              <div key={s.label} data-chip className={cn("flex flex-col rounded-[16px_4px_16px_4px] px-4 py-3", s.style)}>
                <span className="text-label opacity-70">{s.label}</span>
                <span className="font-num text-number-lg font-medium">{s.value}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setPostOpen(true)}
            className="mt-6 flex items-center gap-2 rounded-full bg-paper px-5 py-2.5 text-body font-medium text-field transition-all hover:bg-sage-soft hover:shadow-md"
          >
            <Sparkles strokeWidth={1.5} className="size-4" />
            New post
          </button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">

          {/* Demand */}
          <div>
            <Reveal effect="riseIn">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-title font-medium text-ink">Demand Posts</h2>
                <button onClick={() => setPostOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-sage-soft px-3 py-1.5 text-body-sm font-medium text-green hover:bg-sage-soft/70">
                  <Plus strokeWidth={2} className="size-4" /> Add
                </button>
              </div>
            </Reveal>
            <div className="flex flex-col gap-4">
              {demand.map((post, i) => (
                <Reveal key={post.id} effect="riseIn" config={{ stagger: 0 }}>
                  <div className={cn(i % 2 === 0 ? "rotate-[-0.3deg]" : "rotate-[0.2deg]", "hover:rotate-0 transition-transform duration-300")}>
                    <PostCard post={post} />
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          {/* Listings */}
          <div>
            <Reveal effect="riseIn">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-title font-medium text-ink">Listings</h2>
                <button onClick={() => setPostOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-amber-soft px-3 py-1.5 text-body-sm font-medium text-amber hover:bg-amber-soft/70">
                  <Plus strokeWidth={2} className="size-4" /> Add
                </button>
              </div>
            </Reveal>
            <div className="flex flex-col gap-4">
              {listings.map((post, i) => (
                <Reveal key={post.id} effect="riseIn" config={{ stagger: 0 }}>
                  <div className={cn(i % 2 === 0 ? "rotate-[0.3deg]" : "rotate-[-0.2deg]", "hover:rotate-0 transition-transform duration-300")}>
                    <PostCard post={post} />
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

        </div>
      </div>

      <PostModal open={postOpen} onClose={() => setPostOpen(false)} />
    </>
  );
}
