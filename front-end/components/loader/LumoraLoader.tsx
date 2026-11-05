"use client";

import { useEffect, useRef, useState } from "react";

import { gsap, isReducedMotion } from "@/lib/gsap/effects";
import type { MomentFinal } from "@/lib/loading/moment";

const RING_RADIUS = 47;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const FAKE_LIMIT = 0.85;

/**
 * First load has to stay within 900ms of motion after the data is ready, so its beats overlap. Key moments
 * are something to read, so they take their time. The clock for both starts when the work is done.
 */
// A little under 0.9, to leave room for the frame or two it takes to start and to clean up.
const FIRST_LOAD_BUDGET = 0.84;
const FIRST_LOAD = { fill: 0.08, morph: 0.46, ringIn: 0.18, slide: 0.22, count: 0.2, hold: 0, lift: 0.24, overlap: 0.13, fastTotal: 0.44 };
const KEY_MOMENT = { fill: 0.12, morph: 0.7, ringIn: 0.3, slide: 0.45, count: 0.9, hold: 1.2, lift: 0.5, overlap: 0, fastTotal: 0 };

/** Beat 1 on its own: the paper stage and the bar. Also what a whole page shows while it checks who you are. */
export function LoaderStage({ label, fill, track, labelRef }: {
  label: string;
  fill?: React.Ref<HTMLSpanElement>;
  track?: React.Ref<HTMLDivElement>;
  labelRef?: React.Ref<HTMLParagraphElement>;
}) {
  const own = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    // With no real progress to show, this eases to 85% and waits, and the page behind it takes over.
    if (fill || !own.current) return;
    if (isReducedMotion()) {
      gsap.set(own.current, { scaleX: FAKE_LIMIT });
      return;
    }
    const tween = gsap.fromTo(own.current, { scaleX: 0 }, { scaleX: FAKE_LIMIT, duration: 3, ease: "power2.out" });
    return () => void tween.kill();
  }, [fill]);

  return (
    <div role="status" aria-label={label} className="lumora-stage absolute inset-0 flex items-center justify-center px-6">
      <div className="w-full max-w-[320px]">
        <p ref={labelRef} className="mb-3 text-[13px] leading-5 font-medium text-ink">{label}</p>
        <div ref={track} className="h-1.5 overflow-hidden rounded-full bg-[#E3E7E1]">
          <span ref={fill ?? own} className="block h-full origin-left scale-x-0 rounded-full bg-green" />
        </div>
      </div>
    </div>
  );
}

/** A stage that fills the screen, for a page with nothing to show until it knows who you are. */
export function LoaderScreen({ label }: { label: string }) {
  return (
    <div className="relative min-h-svh">
      <LoaderStage label={label} />
    </div>
  );
}

/**
 * The bar becomes the page. Beat 1 waits on real work. Beat 2 turns the bar into the surface. Beat 3 is that
 * surface, alive. Beat 4 says what's ready, then lifts away to show the page rising underneath.
 */
