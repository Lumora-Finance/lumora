"use client";

import Image from "next/image";
import Link from "next/link";
import { ViewTransition } from "react";

import { useAuthUser } from "@/components/auth/use-auth-user";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PRODUCER_HREF = "#producers";
const BUYER_HREF = "#buyers";

const ON_DARK_FOCUS = "focus-visible:border-paper focus-visible:ring-paper/60";
const NAV_LINK = cn(
  "inline-flex min-h-10 items-center rounded-md px-2 text-sm font-medium transition-colors duration-200 ease-out hover:bg-field-soft focus-visible:ring-3 focus-visible:ring-paper/60 focus-visible:outline-none md:px-3",
);
const ENTER = "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both motion-safe:duration-500";

export function Hero() {
  const { user, loading } = useAuthUser();

  // While Firebase is restoring a saved session, we don't know yet — show nothing
  // on the nav button to avoid a flash. Once resolved, show the right label.
  const signedIn = !loading && !!user;
  const ctaHref = signedIn ? "/dashboard" : "/auth/login";
  const ctaLabel = signedIn ? "Dashboard" : "Sign in";

  return (
    <section className="relative isolate mx-auto mt-2 flex min-h-[calc(100svh-1rem)] w-[calc(100%-1rem)] max-w-[1600px] flex-col overflow-hidden rounded-2xl rounded-tl-none bg-field text-paper md:mt-3 md:min-h-[calc(100svh-1.5rem)] md:w-[calc(100%-1.5rem)]">
      {/* Pexels photo 34705725, free licence. Must not imply this person endorses Lumora. */}
      <ViewTransition name="farm-photo" share="farm-morph" default="none">
      <div className="absolute inset-0 -z-10 overflow-hidden rounded-2xl rounded-tl-none">
        <Image
          src="/images/hero-farm.jpg"
          alt="A farmer laughing beside baskets of fresh tomatoes in a Nigerian field"
          fill
          preload
          sizes="100vw"
          className="object-cover object-[52%_20%] lg:object-[60%_25%]"
        />
        {/* Shading sits only behind text, so the farmer's face stays bright. */}
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-28 bg-linear-to-b from-field/70 to-transparent" />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-field via-field/85 via-45% to-transparent lg:h-1/2 lg:from-field/90 lg:via-field/40 lg:via-50%" />
        <div aria-hidden="true" className="absolute inset-0 hidden bg-linear-to-r from-field/90 via-field/50 via-35% to-transparent to-60% lg:block" />
      </div>
      </ViewTransition>

      <header className="flex items-start justify-between gap-2 pr-2 md:pr-5">
        {/* The logo's green lines need a light surface, so it sits on a paper notch. */}
        <div className="relative rounded-br-2xl bg-paper pt-2 pr-4 pb-3 pl-3 text-ink md:pr-5 md:pl-5">
          <a
            href="#top"
            className="vt-logo inline-flex min-h-10 items-center gap-2 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Image
              src="/brand/lumora-mark.png"
              alt=""
              width={1024}
              height={945}
              preload
              className="h-6 w-auto md:h-7"
            />
            <span className="font-display text-xl font-medium">lumora</span>
          </a>
          <span
            aria-hidden="true"
            className="absolute top-0 left-full size-4 rounded-tl-2xl shadow-[-6px_-6px_0_0_var(--color-paper)]"
          />
          <span
            aria-hidden="true"
            className="absolute top-full left-0 size-4 rounded-tl-2xl shadow-[-6px_-6px_0_0_var(--color-paper)]"
          />
        </div>

        <nav aria-label="Main" className="vt-hero-nav flex items-center md:gap-2 pt-3 md:pt-4">
          <a href="#how-it-works" className={cn(NAV_LINK, "hidden md:inline-flex")}>
            How it works
          </a>
          <a href={PRODUCER_HREF} className={cn(NAV_LINK, "hidden sm:inline-flex")}>
            Producers
          </a>
          <a href={BUYER_HREF} className={cn(NAV_LINK, "hidden sm:inline-flex")}>
            Buyers
          </a>
          {/* Hide the button while auth is loading to prevent a label flash */}
          {!loading && (
            <Link
              href={ctaHref}
              className="ml-1 inline-flex min-h-10 items-center rounded-md bg-paper px-4 text-sm font-semibold text-ink transition-colors duration-200 ease-out hover:bg-sage-soft focus-visible:ring-3 focus-visible:ring-paper/60 focus-visible:outline-none md:ml-2"
            >
              {ctaLabel}
            </Link>
          )}
        </nav>
      </header>

      <div className="vt-hero-copy mt-auto px-4 pt-56 pb-4 md:px-6 md:pt-80 md:pb-6 lg:px-8 lg:pt-24 lg:pb-8">
        <h1
          className={cn(
            ENTER,
            "max-w-[40rem] font-display text-display-xl-sm font-medium text-balance md:text-display-xl",
          )}
        >
          See who&apos;s buying <span className="text-sage">before you sell.</span>
        </h1>
        <p
          className={cn(ENTER, "mt-4 max-w-[34rem] text-lg leading-7 motion-safe:delay-100")}
        >
          Buyers post what they need and what they&apos;ll pay. Farmers book it before
          they load the truck.
        </p>

        <Link
          href={ctaHref}
          className={cn(
            buttonVariants({ variant: "highlight" }),
            ON_DARK_FOCUS,
            ENTER,
            "mt-6 w-full motion-safe:delay-200 sm:w-auto",
          )}
        >
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}
