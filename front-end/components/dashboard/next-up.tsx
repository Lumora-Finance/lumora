"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { LogoVideo } from "./logo-video";

/** The first thing to know on opening the app: what happens next. */
export function NextUp() {
  return (
    <section
      data-rhythm="field"
      className="relative isolate overflow-hidden rounded-[20px] bg-field px-5 py-6 text-paper sm:px-8 sm:py-7"
    >
      {/* Beside the words on wide screens. Where it sits behind them, it stays a faint watermark. */}
      <div aria-hidden="true" className="absolute inset-0 -z-20 opacity-40 xl:opacity-100">
        <LogoVideo />
      </div>
      <p className="font-num text-[11px] leading-4 tracking-[0.08em] text-sage uppercase">Next up, tomorrow</p>
      <h2 className="mt-2 max-w-[30rem] font-display text-[24px] leading-[1.2] font-medium text-balance sm:text-[30px]">
        30 birds from Amina Farms
      </h2>
      <p className="mt-1.5 text-body-sm text-paper/70">
        7 to 11am at Rayfield. Your code is ready on the booking.
      </p>
      <Link
        href="/dashboard/bookings"
        className="group mt-5 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-paper px-5 font-medium text-field transition-[background-color,transform] duration-150 hover:bg-sage-soft focus-visible:ring-3 focus-visible:ring-sage focus-visible:outline-none active:scale-[0.98] motion-reduce:active:scale-100"
      >
        View booking
        <ArrowRight aria-hidden="true" strokeWidth={1.75} className="size-4 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
      </Link>
    </section>
  );
}
