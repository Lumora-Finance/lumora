"use client";

import { AlertCircle, ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useProfile } from "@/components/auth/use-profile";
import { BoardPreview } from "@/components/dashboard/board-preview";
import { MoneyChart } from "@/components/dashboard/money-chart";
import { MyPosts } from "@/components/dashboard/my-posts";
import { NextUp } from "@/components/dashboard/next-up";
import { PostModal } from "@/components/dashboard/post-button";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { Schedule } from "@/components/dashboard/schedule";
import { StatsRow } from "@/components/dashboard/stats-row";
import { Reveal } from "@/components/motion/reveal";
import { apiFetch } from "@/lib/logistics/client";

/** Reads top to bottom: what's next, how the month is going, money and the week, posts and who's near. */
export default function DashboardPage() {
  const [postOpen, setPostOpen] = useState(false);
  const [needsLocation, setNeedsLocation] = useState(false);
  const { user, profile } = useProfile();

  const displayName = profile?.display_name ?? user?.displayName ?? user?.email?.split("@")[0] ?? "";
  const firstName = displayName.split(" ")[0];

  // Only someone we can see has no location yet. If our API can't answer, nobody is nagged.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    apiFetch(user, "/api/me")
      .then((response) => (response.ok ? response.json() : undefined))
      .then((profile: { area?: string | null } | null | undefined) => {
        if (!cancelled && profile !== undefined) setNeedsLocation(!profile?.area);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <>
      <div className="mx-auto w-full max-w-[1120px] space-y-4 px-4 py-5 md:px-6 lg:space-y-5 lg:px-8 lg:py-7">
        <header className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-[28px] leading-[1.2] font-medium text-ink sm:text-[32px]">Dashboard</h1>
            <p className="mt-0.5 truncate text-body-sm text-ink-muted sm:text-base">
              {firstName ? `Welcome, ${firstName}. ` : ""}Here&apos;s what&apos;s moving.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPostOpen(true)}
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-field px-4 font-medium text-paper transition-[background-color,transform] duration-150 [-webkit-tap-highlight-color:transparent] hover:bg-field-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.97] motion-reduce:active:scale-100 sm:px-5"
          >
            <Plus aria-hidden="true" strokeWidth={2} className="size-4" />
            New post
          </button>
        </header>

        {needsLocation && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-amber-soft px-4 py-3">
            <AlertCircle aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0 text-[#9A6A1A]" />
            <p className="min-w-0 flex-1 text-body-sm text-ink">Add your location so people nearby can find you.</p>
            <Link href="/dashboard/profile" className="inline-flex min-h-11 items-center gap-1 text-body-sm font-medium text-[#9A6A1A] hover:underline lg:min-h-0">
              Add location
              <ArrowRight aria-hidden="true" strokeWidth={2} className="size-3.5" />
            </Link>
          </div>
        )}

        <Reveal effect="riseIn"><NextUp /></Reveal>
        <Reveal effect="riseIn"><StatsRow /></Reveal>

        <div className="grid grid-cols-1 gap-4 lg:gap-5 xl:grid-cols-[1.2fr_1fr]">
          <Reveal effect="riseIn"><MoneyChart /></Reveal>
          <Reveal effect="riseIn"><Schedule /></Reveal>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:gap-5 xl:grid-cols-[1.2fr_1fr]">
          <Reveal effect="riseIn"><MyPosts onPost={() => setPostOpen(true)} /></Reveal>
          <Reveal effect="riseIn"><BoardPreview /></Reveal>
        </div>

        <Reveal effect="riseIn"><RecentTransactions /></Reveal>
      </div>

      <PostModal open={postOpen} onClose={() => setPostOpen(false)} />
    </>
  );
}
