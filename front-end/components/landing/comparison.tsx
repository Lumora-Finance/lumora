"use client";

import { useRef } from "react";

import { Reveal } from "@/components/motion/reveal";
import { fx, gsap, playOnEnter, useGSAP } from "@/lib/gsap/effects";
import { cn } from "@/lib/utils";

import { CONTAINER, Num, SECTION_HEADING, SECTION_SPACING } from "./shared";

const ROWS = [
  {
    question: "Who posts first?",
    marketplace: "The seller lists produce",
    lumora: "The buyer posts demand",
  },
  {
    question: "What do you know before moving stock?",
    marketplace: "Nothing certain. You list and wait",
    lumora: "A confirmed buyer, a price per unit and a booked slot",
  },
  {
    question: "How is the price set?",
    marketplace: "The seller asks, the buyer negotiates",
    lumora: "Buyers bid openly and producers compare them side by side",
  },
  {
    question: "How is payment worked out?",
    marketplace: "An agreed price per item",
    lumora: "Recorded weight or count, multiplied by the posted price",
  },
  {
    question: "Who holds stock?",
    marketplace: "The seller or the platform",
    lumora: "Nobody. Produce moves only to a booked buyer",
  },
];

const PINNED = "(min-width: 1024px) and (min-height: 720px) and (prefers-reduced-motion: no-preference)";

function CompareCard({
  title,
  side,
  dark = false,
}: {
  title: string;
  side: "marketplace" | "lumora";
  dark?: boolean;
}) {
  return (
    <article
      data-card
      className={cn(
        "rounded-2xl border p-5 md:p-6",
        dark ? "border-field bg-field text-paper" : "border-line bg-card text-ink",
      )}
    >
      <h3 className="text-heading font-semibold">{title}</h3>
      <ul className="mt-2">
        {ROWS.map((row) => (
          <li
            key={row.question}
            data-line={side}
            className={cn("border-t py-3 lg:min-h-[5.25rem]", dark ? "border-field-line" : "border-line")}
          >
            <p className={cn("text-label font-medium", dark ? "text-sage" : "text-ink-muted")}>
              {row.question}
            </p>
            <p className={cn("mt-1", !dark && "text-ink-muted")}>{row[side]}</p>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function Comparison() {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;

      const marketplace = gsap.utils.toArray<Element>('[data-line="marketplace"]', root);
      const lumora = gsap.utils.toArray<Element>('[data-line="lumora"]', root);
      const media = gsap.matchMedia();

      media.add(PINNED, () => {
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: root,
            pin: true,
            start: "top top+=64",
            end: "+=100%",
            scrub: 0.5,
          },
        });
        marketplace.forEach((line, index) => {
          timeline.fromTo(line, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 });
          timeline.add(fx("riseIn", lumora[index], { stagger: 0 }));
        });
      });

      media.add(`not all and ${PINNED}`, () => {
        gsap.utils.toArray<Element>("[data-card]", root).forEach((card) => {
          playOnEnter(fx("riseIn", card.querySelectorAll("[data-line]"), { stagger: 0.08 }), card);
        });
      });

      return () => media.revert();
    },
    { scope },
  );

  return (
    <section data-rhythm="white" className={SECTION_SPACING}>
      <div className={CONTAINER}>
        <Reveal selector="[data-intro]">
          <h2 data-intro className={cn(SECTION_HEADING, "max-w-[46rem]")}>
            A marketplace is a shop window for sellers. Lumora is a notice board for buyers of farm
            produce.
          </h2>
          <p data-intro className="mt-5 max-w-[680px]">
            Fruit and vegetable losses in Nigeria are estimated at around <Num>50%</Num> a year
            (FAO). Selling without a confirmed buyer is one direct cause: produce waits, spoils or
            goes cheap. On Lumora, nothing moves until it is booked.
          </p>
        </Reveal>

        <div ref={scope} className="mt-10 grid gap-4 lg:grid-cols-2">
          <CompareCard title="A marketplace: a shop window for sellers" side="marketplace" />
          <CompareCard title="Lumora: a notice board for buyers" side="lumora" dark />
        </div>
      </div>
    </section>
  );
}
