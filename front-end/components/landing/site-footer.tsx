"use client";

import { useRef } from "react";

import { gsap, isReducedMotion, useGSAP } from "@/lib/gsap/effects";

import { CONTAINER, Num } from "./shared";

export function SiteFooter() {
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (isReducedMotion()) return;
      gsap.fromTo(
        "[data-wordmark]",
        { yPercent: 30 },
        {
          yPercent: 0,
          ease: "none",
          scrollTrigger: { trigger: scope.current, start: "top bottom", end: "bottom bottom", scrub: true },
        },
      );
    },
    { scope },
  );

  return (
    <footer ref={scope} className="overflow-hidden text-ink">
      <div className={`${CONTAINER} pt-10 pb-8`}>
        <p className="font-display text-xl font-medium">lumora</p>
        <p className="mt-2">See who&apos;s buying before you sell.</p>
        <p className="mt-6 text-body-sm text-ink-muted">
          Starting in Jos and Plateau State with live broilers and tomatoes. Built for HackJos{" "}
          <Num>2026</Num>. Names, prices and quantities on this page are example data.
        </p>
      </div>
      <div aria-hidden="true" className="h-[16vw] overflow-hidden">
        <p
          data-wordmark
          className="text-center font-display text-[22vw] leading-none font-medium whitespace-nowrap text-sage/25"
        >
          lumora
        </p>
      </div>
    </footer>
  );
}
