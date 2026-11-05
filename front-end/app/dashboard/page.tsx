"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { AlertCircle, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

import { LogoVideo } from "@/components/dashboard/logo-video";
import { BoardPreview } from "@/components/dashboard/board-preview";
import { MyPosts } from "@/components/dashboard/my-posts";
import { PostModal } from "@/components/dashboard/post-button";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { StatsRow } from "@/components/dashboard/stats-row";
import { UpcomingBookings } from "@/components/dashboard/upcoming-bookings";
import { Reveal } from "@/components/motion/reveal";
import { useProfile } from "@/components/auth/use-profile";
import { fx, useGSAP, playOnEnter } from "@/lib/gsap/effects";
import { cn } from "@/lib/utils";

const CROPS = [
  {
    src: "/images/hero-farm.jpg",
    pos: "object-[52%_25%]",
    cls: "absolute top-6 right-12 size-20 lg:size-24 hidden sm:block",
  },
  {
    src: "/images/step-farmer.jpg",
    pos: "object-[28%_10%]",
    cls: "absolute bottom-6 right-6 size-16 lg:size-20",
  },
];

export default function DashboardPage() {
  const [postOpen, setPostOpen] = useState(false);
  const { user, profile } = useProfile();
  const heroRef = useRef<HTMLDivElement>(null);
  const count1Ref = useRef<HTMLSpanElement>(null);
  const count2Ref = useRef<HTMLSpanElement>(null);
  const count3Ref = useRef<HTMLSpanElement>(null);

  const profileIncomplete = user && !user.phoneNumber;
  const displayName = profile?.display_name ?? user?.displayName ?? user?.email?.split("@")[0] ?? "there";
  const firstName = displayName.split(" ")[0];
  const photoURL = profile?.photo_url ?? user?.photoURL ?? null;
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();

  useGSAP(
    () => {
      const root = heroRef.current;
      if (!root) return;

      // ledger lines

      // stat chips pop in
      playOnEnter(
        fx("chipPop", root.querySelectorAll("[data-chip]"), { stagger: 0.08 }),
        root,
        "top 85%",
      );

      // float crop photos
      fx("floatDrift", root.querySelectorAll("[data-crop]"));

      // count up numbers
      if (count1Ref.current) {
        playOnEnter(
          fx("countUp", count1Ref.current, { to: 4, format: "integer" }),
          root,
          "top 85%",
        );
      }
      if (count2Ref.current) {
        playOnEnter(
          fx("countUp", count2Ref.current, { to: 7, format: "integer" }),
          root,
          "top 85%",
        );
      }
      if (count3Ref.current) {
        playOnEnter(
          fx("countUp", count3Ref.current, { to: 842000, format: "naira" }),
          root,
          "top 85%",
        );
      }
    },
    { scope: heroRef },
  );

  return (
    <>
      <div className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-6 lg:px-8">

        {/* ── Hero strip ──────────────────────────────────────── */}
        <div
          ref={heroRef}
          data-rhythm="field"
          className="relative isolate mb-8 overflow-hidden rounded-2xl bg-field px-6 py-10 text-paper lg:px-10 lg:py-12"
        >
          <LogoVideo />

          {/* Floating crop photos */}
          {CROPS.map((crop, i) => (
            <div
              key={i}
              data-crop
              aria-hidden="true"
              className={cn("overflow-hidden rounded-full", crop.cls)}
            >
              <Image
                src={crop.src}
                alt=""
                width={200}
                height={200}
                className={cn("size-full object-cover", crop.pos)}
              />
            </div>
          ))}

          {/* Greeting row */}
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="relative size-12 shrink-0 overflow-hidden rounded-full ring-2 ring-sage/30 lg:size-14">
              {photoURL ? (
                <Image
                  src={photoURL}
                  alt={displayName}
                  fill
                  className="object-cover"
                  referrerPolicy="no-referrer"
                  sizes="56px"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-field-soft font-num text-heading font-medium text-sage">
                  {initials}
                </span>
              )}
            </div>
            <div>
              <p className="text-body text-sage/70">Welcome back</p>
              <h1 className="font-display text-display-lg-sm font-medium tracking-tight text-paper md:text-[2rem]">
                Good day, {firstName} ✦
              </h1>
            </div>
          </div>

          {/* Stat chips */}
          <div className="mt-8 flex flex-wrap gap-3">
            <div
              data-chip
              className="flex flex-col rounded-[20px_6px_20px_6px] bg-field-soft/70 px-4 py-3"
            >
              <span className="text-body-sm text-sage/70">Active Posts</span>
              <span ref={count1Ref} className="font-num text-number-lg font-medium text-paper">
                4
              </span>
            </div>
            <div
              data-chip
              className="flex flex-col rounded-[6px_20px_6px_20px] bg-field-soft/70 px-4 py-3"
            >
              <span className="text-body-sm text-sage/70">Bookings</span>
              <span ref={count2Ref} className="font-num text-number-lg font-medium text-paper">
                7
              </span>
            </div>
            <div
              data-chip
              className="flex flex-col rounded-[20px_6px_20px_6px] bg-amber/20 px-4 py-3"
            >
              <span className="text-body-sm text-amber/80">This Month</span>
              <span ref={count3Ref} className="font-num text-number-lg font-medium text-amber">
                ₦842,000
              </span>
            </div>
          </div>

          {/* Quick action */}
          <button
            onClick={() => setPostOpen(true)}
            className="mt-6 flex items-center gap-2 rounded-full bg-paper px-5 py-2.5 text-body font-medium text-field transition-all duration-200 hover:bg-sage-soft hover:shadow-md"
          >
            <Sparkles strokeWidth={1.5} className="size-4" />
            Post demand or listing
          </button>
        </div>

        {/* ── Profile incomplete banner ───────────────────────── */}
        {profileIncomplete && (
          <Reveal effect="riseIn">
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber/30 bg-amber-soft/60 px-4 py-3.5">
              <AlertCircle strokeWidth={1.5} className="size-5 shrink-0 text-amber" />
              <p className="flex-1 text-body-sm text-ink">
                <span className="font-medium">Complete your profile</span> — add your phone number
                and location to post demand or list produce.
              </p>
              <Link
                href="/dashboard/profile"
                className="flex shrink-0 items-center gap-1 text-body-sm font-medium text-amber hover:underline"
              >
                Complete now
                <ArrowRight strokeWidth={2} className="size-3.5" />
              </Link>
            </div>
          </Reveal>
        )}

        {/* ── Stats row ──────────────────────────────────────── */}
        <Reveal effect="riseIn">
          <StatsRow />
        </Reveal>

        {/* ── Main grid ──────────────────────────────────────── */}
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
          {/* Left column */}
          <div className="flex flex-col gap-6">
            <Reveal effect="riseIn">
              <MyPosts onPost={() => setPostOpen(true)} />
            </Reveal>
            <Reveal effect="riseIn">
              <RecentTransactions />
            </Reveal>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-6">
            <Reveal effect="riseIn">
              <UpcomingBookings />
            </Reveal>
            <Reveal effect="riseIn">
              <BoardPreview />
            </Reveal>
          </div>
        </div>
      </div>

      {/* Post modal */}
      <PostModal open={postOpen} onClose={() => setPostOpen(false)} />
    </>
  );
}
