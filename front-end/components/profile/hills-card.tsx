"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import Image from "next/image";

import { Skeleton } from "@/components/ui/skeleton";
import { gsap, isReducedMotion, useGSAP } from "@/lib/gsap/effects";

/** The dark pill that is a hills card's main action. */
export const HILLS_ACTION =
  "inline-flex min-h-14 w-full items-center justify-center rounded-full bg-ink px-10 text-[17px] font-medium text-paper transition-[background-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:bg-field focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:translate-y-0 active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:w-auto";

/** The quieter action beside it. */
export const HILLS_ACTION_QUIET =
  "inline-flex min-h-14 w-full items-center justify-center rounded-full border border-line bg-white px-10 text-[17px] font-medium text-ink transition-[border-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-ink/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:translate-y-0 active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:w-auto";

/**
 * The top of a page: misty hills fading into white. It plays its own entrance. Inside it, mark what
 * moves with data-card: "avatar", "rise", "icon" or "pop".
 */
export function HillsCard({ corner, className, children }: { corner?: ReactNode; className?: string; children: ReactNode }) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const scope = root.current;
      if (!scope) return;
      if (isReducedMotion()) {
        gsap.fromTo(scope, { opacity: 0 }, { opacity: 1, duration: 0.2, clearProps: "opacity" });
        return;
      }
      const timeline = gsap.timeline();
      const play = (part: string, from: gsap.TweenVars, to: gsap.TweenVars, at: number) => {
        const items = scope.querySelectorAll(`[data-card="${part}"]`);
        if (items.length) timeline.fromTo(items, from, to, at);
      };
      play("photo", { opacity: 0, scale: 1.14 }, { opacity: 1, scale: 1, duration: 1.7, ease: "expo.out" }, 0);
      play("avatar", { opacity: 0, scale: 0.6, y: 18 }, { opacity: 1, scale: 1, y: 0, duration: 0.75, ease: "back.out(1.7)" }, 0.18);
      play("rise", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.06, clearProps: "transform,opacity" }, 0.32);
      play("line", { scaleY: 0 }, { scaleY: 1, duration: 0.5, ease: "power3.out", stagger: 0.07, clearProps: "transform" }, 0.62);
      play("icon", { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2.2)", stagger: 0.05, clearProps: "transform,opacity" }, 0.6);
      play("pop", { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.55, ease: "back.out(1.9)", clearProps: "transform,opacity" }, 0.5);
      // The mist never quite stops moving.
      gsap.to(scope.querySelectorAll('[data-card="mist"]'), { xPercent: 9, duration: 16, ease: "sine.inOut", repeat: -1, yoyo: true, stagger: 2 });
    },
    { scope: root },
  );

  return (
    <section ref={root} className={`relative isolate overflow-hidden rounded-[28px] border border-line bg-white ${className ?? ""}`}>
      <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-[62%] overflow-hidden bg-[#DDE1DA] sm:h-[74%]">
        <div data-card="photo" className="absolute inset-0">
          <Image src="/images/profile-hills.jpg" alt="" fill priority sizes="(max-width: 1120px) 100vw, 1120px" className="object-cover object-[60%_30%]" />
        </div>
        <div data-card="mist" className="absolute -left-[10%] bottom-[6%] h-[24%] w-[60%] rounded-full bg-white/25 blur-3xl" />
        <div data-card="mist" className="absolute -right-[6%] bottom-[8%] h-[28%] w-[50%] rounded-full bg-white/35 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent from-30% via-white/70 via-72% to-white" />
      </div>

      {corner && (
        <div data-card="pop" className="absolute top-4 right-4 sm:top-6 sm:right-6 lg:top-8 lg:right-10">
          {corner}
        </div>
      )}

      {children}
    </section>
  );
}

/**
 * A row of figures with thin lines between them. A null value shows as still loading. `rowsOnPhones`
 * is for values too long for three narrow columns, such as money.
 */
export function HillsStats({ stats, rowsOnPhones = false }: { stats: Array<{ value: ReactNode | null; label: string }>; rowsOnPhones?: boolean }) {
  const columns = stats.map(() => "1fr").join(" auto ");
  return (
    <div
      className={rowsOnPhones ? "flex flex-col gap-1.5 sm:flex-row sm:items-center" : "grid items-center sm:flex"}
      style={rowsOnPhones ? undefined : { gridTemplateColumns: columns }}
    >
      {stats.map((stat, index) => (
        <div key={stat.label} className="contents">
          {index > 0 && <span data-card="line" aria-hidden="true" className={`h-14 w-px origin-center bg-line ${rowsOnPhones ? "hidden sm:block" : ""}`} />}
          <div
            data-card="rise"
            className={
              rowsOnPhones
                ? "flex min-w-0 flex-row-reverse items-baseline justify-between gap-4 text-center sm:block sm:px-6 sm:first:pl-0"
                : "min-w-0 px-2 text-center first:pl-0 sm:px-6 sm:first:pl-0"
            }
          >
            <div className="text-[18px] leading-7 font-medium text-ink">
              {stat.value ?? <Skeleton aria-label="Loading" className="mx-auto h-7 w-8" />}
            </div>
            <p className="mt-0.5 text-body-sm leading-5 text-ink-muted">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