export function LumoraLoader({
  label,
  work,
  progress,
  timing = "moment",
  whenCovered,
  onDone,
}: {
  label: string;
  work: Promise<MomentFinal>;
  /** Real progress from 0 to 1, when there is any. The fake only ever moves ahead of it up to 85%. */
  progress?: () => number;
  timing?: "first" | "moment";
  whenCovered?: () => void;
  onDone: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const stageLabel = useRef<HTMLParagraphElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const morph = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const ringGroup = useRef<HTMLDivElement>(null);
  const ringArc = useRef<SVGCircleElement>(null);
  const ringText = useRef<HTMLSpanElement>(null);
  const words = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLParagraphElement>(null);
  const line = useRef<HTMLParagraphElement>(null);
  const [announced, setAnnounced] = useState("");

  // Kept in refs so a parent's re-render can't restart the sequence.
  const callbacks = useRef({ whenCovered, onDone, progress });
  useEffect(() => {
    callbacks.current = { whenCovered, onDone, progress };
  });

  useEffect(() => {
    const reduced = isReducedMotion();
    const beats = timing === "first" ? FIRST_LOAD : KEY_MOMENT;
    const startedAt = performance.now();
    let cancelled = false;
    let running: gsap.core.Animation | null = null;
    const shown = { value: 0 };

    const drawFill = () => gsap.set(fill.current, { scaleX: shown.value });
    // The fake never overtakes 85%, and real progress can pass it only up to just short of done.
    const fake = gsap.to(shown, {
      value: FAKE_LIMIT,
      duration: reduced ? 0.01 : 3,
      ease: "power2.out",
      onUpdate: () => {
        const real = callbacks.current.progress?.() ?? 0;
        if (real * 0.97 > shown.value) shown.value = real * 0.97;
        drawFill();
      },
    });

    const whereWords = () => {
      const width = window.innerWidth;
      const slide = Math.min(120, width / 2 - 64);
      if (words.current) {
        words.current.style.left = `${width / 2 - slide + 48 + 16}px`;
        words.current.style.maxWidth = `${Math.min(460, width - (width / 2 - slide + 48 + 16) - 16)}px`;
      }
      return slide;
    };

    function setRing(final: MomentFinal, to: { fraction: number; count: number }) {
      if (ringArc.current) ringArc.current.style.strokeDashoffset = String(RING_LENGTH * (1 - to.fraction));
      if (ringText.current) {
        ringText.current.textContent = final.number !== undefined ? String(Math.round(to.count)) : (final.text ?? "");
        const length = ringText.current.textContent.length;
        ringText.current.style.fontSize = length > 6 ? "14px" : length > 3 ? "18px" : "26px";
      }
    }

    function finish() {
      if (!cancelled) callbacks.current.onDone();
    }

    /** Waits for the page underneath to exist, since a key moment may have just navigated to it. */
    function rise(timeline: gsap.core.Timeline, at: number, duration: number) {
      timeline.add(() => {
        const page = document.querySelector("[data-scroll-root]");
        if (page && !reduced) {
          gsap.fromTo(page, { y: 16, opacity: 0.4 }, { y: 0, opacity: 1, duration: duration + 0.15, ease: "power3.out", clearProps: "transform,opacity" });
        }
      }, at);
    }

    function play(final: MomentFinal, showMorph: boolean) {
      if (top.current) top.current.textContent = final.top;
      if (line.current) line.current.textContent = final.line;
      setAnnounced(`${final.top}. ${final.line}`);
      const slide = whereWords();
      const counter = { fraction: 0, count: 0 };
      const toCount = { fraction: final.fraction, count: final.number ?? 0 };
      setRing(final, counter);

      if (reduced) {
        setRing(final, toCount);
        const timeline = gsap.timeline({ onComplete: finish });
        running = timeline;
        gsap.set(ringGroup.current, { opacity: 1, scale: 1, x: -slide });
        gsap.set(words.current, { opacity: 1, x: 0 });
        timeline
          .to(surface.current, { opacity: 1, duration: 0.15 })
          .set(stage.current, { visibility: "hidden" })
          .call(() => callbacks.current.whenCovered?.())
          .to(root.current, { opacity: 0, duration: 0.2 }, timing === "first" ? "+=0.2" : "+=1.4");
        return;
      }

      const timeline = gsap.timeline({ onComplete: finish });
      running = timeline;
      let t = 0;

      if (showMorph && track.current && morph.current) {
        const rect = track.current.getBoundingClientRect();
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;
        const offset = rect.top + rect.height / 2 - viewportH / 2;
        // Tall enough to cover the screen from corner to corner, even tilted.
        const cover = (Math.hypot(viewportW, viewportH) * 1.5) / 120;

        timeline.to(shown, { value: 1, duration: beats.fill, ease: "power2.out", onUpdate: drawFill }, 0);
        t = beats.fill;
        timeline
          .to([stageLabel.current, track.current], { opacity: 0, duration: Math.min(0.15, beats.morph / 3), ease: "none" }, t)
          .set(morph.current, { visibility: "visible", y: offset, scaleX: Math.min(1, rect.width / 320), scaleY: 6 / 120, backgroundColor: "#1F5C45" }, t)
          .to(morph.current, { scaleY: 40 / 120, duration: beats.morph * 0.18, ease: "power2.out" }, t)
          .to(morph.current, { y: 0, scaleX: 1, scaleY: 1, duration: beats.morph * 0.2, ease: "power2.inOut" }, t + beats.morph * 0.18)
          .to(morph.current, { rotateX: 8, rotateZ: -4, scale: cover, backgroundColor: "#0E2E23", duration: beats.morph * 0.62, ease: "power3.inOut" }, t + beats.morph * 0.38);
        t += beats.morph;
        // The stage goes now it's covered, so the lift shows the page and not the stage.
        timeline.set(surface.current, { opacity: 1 }, t).set([morph.current, stage.current], { visibility: "hidden" }, t);
      } else {
        // Ready almost at once, so there's nothing to wait through. Straight to the surface.
        timeline.to(surface.current, { opacity: 1, duration: 0.1, ease: "none" }, 0);
        t = 0.1;
        timeline.set(stage.current, { visibility: "hidden" }, t);
      }
      timeline.call(() => callbacks.current.whenCovered?.(), undefined, t);

      if (beats.fastTotal && !showMorph) {
        // Under 300ms of data: beat 4 alone, for 500ms all told.
        const end = beats.fastTotal;
        gsap.set(ringGroup.current, { x: -slide });
        gsap.set(words.current, { x: 0 });
        setRing(final, toCount);
        timeline
          .to(ringGroup.current, { opacity: 1, scale: 1, duration: 0.14, ease: "power2.out" }, 0.04)
          .to(words.current, { opacity: 1, duration: 0.14, ease: "power2.out" }, 0.08)
          .to(surface.current, { y: -24, opacity: 0, duration: 0.2, ease: "power2.in" }, end - 0.2);
        rise(timeline, end - 0.2, 0.2);
        return;
      }

      const ringAt = Math.max(t - beats.overlap, 0);
      timeline.to(ringGroup.current, { opacity: 1, scale: 1, duration: beats.ringIn, ease: "power3.out" }, ringAt);
      timeline.to(counter, {
        fraction: toCount.fraction,
        count: toCount.count,
        duration: beats.count,
        ease: "power2.out",
        onUpdate: () => setRing(final, counter),
      }, ringAt);
      const slideAt = timing === "first" ? ringAt + beats.ringIn - 0.06 : ringAt + 0.3 + beats.ringIn;
      timeline
        .to(ringGroup.current, { x: -slide, duration: beats.slide, ease: "power3.inOut" }, slideAt)
        .fromTo(words.current, { opacity: 0, x: 48 }, { opacity: 1, x: 0, duration: beats.slide, ease: "power3.out" }, slideAt);
      const liftAt = timing === "first"
        ? FIRST_LOAD_BUDGET - beats.lift
        : Math.max(slideAt + beats.slide, ringAt + beats.count) + beats.hold;
      timeline.to(surface.current, { y: -24, opacity: 0, duration: beats.lift, ease: "power2.in" }, liftAt);
      rise(timeline, liftAt, beats.lift);
    }

    work.then(
      (final) => {
        if (cancelled) return;
        fake.kill();
        play(final, performance.now() - startedAt >= 300);
      },
      () => {
        if (!cancelled) finish();
      },
    );

    return () => {
      cancelled = true;
      fake.kill();
      running?.kill();
      gsap.killTweensOf(shown);
    };
  }, [work, timing]);

  return (
    <div ref={root} className="fixed inset-0 z-[70] overflow-hidden">
      <div ref={stage} className="absolute inset-0">
        <LoaderStage label={label} fill={fill} track={track} labelRef={stageLabel} />
      </div>

      {/* The bar, grown. Perspective on the parent is what makes the tilt read as 3D. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center [perspective:1200px]">
        <div ref={morph} className="invisible h-[120px] w-[320px] rounded-xl bg-green [will-change:transform]" />
      </div>

      <div ref={surface} className="absolute inset-0 overflow-hidden bg-field opacity-0">
        <div aria-hidden="true" className="lumora-blob lumora-blob-a" />
        <div aria-hidden="true" className="lumora-blob lumora-blob-b" />
        <div aria-hidden="true" className="lumora-blob lumora-blob-c" />
        <div aria-hidden="true" className="lumora-grain absolute inset-0" />

        <div ref={ringGroup} aria-hidden="true" className="absolute top-1/2 left-1/2 -mt-12 -ml-12 size-24 scale-90 opacity-0">
          <svg viewBox="0 0 96 96" className="size-full -rotate-90">
            <circle cx="48" cy="48" r={RING_RADIUS} fill="none" strokeWidth="2" stroke="rgba(246,243,236,.25)" />
            <circle
              ref={ringArc}
              cx="48"
              cy="48"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              stroke="#F6F3EC"
              strokeDasharray={RING_LENGTH}
              strokeDashoffset={RING_LENGTH}
            />
          </svg>
          <span ref={ringText} className="absolute inset-0 flex items-center justify-center font-num font-medium text-paper" />
        </div>

        <div ref={words} aria-hidden="true" className="absolute top-1/2 -translate-y-1/2 opacity-0">
          <p ref={top} className="text-body-sm text-sage" />
          <p ref={line} className="mt-0.5 text-[22px] leading-[1.25] font-medium text-paper sm:text-[28px]" />
        </div>
        <span role="status" className="sr-only">{announced}</span>
      </div>
    </div>
  );
}
