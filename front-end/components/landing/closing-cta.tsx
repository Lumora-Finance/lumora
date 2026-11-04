"use client";

import Image from "next/image";
import { useRef } from "react";

import { buttonVariants } from "@/components/ui/button";
import {
  fx,
  gsap,
  isReducedMotion,
  pauseOffscreen,
  playOnEnter,
  ScrollTrigger,
  SplitText,
  useGSAP,
} from "@/lib/gsap/effects";
import { cn } from "@/lib/utils";

import { CONTAINER, SECTION_SPACING } from "./shared";

const ON_DARK_FOCUS = "focus-visible:border-paper focus-visible:ring-paper/60";

// Below lg, only the first four show, in rows above and below the copy.
const CROPS = [
  { src: "/images/hero-farm.jpg", position: "object-[52%_25%]", place: "top-6 left-6 size-[72px] lg:top-10 lg:left-12 lg:size-24" },
  { src: "/images/step-farmer.jpg", position: "object-[28%_10%]", place: "top-8 right-8 size-[72px] lg:top-14 lg:right-14 lg:size-24" },
  { src: "/images/step-scale.jpg", position: "object-[50%_40%]", place: "bottom-6 left-10 size-[72px] lg:bottom-12 lg:left-16 lg:size-20" },
  { src: "/images/step-buyer.jpg", position: "object-[85%_30%]", place: "right-6 bottom-8 size-[72px] lg:right-12 lg:bottom-10 lg:size-24" },
  { src: "/images/hero-farm.jpg", position: "scale-[2.4] origin-[96%_78%]", place: "hidden lg:block lg:top-[42%] lg:left-6 lg:size-[72px]" },
  { src: "/images/step-farmer.jpg", position: "scale-[2.6] origin-[29%_74%]", place: "hidden lg:block lg:top-[46%] lg:right-6 lg:size-20" },
];

export function ClosingCta() {
  const panel = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = panel.current;
      if (!root) return;

      if (isReducedMotion()) {
        playOnEnter(fx("riseIn", root.querySelectorAll("[data-follow], h2")), root);
      } else {
        const heading = root.querySelector("h2");
        gsap.set(heading, { autoAlpha: 0 });
        gsap.set(root.querySelectorAll("[data-follow]"), { autoAlpha: 0 });

        ScrollTrigger.create({
          trigger: root,
          start: "top 80%",
          once: true,
          onEnter: () => {
            gsap.set(heading, { autoAlpha: 1 });
            // Split at the last moment so line breaks match the current width and final fonts.
            const split = SplitText.create(heading, { type: "lines", aria: "auto" });
            gsap
              .timeline()
              .add(fx("riseIn", split.lines, { stagger: 0.1 }))
              .add(fx("riseIn", root.querySelectorAll("[data-follow]"), { stagger: 0.08 }), "-=0.4")
              .add(() => split.revert());
          },
        });

        playOnEnter(fx("ledgerDraw", root.querySelectorAll("[data-ledger]")), root, "top 80%");
      }

      const drift = fx("floatDrift", root.querySelectorAll("[data-crop]"));
      if (!isReducedMotion()) pauseOffscreen([drift], root);
    },
    { scope: panel },
  );

  return (
    <section data-rhythm="paper" className={SECTION_SPACING}>
      <div className={CONTAINER}>
        <div
          ref={panel}
          className="relative isolate overflow-hidden rounded-[24px] bg-field px-6 py-32 text-center text-paper lg:px-16 lg:py-40"
        >
          <div aria-hidden="true" className="absolute inset-0 -z-10 flex flex-col items-center justify-center gap-10">
            <span data-ledger className="h-1.5 w-[92%] bg-sage/10" />
            <span data-ledger className="h-1.5 w-[66%] bg-sage/10" />
            <span data-ledger className="h-1.5 w-[40%] bg-sage/10" />
          </div>

          {CROPS.map((crop, index) => (
            <div
              key={index}
              data-crop
              aria-hidden="true"
              className={cn("absolute -z-10 overflow-hidden rounded-full", crop.place)}
            >
              <Image
                src={crop.src}
                alt=""
                width={320}
                height={320}
                className={cn("size-full object-cover", crop.position)}
              />
            </div>
          ))}

          <div className="mx-auto max-w-[36rem]">
            <h2 className="font-display text-display-lg-sm font-medium text-balance md:text-display-lg">
              Buying produce in bulk? Post your demand on Lumora.
            </h2>
            <p data-follow className="mt-4 text-lg leading-7">
              Farmers near you will see it today.
            </p>
            <div data-follow className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="#buyers"
                className={cn(buttonVariants({ variant: "highlight" }), ON_DARK_FOCUS, "w-full sm:w-auto")}
              >
                Post your demand
              </a>
              <a
                href="#producers"
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  ON_DARK_FOCUS,
                  "text-paper underline underline-offset-4 hover:bg-field-soft hover:text-paper",
                )}
              >
                Selling? See buyers near you
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
