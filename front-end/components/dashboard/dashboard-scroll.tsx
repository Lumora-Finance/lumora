"use client";

import { type ReactNode, useEffect, useRef } from "react";

import { ScrollTrigger } from "@/lib/gsap/effects";

/**
 * The panel the dashboard scrolls in. When its content changes height, such as after filtering,
 * triggers are re-measured, so a stale position can't leave something waiting to be revealed.
 */
export function DashboardScroll({ children }: { children: ReactNode }) {
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = panel.current;
    if (!root) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let height = root.scrollHeight;
    const observer = new ResizeObserver(() => {
      if (root.scrollHeight === height) return;
      height = root.scrollHeight;
      clearTimeout(timer);
      timer = setTimeout(() => ScrollTrigger.refresh(), 150);
    });
    Array.from(root.children).forEach((child) => observer.observe(child));
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  return (
    <main ref={panel} data-scroll-root className="flex-1 overflow-y-auto">
      {children}
    </main>
  );
}
