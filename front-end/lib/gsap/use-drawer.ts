"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from "react";

import { gsap, isReducedMotion, useGSAP } from "./effects";

/** How far, or how fast in px per ms, a swipe towards the edge has to go to close. */
const CLOSE_PX = 80;
const CLOSE_SPEED = 0.5;
/** Movement under this is a tap, so links inside still work. */
const DRAG_STARTS_PX = 8;
const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled])";

/**
 * A panel from the left edge. It arrives fast and settles, its contents cascade in behind it, and it
 * leaves quicker than it came. It can be swiped away, and stays on screen until that has played.
 * Render nothing while `shown` is false. `items` selects what cascades.
 */
export function useDrawer({
  open,
  onClose,
  items,
  backdrop,
  panel,
}: {
  open: boolean;
  onClose: () => void;
  items: string;
  backdrop: RefObject<HTMLDivElement | null>;
  panel: RefObject<HTMLDivElement | null>;
}) {
  const opener = useRef<HTMLElement | null>(null);
  const motion = useRef<gsap.core.Timeline | null>(null);
  const drag = useRef<{ x: number; y: number; at: number; distance: number; active: boolean; id: number } | null>(null);
  const dragged = useRef(false);

  const [shown, setShown] = useState(false);
  if (open && !shown) setShown(true);

  useGSAP(
    () => {
      if (!shown || !panel.current) return;
      const reduced = isReducedMotion();
      motion.current?.kill();

      if (open) {
        const timeline = gsap.timeline();
        motion.current = timeline;
        if (reduced) {
          timeline.fromTo([backdrop.current, panel.current], { opacity: 0, xPercent: 0 }, { opacity: 1, duration: 0.15 });
          return;
        }
        timeline
          .fromTo(backdrop.current, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "power2.out" }, 0)
          .fromTo(panel.current, { xPercent: -100, opacity: 1 }, { xPercent: 0, duration: 0.55, ease: "expo.out" }, 0)
          .fromTo(
            panel.current.querySelectorAll(items),
            { x: -24, opacity: 0 },
            { x: 0, opacity: 1, duration: 0.5, ease: "expo.out", stagger: 0.03, clearProps: "transform,opacity" },
            0.1,
          );
        return;
      }

      const timeline = gsap.timeline({
        onComplete: () => {
          setShown(false);
          opener.current?.focus({ preventScroll: true });
        },
      });
      motion.current = timeline;
      timeline
        .to(panel.current, reduced ? { opacity: 0, duration: 0.12 } : { xPercent: -100, x: 0, duration: 0.28, ease: "power3.in" }, 0)
        .to(backdrop.current, { opacity: 0, duration: reduced ? 0.12 : 0.28, ease: "power1.in" }, 0);
    },
    { dependencies: [open, shown] },
  );

  // Escape closes, Tab stays inside, and focus goes back to whatever opened it.
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel.current)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, shown, panel]);

  const swipe = {
    onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
      dragged.current = false;
      if (isReducedMotion() || (event.pointerType === "mouse" && event.button !== 0)) return;
      drag.current = { x: event.clientX, y: event.clientY, at: event.timeStamp, distance: 0, active: false, id: event.pointerId };
    },
    onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
      const state = drag.current;
      if (!state || !panel.current) return;
      const dx = event.clientX - state.x;
      if (!state.active) {
        if (Math.abs(event.clientY - state.y) > DRAG_STARTS_PX) {
          // They're scrolling the panel, not swiping it.
          drag.current = null;
          return;
        }
        if (dx > -DRAG_STARTS_PX) return;
        state.active = true;
        motion.current?.kill();
        event.currentTarget.setPointerCapture(state.id);
      }
      const width = panel.current.offsetWidth;
      state.distance = Math.max(-dx, 0);
      gsap.set(panel.current, { x: -state.distance });
      gsap.set(backdrop.current, { opacity: 1 - state.distance / width });
    },
    onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
      const state = drag.current;
      drag.current = null;
      if (!state?.active) return;
      dragged.current = true;
      if (state.distance >= CLOSE_PX || state.distance / Math.max(event.timeStamp - state.at, 1) >= CLOSE_SPEED) {
        onClose();
        return;
      }
      gsap.to(panel.current, { x: 0, duration: 0.4, ease: "expo.out" });
      gsap.to(backdrop.current, { opacity: 1, duration: 0.25 });
    },
    onPointerCancel() {
      if (drag.current?.active) {
        gsap.to(panel.current, { x: 0, duration: 0.4, ease: "expo.out" });
        gsap.to(backdrop.current, { opacity: 1, duration: 0.25 });
      }
      drag.current = null;
    },
    // A swipe that ended on a link mustn't also follow it.
    onClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
      if (dragged.current) {
        event.preventDefault();
        event.stopPropagation();
        dragged.current = false;
      }
    },
  };

  return { shown, swipe };
}
