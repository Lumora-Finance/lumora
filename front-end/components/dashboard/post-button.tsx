"use client";

import { ArrowRight, Bird, Egg, ShoppingBasket, Sprout, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { gsap, isReducedMotion, useGSAP } from "@/lib/gsap/effects";
import { wipeFrom } from "@/lib/gsap/page-wipe";
import { cn } from "@/lib/utils";

/** The produce on the board, where the sample has emojis. BRAND.md allows none. */
const PRODUCE = [
  { Icon: Bird, tilt: "-rotate-6", tone: "bg-sage-soft text-green" },
  { Icon: Egg, tilt: "", tone: "bg-amber-soft text-[#9A6A1A]" },
  { Icon: Sprout, tilt: "rotate-6", tone: "bg-sage-soft text-green" },
];

const CHOICES = [
  {
    key: "demand",
    title: "Post demand",
    description: "I need produce. Farmers book it.",
    href: "/dashboard/listings/new",
    Icon: ShoppingBasket,
    tone: "bg-sage-soft text-green group-hover:bg-green group-hover:text-paper",
    note: null,
    wipe: true,
  },
  {
    // Until verification is real for each person, this always leads to it.
    key: "listing",
    title: "List produce",
    description: "I have produce. Buyers find it.",
    href: "/dashboard/profile",
    Icon: Sprout,
    tone: "bg-amber-soft text-[#9A6A1A] group-hover:bg-[#9A6A1A] group-hover:text-paper",
    note: "Verify first",
    wipe: false,
  },
];

const FOCUSABLE = "button:not([disabled]), a[href]";
/** Below this it's a sheet from the bottom edge. At and above it, a centred card. */
const isCard = () => window.matchMedia("(min-width: 640px)").matches;
/** How far, or how fast in px per ms, a swipe down has to go to dismiss the sheet. */
const DISMISS_PX = 90;
const DISMISS_SPEED = 0.5;

export function PostModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const goingTo = useRef<string | null>(null);
  const wiping = useRef(false);
  const drag = useRef<{ y: number; at: number; last: number } | null>(null);
  const motion = useRef<gsap.core.Timeline | null>(null);

  // Stays on screen after `open` turns false, until the way out has played.
  const [shown, setShown] = useState(false);
  if (open && !shown) setShown(true);

  useGSAP(
    () => {
      const scope = root.current;
      if (!scope || !shown) return;
      const parts = (name: string) => scope.querySelectorAll(`[data-modal="${name}"]`);
      const reduced = isReducedMotion();
      motion.current?.kill();

      if (open) {
        const timeline = gsap.timeline();
        motion.current = timeline;
        timeline.fromTo(parts("backdrop"), { opacity: 0 }, { opacity: 1, duration: reduced ? 0.15 : 0.28, ease: "power2.out" }, 0);
        if (reduced) {
          timeline.fromTo(card.current, { opacity: 0 }, { opacity: 1, duration: 0.15 }, 0);
          gsap.set(parts("frame"), { opacity: 1, rotate: -3 });
          return;
        }
        // A card lands tilted and settles level, and a sheet slides up from the edge. The frame keeps
        // the tilt, so words never stay slanted.
        if (isCard()) {
          timeline.fromTo(card.current, { opacity: 0, y: 36, rotate: 4, scale: 0.96 }, { opacity: 1, y: 0, rotate: 0, scale: 1, duration: 0.6, ease: "back.out(1.5)" }, 0.04);
        } else {
          timeline.fromTo(card.current, { y: card.current?.offsetHeight ?? 500, opacity: 1 }, { y: 0, duration: 0.6, ease: "expo.out" }, 0.02);
        }
        timeline
          .fromTo(parts("frame"), { opacity: 0, rotate: 0, scale: 0.97 }, { opacity: 1, rotate: -3, scale: 1, duration: 0.65, ease: "back.out(1.7)" }, 0.12)
          .fromTo(parts("icon"), { opacity: 0, y: 12, scale: 0.5 }, { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: "back.out(2.4)", stagger: 0.06 }, 0.2)
          .fromTo(parts("rise"), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.38, ease: "power2.out", stagger: 0.05 }, 0.26);
        return;
      }

      const finish = () => {
        setShown(false);
        if (goingTo.current) router.push(goingTo.current);
        else opener.current?.focus({ preventScroll: true });
        goingTo.current = null;
      };
      const timeline = gsap.timeline({ onComplete: finish });
      motion.current = timeline;
      timeline
        .to(
          card.current,
          reduced
            ? { opacity: 0, duration: 0.12 }
            : isCard()
              ? { opacity: 0, y: 14, rotate: -1.5, scale: 0.98, duration: 0.2, ease: "power2.in" }
              : { y: card.current?.offsetHeight ?? 500, duration: 0.24, ease: "power2.in" },
          0,
        )
        .to(parts("frame"), { opacity: 0, duration: 0.15 }, 0)
        .to(parts("backdrop"), { opacity: 0, duration: 0.22, ease: "power1.in" }, 0.02);
    },
    { dependencies: [open, shown] },
  );

  // Keyboard: Escape closes, and Tab stays inside until then.
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    // So the page is ready when the wipe has covered the screen.
    router.prefetch("/dashboard/listings/new");
    card.current?.focus({ preventScroll: true });
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !card.current) return;
      const items = Array.from(card.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === card.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, router]);

  if (!shown) return null;

  // Swiping the top of the sheet follows the finger, and past a point lets it go.
  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (isCard() || isReducedMotion()) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    motion.current?.kill();
    drag.current = { y: event.clientY, at: event.timeStamp, last: 0 };
    gsap.set(root.current?.querySelector('[data-modal="frame"]') ?? null, { opacity: 0 });
  }
  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const distance = Math.max(event.clientY - drag.current.y, 0);
    drag.current.last = distance;
    gsap.set(card.current, { y: distance });
    const height = card.current?.offsetHeight ?? 500;
    gsap.set(root.current?.querySelector('[data-modal="backdrop"]') ?? null, { opacity: 1 - distance / height });
  }
  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const { last, at } = drag.current;
    drag.current = null;
    if (last >= DISMISS_PX || last / Math.max(event.timeStamp - at, 1) >= DISMISS_SPEED) {
      onClose();
      return;
    }
    gsap.to(card.current, { y: 0, duration: 0.45, ease: "back.out(1.6)" });
    gsap.to(root.current?.querySelector('[data-modal="backdrop"]') ?? null, { opacity: 1, duration: 0.25 });
    gsap.to(root.current?.querySelector('[data-modal="frame"]') ?? null, { opacity: 1, duration: 0.25 });
  }

  function choose(href: string, wipe: boolean, tile: HTMLElement) {
    if (!wipe) {
      goingTo.current = href;
      onClose();
      return;
    }
    if (wiping.current) return;
    wiping.current = true;
    // The tile opens out to fill the screen. Under that cover, the modal goes and the page changes.
    wipeFrom(tile.getBoundingClientRect(), "Post demand", () => {
      wiping.current = false;
      motion.current?.kill();
      setShown(false);
      onClose();
      router.push(href);
    });
  }

  // On the body, so a moving or scrolling dashboard panel can't shift it or scroll behind it.
  return createPortal(
    <div
      ref={root}
      className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden overscroll-contain sm:items-center sm:p-4"
    >
      <div data-modal="backdrop" aria-hidden="true" className="absolute inset-0 bg-field/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-[560px]">
        {/* Hidden when the screen is too short to show it around the card. */}
        <div
          data-modal="frame"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[28px] border-[1.5px] sm:rounded-[32px] border-paper/50 [@media(max-height:560px)]:hidden"
        />

        <div
          ref={card}
          role="dialog"
          aria-modal="true"
          aria-labelledby="post-modal-title"
          aria-describedby="post-modal-lead"
          tabIndex={-1}
          className="relative max-h-[calc(100svh-2rem)] overflow-y-auto overscroll-contain rounded-t-[28px] bg-white px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-center shadow-[0_24px_60px_-20px_rgb(14_46_35/0.45)] outline-none sm:rounded-[32px] sm:px-8 sm:pt-8 sm:pb-5"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-full text-ink transition-colors duration-150 hover:bg-sage-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:top-4 sm:right-4"
          >
            <X aria-hidden="true" strokeWidth={1.75} className="size-5" />
          </button>

          {/* The part of the sheet you can swipe. The handle says so, and it has no job on a card. */}
          <div
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="touch-none select-none pt-2.5 sm:touch-auto sm:select-auto sm:pt-0"
          >
            <span aria-hidden="true" className="mx-auto mb-4 block h-1 w-10 rounded-full bg-line sm:hidden" />
            <div aria-hidden="true" className="flex justify-center -space-x-2 sm:gap-2.5 sm:space-x-0">
              {PRODUCE.map(({ Icon, tilt, tone }, index) => (
                <span key={index} data-modal="icon" className={cn("flex size-10 items-center justify-center rounded-full ring-3 ring-white sm:size-11 sm:ring-0", tilt, tone)}>
                  <Icon strokeWidth={1.75} className="size-[18px] sm:size-5" />
                </span>
              ))}
            </div>
            <h2 id="post-modal-title" data-modal="rise" className="mt-3 font-display text-[24px] leading-[1.2] font-medium text-balance text-ink sm:mt-4 sm:text-[30px]">
              What do you want to post?
            </h2>
            <p id="post-modal-lead" data-modal="rise" className="mt-1.5 hidden text-ink-muted sm:block">
              Choose one to get started.
            </p>
          </div>

          <div className="mt-4 grid gap-2.5 text-left sm:mt-6 sm:grid-cols-2 sm:gap-3">
            {CHOICES.map(({ key, title, description, href, Icon, tone, note, wipe }) => (
              <button
                key={key}
                type="button"
                data-modal="rise"
                onClick={(event) => choose(href, wipe, event.currentTarget)}
                className="group flex items-center gap-3 rounded-[20px] border border-line bg-white p-3 text-left transition-[border-color,background-color,transform] duration-200 ease-out [-webkit-tap-highlight-color:transparent] hover:border-green hover:bg-paper/50 focus-visible:border-green focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 sm:flex-col sm:items-start sm:p-5"
              >
                <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl transition-colors duration-200", tone)}>
                  <Icon aria-hidden="true" strokeWidth={1.75} className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium text-ink">
                    {title}
                    <ArrowRight aria-hidden="true" strokeWidth={2} className="hidden size-4 text-ink-muted transition-transform duration-200 ease-out group-hover:translate-x-1 group-hover:text-green motion-reduce:transition-none sm:block" />
                    {note && <span className="rounded-full bg-amber-soft px-2 py-px text-xs font-medium text-[#9A6A1A] sm:hidden">{note}</span>}
                  </span>
                  <span className="mt-0.5 block text-body-sm text-ink-muted sm:mt-1">{description}</span>
                  {note && <span className="mt-2 hidden rounded-full bg-amber-soft px-2.5 py-0.5 text-xs font-medium text-[#9A6A1A] sm:inline-block">{note}</span>}
                </span>
                <ArrowRight aria-hidden="true" strokeWidth={2} className="size-4 shrink-0 text-ink-muted sm:hidden" />
              </button>
            ))}
          </div>

          <button
            type="button"
            data-modal="rise"
            onClick={onClose}
            className="mt-1 min-h-12 rounded-full px-5 text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:mt-3"
          >
            Not now
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
