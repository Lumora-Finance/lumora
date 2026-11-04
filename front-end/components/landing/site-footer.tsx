"use client";

import { useRef } from "react";

import { fx, gsap, isReducedMotion, playOnEnter, useGSAP } from "@/lib/gsap/effects";

import { CONTAINER, Num } from "./shared";

export function SiteFooter() {
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = scope.current;
      if (!root || isReducedMotion()) return;

      playOnEnter(fx("ledgerDraw", root.querySelectorAll("[data-ledger]")), root, "top 90%");
      gsap.fromTo(
        "[data-wordmark]",
        { yPercent: 40 },
        {
          yPercent: 0,
          ease: "none",
          scrollTrigger: { trigger: root, start: "top bottom", end: "bottom bottom", scrub: true },
        },
      );
    },
    { scope },
  );

  return (
    <footer ref={scope} data-bg="paper" className="overflow-hidden text-ink">
      <div className={`${CONTAINER} pt-10 pb-8`}>
        <div aria-hidden="true" className="mb-10 flex flex-col items-center gap-1.5">
          <span data-ledger className="h-1 w-[92%] bg-sage" />
          <span data-ledger className="h-1 w-[66%] bg-sage" />
          <span data-ledger className="h-1 w-[40%] bg-sage" />
        </div>
        <p className="font-display text-xl font-medium">lumora</p>
        <p className="mt-2">Stop selling blind.</p>
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
