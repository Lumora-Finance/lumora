"use client";

import { type ReactNode, useRef } from "react";

import { fx, gsap, playOnEnter, useGSAP } from "@/lib/gsap/effects";

const PAYOUT = 323400;

/** Each card animates when it enters, so stacked cards on phones aren't played off screen. */
export function StepCardsMotion({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLOListElement>(null);

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;

      const isRow = window.matchMedia("(min-width: 1024px)").matches;

      gsap.utils.toArray<HTMLElement>(":scope > li", root).forEach((card, index) => {
        const timeline = gsap.timeline({ delay: isRow ? index * 0.12 : 0 });
        timeline.add(fx("riseIn", card, { stagger: 0 }), 0);

        const kernel = card.querySelector("[data-kernel]");
        if (kernel) {
          timeline.add(fx("kernelRise", kernel), 0.15);
          timeline.add(fx("ledgerDraw", card.querySelectorAll("[data-ledger]")), 0.6);
        }

        const payout = card.querySelector("[data-payout]");
        if (payout) {
          timeline.add(fx("countUp", payout, { from: 0, to: PAYOUT, format: "naira" }), 0.2);
        }

        playOnEnter(timeline, card);
      });
    },
    { scope },
  );

  return (
    <ol ref={scope} className="mt-10 grid gap-4 lg:grid-cols-3">
      {children}
    </ol>
  );
}
