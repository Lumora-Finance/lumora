"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { gsap, isReducedMotion } from "@/lib/gsap/effects";
import { loadingMessage } from "@/lib/loading-messages";
import { onTasksChange, setLoadingArea, taskCounts } from "@/lib/loading/progress";

/** A quick change shouldn't flicker a bar it never needed. */
const SHOW_AFTER_MS = 120;
const FAKE_LIMIT = 0.85;
const GIVE_UP_MS = 8000;

/**
 * Beat 1 between ordinary pages: the 6px bar under the top bar with its message on the left. It starts on any
 * click that leads to another dashboard page, and finishes once that page is showing and its data is in.
 */
export function RouteProgress({ area }: { area?: string | null }) {
  const pathname = usePathname();
  const fill = useRef<HTMLSpanElement>(null);
  const [going, setGoing] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const from = useRef(pathname);

  useEffect(() => setLoadingArea(area), [area]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname || !url.pathname.startsWith("/dashboard")) return;
      from.current = location.pathname;
      setGoing(url.pathname);
    }
    // In the capture phase, because a Next link has already called preventDefault by the time it bubbles.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!going) return;
    const reduced = isReducedMotion();
    const showTimer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    const bar = { value: 0 };
    const draw = () => gsap.set(fill.current, { scaleX: bar.value });
    const fake = gsap.to(bar, { value: FAKE_LIMIT, duration: reduced ? 0.01 : 2.5, ease: "power2.out", onUpdate: draw });
    let finishing: gsap.core.Tween | null = null;

    const finish = () => {
      if (finishing) return;
      fake.kill();
      clearTimeout(showTimer);
      finishing = gsap.to(bar, {
        value: 1,
        duration: 0.2,
        ease: "power2.out",
        onUpdate: draw,
        onComplete: () => {
          setVisible(false);
          setGoing(null);
        },
      });
    };
    const check = () => {
      if (location.pathname !== from.current && taskCounts().pending === 0) finish();
    };
    const stop = onTasksChange(check);
    const poll = setInterval(check, 80);
    const giveUp = setTimeout(finish, GIVE_UP_MS);
    return () => {
      stop();
      clearInterval(poll);
      clearTimeout(giveUp);
      clearTimeout(showTimer);
      fake.kill();
      finishing?.kill();
    };
  }, [going]);

  if (!going) return null;

  return (
    <div
      role="status"
      className={`pointer-events-none relative z-20 h-0 transition-opacity duration-150 motion-reduce:transition-none ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <div className="absolute inset-x-0 top-0 h-1.5 overflow-hidden bg-[#E3E7E1]">
        <span ref={fill} className="block h-full origin-left scale-x-0 bg-green" />
      </div>
      <p className="absolute top-3 left-4 rounded-md bg-paper/90 px-2 py-0.5 text-[13px] leading-5 font-medium text-ink lg:left-6">
        {loadingMessage(going, area)}
      </p>
    </div>
  );
}
