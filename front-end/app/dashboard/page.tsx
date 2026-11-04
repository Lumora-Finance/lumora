"use client";

import { useState } from "react";

import { BoardPreview } from "@/components/dashboard/board-preview";
import { MyPosts } from "@/components/dashboard/my-posts";
import { PostModal } from "@/components/dashboard/post-button";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { StatsRow } from "@/components/dashboard/stats-row";
import { UpcomingBookings } from "@/components/dashboard/upcoming-bookings";
import { useAuthUser } from "@/components/auth/use-auth-user";
import { cn } from "@/lib/utils";
import { AlertCircle, ArrowRight } from "lucide-react";

export default function DashboardPage() {
  const [postOpen, setPostOpen] = useState(false);
  const { user } = useAuthUser();

  // Check if profile is incomplete — no phone number stored in displayName heuristic
  // In production this would check Firestore/Supabase profile record
  const profileIncomplete = user && !user.phoneNumber;

  return (
    <>
      <div className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-6 lg:px-8">

        {/* Incomplete profile banner */}
        {profileIncomplete && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber/30 bg-amber-soft/60 px-4 py-3.5">
            <AlertCircle strokeWidth={1.5} className="size-5 shrink-0 text-amber" />
            <p className="flex-1 text-body-sm text-ink">
              <span className="font-medium">Complete your profile</span> — add your phone number and location to post demand or list produce.
            </p>
            <button className="flex shrink-0 items-center gap-1 text-body-sm font-medium text-amber hover:underline">
              Complete now
              <ArrowRight strokeWidth={2} className="size-3.5" />
            </button>
          </div>
        )}

        {/* Stats */}
        <StatsRow />

        {/* Main grid */}
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">

          {/* Left column */}
          <div className="flex flex-col gap-6">
            <MyPosts onPost={() => setPostOpen(true)} />
            <RecentTransactions />
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-6">
            <UpcomingBookings />
            <BoardPreview />
          </div>

        </div>
      </div>

      {/* Post modal */}
      <PostModal open={postOpen} onClose={() => setPostOpen(false)} />
    </>
  );
}
