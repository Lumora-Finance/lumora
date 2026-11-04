"use client";

import { Pause, Play } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/format";
import { fx, gsap, isReducedMotion, pauseOffscreen, useGSAP } from "@/lib/gsap/effects";

const BIDS = [
  { produce: "Live broilers", area: "Rayfield", price: formatNaira(3500, "kg"), left: 50 },
  { produce: "Tomatoes", area: "Farin Gada", price: formatNaira(28000, "basket"), left: 12 },
  { produce: "Eggs", area: "Bukuru", price: formatNaira(5600, "crate"), left: 60 },
  { produce: "Turkey", area: "Angwan Rukuba", price: formatNaira(4150, "kg"), left: 15 },
  { produce: "Live broilers", area: "Angwan Rukuba", price: formatNaira(3800, "kg"), left: 40 },
  { produce: "Tomatoes", area: "Bukuru", price: formatNaira(26500, "basket"), left: 20 },
  { produce: "Eggs", area: "Rayfield", price: formatNaira(5400, "crate"), left: 35 },
  { produce: "Live broilers", area: "Barkin Ladi", price: formatNaira(3300, "kg"), left: 30 },
];

const REFILL_BELOW = 5;

function BidRow({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul
      aria-hidden={hidden || undefined}
      className={`flex shrink-0 items-center ${hidden ? "motion-reduce:hidden" : ""}`}
    >
      {BIDS.map((bid, index) => (
        <li key={index} className="flex items-center gap-2 pr-6 text-body-sm whitespace-nowrap">
          <Image src="/brand/lumora-mark.png" alt="" width={22} height={20} className="h-5 w-auto" />
          <span>{bid.produce}</span>
          <span className="text-ink-muted">· {bid.area} ·</span>
          <span className="font-num font-medium">{bid.price}</span>
          <span className="text-ink-muted">·</span>
          <span>
            <span data-left={index} className="font-num">
              {bid.left}
            </span>{" "}
            left
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Ticker() {
  const scope = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const loops = useRef<gsap.core.Animation[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  useGSAP(
    () => {
      const trackElement = track.current;
      if (!trackElement || !scope.current || isReducedMotion()) return;

      const marquee = fx("marquee", trackElement, { speed: 40 });
      const remaining = BIDS.map((bid) => bid.left);
      let next = 0;

      // A timer tween, so it pauses and cleans up with the marquee.
      const liveUpdates = gsap.to(
        {},
        {
          duration: 4,
          repeat: -1,
          onRepeat: () => {
            const index = next;
            next = (next + 1) % BIDS.length;
            const drop = gsap.utils.random(2, 5, 1);
            remaining[index] =
              remaining[index] - drop < REFILL_BELOW ? BIDS[index].left : remaining[index] - drop;

            const numbers = gsap.utils.toArray<HTMLElement>(`[data-left="${index}"]`, trackElement);
            numbers.forEach((number) => {
              number.textContent = String(remaining[index]);
            });
            gsap.fromTo(numbers, { opacity: 0.4 }, { opacity: 1, duration: 0.6, ease: "power2.out" });
          },
        },
      );

      loops.current = [marquee, liveUpdates];
      pauseOffscreen(loops.current, scope.current, () => !trackElement.dataset.paused);
    },
    { scope },
  );

  function togglePaused() {
    const shouldPause = !isPaused;
    setIsPaused(shouldPause);
    if (track.current) {
      if (shouldPause) track.current.dataset.paused = "true";
      else delete track.current.dataset.paused;
    }
    loops.current.forEach((loop) => (shouldPause ? loop.pause() : loop.play()));
  }

  return (
    <section ref={scope} aria-label="Example bids" className="mt-2 border-y border-line bg-paper md:mt-3">
      <div className="flex items-center">
        <p className="hidden shrink-0 border-r border-line px-4 py-3 text-label font-medium text-ink-muted sm:block md:px-6">
          Example bids
        </p>
        <div className="min-w-0 flex-1 overflow-hidden motion-reduce:overflow-x-auto">
          <div ref={track} className="flex w-max py-3 pl-4">
            <BidRow />
            <BidRow hidden />
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={togglePaused}
          aria-label={isPaused ? "Play example bids" : "Pause example bids"}
          className="mx-1 size-10 shrink-0 px-0 motion-reduce:hidden md:h-10"
        >
          {isPaused ? (
            <Play aria-hidden="true" strokeWidth={1.5} />
          ) : (
            <Pause aria-hidden="true" strokeWidth={1.5} />
          )}
        </Button>
      </div>
    </section>
  );
}
