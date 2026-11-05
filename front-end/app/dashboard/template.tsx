"use client";

import { type ReactNode, useRef } from "react";

import { gsap, isReducedMotion, useGSAP } from "@/lib/gsap/effects";

/** A new one mounts on every navigation, so each page fades and rises 12px as it arrives. */
export default function DashboardTemplate({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (!root.current) return;
      if (isReducedMotion()) {
        gsap.fromTo(root.current, { opacity: 0 }, { opacity: 1, duration: 0.15, clearProps: "opacity" });
        return;
      }
      // The transform comes off when it's done. Left on, it would trap fixed elements like modals inside the page.
      gsap.fromTo(root.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out", clearProps: "transform,opacity" });
    },
    { scope: root },
  );
  return <div ref={root}>{children}</div>;
}
