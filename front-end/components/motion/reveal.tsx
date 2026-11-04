"use client";

import { type ReactNode, useRef } from "react";

import { type EffectConfig, type EffectName, fx, gsap, playOnEnter, useGSAP } from "@/lib/gsap/effects";

export function Reveal({
  effect = "riseIn",
  config,
  selector,
  start,
  className,
  children,
}: {
  effect?: EffectName;
  config?: EffectConfig;
  /** Animates matching descendants instead of the wrapper itself. */
  selector?: string;
  start?: string;
  className?: string;
  children: ReactNode;
}) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const element = scope.current;
      if (!element) return;

      const targets = selector ? gsap.utils.toArray<Element>(selector, element) : element;
      const animation = fx(effect, targets, config);
      if (!animation.scrollTrigger) playOnEnter(animation, element, start);
    },
    { scope },
  );

  return (
    <div ref={scope} className={className}>
      {children}
    </div>
  );
}
