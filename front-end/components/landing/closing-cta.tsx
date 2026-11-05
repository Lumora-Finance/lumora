"use client";

import Image from "next/image";
import Link from "next/link";
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

import { KernelShape } from "./lumora-mark";

const ON_DARK_FOCUS = "focus-visible:border-paper focus-visible:ring-paper/60";

// Rows above and below the copy until there's room for them down the sides. `drift` is how far
// each one travels as the panel scrolls past: the further it goes, the nearer it feels.
const CROPS: { src: string; position: string; drift: number; place: string; sizes?: string }[] = [
  { src: "/images/hero-farm.jpg", position: "object-[52%_25%]", drift: -30, place: "top-[6%] left-[6%] size-20 lg:top-[10%] lg:left-[5%] lg:size-[120px]" },
  { src: "/images/step-farmer.jpg", position: "object-[28%_10%]", drift: -20, place: "top-[13%] left-[calc(50%-2.5rem)] size-20 lg:top-[42%] lg:left-[3%] lg:size-[88px]" },
  { src: "/images/step-scale.jpg", position: "object-[50%_40%]", drift: -40, place: "top-[6%] right-[6%] size-20 lg:top-[14%] lg:right-[6%] lg:size-[104px]" },
  { src: "/images/step-buyer.jpg", position: "object-[85%_30%]", drift: -60, place: "bottom-[8%] left-[6%] size-20 lg:bottom-[6%] lg:left-[8%] lg:size-[112px]" },
  { src: "/images/hero-market.jpg", position: "object-center", drift: -50, place: "bottom-[14%] left-[calc(50%-2.5rem)] size-20 lg:bottom-[34%] lg:left-auto lg:right-[3%] lg:size-20" },
  { src: "/images/step-farmer.jpg", position: "scale-[2.6] origin-[29%_74%]", sizes: "320px", drift: -35, place: "right-[6%] bottom-[8%] size-20 lg:right-[9%] lg:bottom-[6%] lg:size-[96px]" },
];

export function ClosingCta() {
  const panel = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = panel.current;
      if (!root) return;

      const follow = root.querySelectorAll("[data-follow]");
      const heading = root.querySelector("h2");
      const ledger = root.querySelectorAll("[data-mark-ledger]");
      const kernel = root.querySelector("[data-mark-kernel]");

      if (isReducedMotion()) {
        playOnEnter(fx("riseIn", [heading, ...follow]), root, "top 70%");
        return;
      }

      gsap.set([heading, ...follow], { autoAlpha: 0 });
      playOnEnter(
        gsap
          .timeline()
          .add(fx("ledgerDraw", ledger), 0)
          .add(fx("kernelRise", kernel), 0.55),
        root,
        "top 70%",
      );

      ScrollTrigger.create({
        trigger: root,
        start: "top 70%",
        once: true,
        onEnter: () => {
          gsap.set(heading, { autoAlpha: 1 });
          // Split at the last moment so line breaks match the current width and final fonts.
          const split = SplitText.create(heading, { type: "lines", aria: "auto" });
          gsap.set(split.lines, { display: "block" });
          gsap
            .timeline()
            .add(fx("riseIn", split.lines, { stagger: 0.1 }))
            .add(fx("riseIn", follow, { stagger: 0.08 }), "-=0.4")
            .add(() => split.revert());
        },
      });

      // Drift and float are on separate elements, so the two movements can't overwrite each other.
      gsap.utils.toArray<HTMLElement>("[data-parallax]", root).forEach((item) => {
        gsap.fromTo(
          item,
          { yPercent: 0 },
          {
            yPercent: Number(item.dataset.parallax),
            ease: "none",
            scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: true },
          },
        );
      });
      pauseOffscreen([fx("floatDrift", root.querySelectorAll("[data-crop]"))], root);
    },
    { scope: panel },
  );

  return (
    <section data-bg="paper">
      <div
        ref={panel}
        data-entrance="scale"
        className="relative isolate flex min-h-[90vh] flex-col items-center justify-center overflow-hidden rounded-t-[32px] bg-field px-6 py-44 text-center text-paper lg:py-40"
      >
        <div
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 -z-20 w-[min(420px,88vw)] -translate-x-1/2 -translate-y-1/2 text-sage opacity-[0.14]"
        >
          <div>
            <div data-mark-kernel>
              <KernelShape className="mx-auto block aspect-[556/495] w-[63%]" />
            </div>
          </div>
          <div className="mt-4 flex flex-col items-center gap-8">
            <span data-mark-ledger className="aspect-[883/44] w-full bg-current" />
            <span data-mark-ledger className="aspect-[636/44] w-[72%] bg-current" />
            <span data-mark-ledger className="aspect-[388/44] w-[44%] bg-current" />
          </div>
        </div>

        {CROPS.map((crop) => (
          <div
            key={crop.place}
            data-parallax={crop.drift}
            aria-hidden="true"
            className={cn("absolute -z-10", crop.place)}
          >
            <div data-crop className="size-full overflow-hidden rounded-full">
              <Image
                src={crop.src}
                alt=""
                width={320}
                height={320}
                sizes={crop.sizes ?? "120px"}
                className={cn("size-full object-cover", crop.position)}
              />
            </div>
          </div>
        ))}

        <div className="mx-auto max-w-[36rem]">
          <h2 className="font-display text-[36px] leading-[1.1] font-medium text-paper md:text-[64px]">
            Stop selling blind.
          </h2>
          <p data-follow className="mt-4 text-2xl leading-[1.25] text-sage">
            Buyers post today. Farmers near them see it today.
          </p>
          <div data-follow className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/auth/login"
              className={cn(buttonVariants({ variant: "highlight" }), ON_DARK_FOCUS, "w-full sm:w-auto")}
            >
              Post your demand
            </Link>
            <Link
              href="/auth/login"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                ON_DARK_FOCUS,
                "w-full border-paper text-paper hover:bg-field-soft hover:text-paper sm:w-auto",
              )}
            >
              See buyers near you
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
