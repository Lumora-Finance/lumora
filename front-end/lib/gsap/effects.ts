import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

import { formatNaira } from "@/lib/format";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, Flip);

export { Flip, gsap, ScrollTrigger, SplitText, useGSAP };

export type EffectName =
  | "riseIn"
  | "wordReveal"
  | "countUp"
  | "capacityDrain"
  | "ledgerDraw"
  | "kernelRise"
  | "floatDrift"
  | "marquee"
  | "typeIn"
  | "chipPop"
  | "chaosToOrder"
  | "signalTravel"
  | "phoneBuzz"
  | "countDown"
  | "lineMorph"
  | "numberRoll";

export type EffectConfig = {
  stagger?: number;
  from?: number;
  to?: number;
  total?: number;
  unit?: string;
  format?: "naira" | "integer";
  label?: Element | null;
  button?: HTMLButtonElement | null;
  speed?: number;
  text?: string;
  duration?: number;
  fromValues?: number[];
  toValues?: number[];
  onFrame?: (values: number[]) => void;
  formatValue?: (value: number) => string;
  perCharacter?: number;
  path?: SVGPathElement;
  activePath?: SVGPathElement;
  direction?: 1 | -1;
  landings?: Element[];
  stage?: Element;
};

type EffectTargets = gsap.TweenTarget;

const integer = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

// gsap.matchMedia keeps this flag in step with the OS setting, including live changes.
let reducedMotion = false;

export function isReducedMotion() {
  return reducedMotion;
}

function fade(targets: EffectTargets) {
  return gsap.fromTo(targets, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "none" });
}

function firstElement<T extends Element = HTMLElement>(targets: EffectTargets) {
  return gsap.utils.toArray<T>(targets)[0];
}

const EFFECTS: Record<
  EffectName,
  { defaults?: EffectConfig; run: (targets: EffectTargets, config: EffectConfig) => gsap.core.Animation }
> = {
  riseIn: {
    defaults: { stagger: 0.08 },
    run: (targets, config) =>
      gsap.fromTo(
        targets,
        { autoAlpha: 0, y: 24 },
        { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: config.stagger },
      ),
  },

  wordReveal: {
    run: (targets) => {
      const split = SplitText.create(firstElement(targets), { type: "words", aria: "none" });
      return gsap.fromTo(
        split.words,
        { opacity: 0.18 },
        {
          opacity: 1,
          stagger: 0.1,
          ease: "none",
          scrollTrigger: {
            trigger: firstElement(targets),
            start: "top 80%",
            end: "bottom 40%",
            scrub: true,
          },
        },
      );
    },
  },

  countUp: {
    defaults: { from: 0, to: 0, format: "integer" },
    run: (targets, config) => {
      const element = firstElement(targets);
      const from = config.from ?? 0;
      const to = config.to ?? 0;
      const format = (value: number) =>
        config.format === "naira"
          ? formatNaira(Math.round(value), config.unit)
          : integer.format(Math.round(value));
      const counter = { value: from };

      element.textContent = format(from);
      return gsap.to(counter, {
        value: to,
        duration: 1.2,
        ease: "power2.out",
        onUpdate: () => {
          element.textContent = format(counter.value);
        },
      });
    },
  },

  capacityDrain: {
    defaults: { from: 0, to: 0 },
    run: (targets, config) => {
      const from = config.from ?? 0;
      const to = config.to ?? 0;
      const total = config.total ?? from;
      const counter = { value: from };
      const writeLabel = () => {
        const value = Math.round(counter.value);
        if (config.label) config.label.textContent = value <= 0 ? "Full" : `${value} left`;
      };

      return gsap
        .timeline({
          defaults: { duration: 0.6, ease: "power2.inOut" },
          onComplete: () => {
            if (to <= 0 && config.button) config.button.disabled = true;
          },
        })
        .fromTo(
          targets,
          { scaleX: from / total, transformOrigin: "left center" },
          { scaleX: to / total },
          0,
        )
        .to(counter, { value: to, onUpdate: writeLabel }, 0);
    },
  },

  ledgerDraw: {
    run: (targets) =>
      gsap.fromTo(
        targets,
        { scaleX: 0, transformOrigin: "center center" },
        { scaleX: 1, duration: 0.7, ease: "power3.out", stagger: 0.12 },
      ),
  },

  kernelRise: {
    run: (targets) => {
      const element = firstElement(targets);
      // The parent is the horizon. Its inset clip opens upwards as the kernel rises through it.
      return gsap
        .timeline()
        .fromTo(element, { yPercent: 60 }, { yPercent: 0, duration: 1, ease: "back.out(1.4)" }, 0)
        .fromTo(
          element.parentElement,
          { clipPath: "inset(100% 0% 0% 0%)" },
          {
            clipPath: "inset(-10% 0% 0% 0%)",
            duration: 0.8,
            ease: "power3.out",
            clearProps: "clipPath",
          },
          0,
        );
    },
  },

  floatDrift: {
    run: (targets) => {
      const timeline = gsap.timeline();
      gsap.utils.toArray<Element>(targets).forEach((target) => {
        timeline.to(
          target,
          {
            y: gsap.utils.random(4, 8) * (Math.random() < 0.5 ? -1 : 1),
            duration: gsap.utils.random(3, 5),
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
          },
          0,
        );
      });
      return timeline;
    },
  },

  marquee: {
    defaults: { speed: 40 },
    run: (targets, config) => {
      // The target holds two identical rows, so moving it by half its width loops seamlessly.
      const track = firstElement(targets);
      const tween = gsap.to(track, {
        xPercent: -50,
        duration: track.scrollWidth / 2 / (config.speed ?? 40),
        ease: "none",
        repeat: -1,
      });
      track.addEventListener("pointerenter", () => tween.pause());
      track.addEventListener("pointerleave", () => {
        if (!track.dataset.paused) tween.play();
      });
      return tween;
    },
  },

  chaosToOrder: {
    defaults: { stagger: 0.07, duration: 0.35 },
    run: (targets, config) => {
      const timeline = gsap.timeline();
      const duration = config.duration ?? 0.35;
      const stageBox = config.stage?.getBoundingClientRect();

      gsap.utils.toArray<HTMLElement>(targets).forEach((note, index) => {
        const landing = config.landings?.[index]?.getBoundingClientRect();
        if (!landing || !stageBox) return;

        const at = index * (config.stagger ?? 0.07);
        const flight = { duration, ease: "power3.inOut" };
        const chaos = note.querySelector("[data-face='chaos']");
        const field = note.querySelector<HTMLElement>("[data-face='field']");

        // The answer keeps its final width, so its text never reflows while the note resizes.
        if (field) gsap.set(field, { width: landing.width - 2 });

        timeline.to(
          note,
          {
            x: landing.left - stageBox.left - note.offsetLeft,
            y: landing.top - stageBox.top - note.offsetTop,
            rotation: 0,
            width: landing.width,
            height: landing.height,
            ...flight,
          },
          at,
        );
        // Halfway through the flight, the problem becomes the answer.
        timeline.fromTo(
          chaos,
          { opacity: 1 },
          { opacity: 0, duration: duration * 0.2, ease: "none" },
          at + duration * 0.4,
        );
        timeline.fromTo(
          field,
          { opacity: 0 },
          { opacity: 1, duration: duration * 0.2, ease: "none" },
          at + duration * 0.5,
        );
      });

      return timeline;
    },
  },

  chipPop: {
    defaults: { duration: 0.4 },
    run: (targets, config) =>
      gsap.fromTo(
        targets,
        { scale: 0.6, opacity: 0 },
        { scale: 1, opacity: 1, duration: config.duration, ease: "back.out(2.2)" },
      ),
  },

  typeIn: {
    defaults: { perCharacter: 0.12 },
    run: (targets, config) => {
      const element = firstElement(targets);
      const text = config.text ?? element.textContent ?? "";
      const typed = document.createTextNode("");
      const caret = document.createElement("span");
      const progress = { characters: 0 };

      caret.className = "type-caret";
      caret.setAttribute("aria-hidden", "true");
      caret.hidden = true;
      element.replaceChildren(typed, caret);

      return gsap.to(progress, {
        characters: text.length,
        duration: text.length * (config.perCharacter ?? 0.12),
        ease: "none",
        onStart: () => {
          typed.data = "";
          caret.hidden = false;
        },
        onUpdate: () => {
          typed.data = text.slice(0, Math.round(progress.characters));
        },
        onComplete: () => {
          typed.data = text;
          caret.hidden = true;
        },
      });
    },
  },

  signalTravel: {
    defaults: { direction: 1, duration: 1.3 },
    run: (targets, config) => {
      const { path, activePath, direction = 1 } = config;
      const travelled = { progress: 0 };
      // Reads the path on every frame, so a resize mid-flight can't leave the dot off the arc.
      const draw = () => {
        if (!path) return;
        const length = path.getTotalLength();
        const drawn = length * travelled.progress;
        const point = path.getPointAtLength(direction === 1 ? drawn : length - drawn);
        gsap.set(firstElement<SVGCircleElement>(targets), { attr: { cx: point.x, cy: point.y } });
        activePath?.setAttribute(
          "stroke-dasharray",
          direction === 1 ? `${drawn} ${length}` : `0 ${length - drawn} ${drawn} ${length}`,
        );
      };

      return gsap
        .timeline()
        .set([targets, activePath], { opacity: 1 })
        .fromTo(
          travelled,
          { progress: 0 },
          { progress: 1, duration: config.duration, ease: "power2.inOut", onUpdate: draw },
        )
        .to([targets, activePath], { opacity: 0, duration: 0.2, ease: "none" });
    },
  },

  phoneBuzz: {
    run: (targets) => {
      const step = { duration: 0.07, ease: "none" };
      return gsap
        .timeline()
        .to(targets, { x: -2, rotation: -0.8, ...step })
        .to(targets, { x: 2, rotation: 0.8, ...step })
        .to(targets, { x: -2, rotation: -0.8, ...step })
        .to(targets, { x: 2, rotation: 0.8, ...step })
        .to(targets, { x: 0, rotation: 0, ...step });
    },
  },

  lineMorph: {
    run: (_targets, config) => {
      const from = config.fromValues ?? [];
      const to = config.toValues ?? [];
      const morph = { progress: 0 };
      return gsap.to(morph, {
        progress: 1,
        duration: 0.7,
        ease: "power3.inOut",
        onUpdate: () => {
          config.onFrame?.(from.map((value, index) => value + (to[index] - value) * morph.progress));
        },
      });
    },
  },

  numberRoll: {
    defaults: { from: 0, to: 0 },
    run: (targets, config) => {
      const element = firstElement(targets);
      const format = config.formatValue ?? ((value: number) => String(value));
      const counter = { value: config.from ?? 0 };
      return gsap.to(counter, {
        value: config.to ?? 0,
        duration: 0.6,
        ease: "power3.out",
        onUpdate: () => {
          element.textContent = format(Math.round(counter.value));
        },
      });
    },
  },

  countDown: {
    defaults: { from: 0, to: 0 },
    run: (targets, config) => {
      const element = firstElement(targets);
      const counter = { value: config.from ?? 0 };
      return gsap.to(counter, {
        value: config.to ?? 0,
        duration: 0.7,
        ease: "power3.out",
        onUpdate: () => {
          element.textContent = String(Math.round(counter.value));
        },
      });
    },
  },
};

if (typeof window !== "undefined") {
  gsap
    .matchMedia()
    .add(
      { reduce: "(prefers-reduced-motion: reduce)", motion: "(prefers-reduced-motion: no-preference)" },
      (context) => {
        reducedMotion = Boolean(context.conditions?.reduce);
      },
    );

  (Object.keys(EFFECTS) as EffectName[]).forEach((name) => {
    gsap.registerEffect({
      name,
      extendTimeline: true,
      defaults: EFFECTS[name].defaults ?? {},
      effect: (targets: EffectTargets, config: EffectConfig) =>
        reducedMotion ? fade(targets) : EFFECTS[name].run(targets, config),
    });
  });
}

/** Typed access to `gsap.effects`. Effects are also chainable on any timeline. */
export function fx(name: EffectName, targets: EffectTargets, config: EffectConfig = {}) {
  const effects = gsap.effects as unknown as Record<
    EffectName,
    (targets: EffectTargets, config: EffectConfig) => gsap.core.Animation
  >;
  return effects[name](targets, config);
}

/** Runs a paused animation once, when its trigger scrolls into view. */
export function playOnEnter(animation: gsap.core.Animation, trigger: Element, start = "top 85%") {
  animation.pause(0);
  return ScrollTrigger.create({ trigger, start, once: true, onEnter: () => animation.play() });
}

/**
 * A panel settles into place as its section arrives. The radius is drawn with a clip-path,
 * over the panel's own 20px corners, so this stays on the compositor.
 */
export function panelEntrance(
  panel: Element,
  trigger: Element | null = panel.parentElement,
  { rounded = true }: { rounded?: boolean } = {},
) {
  return gsap.fromTo(
    panel,
    { scale: 0.94, ...(rounded ? { clipPath: "inset(0px round 32px)" } : {}) },
    {
      scale: 1,
      ...(rounded ? { clipPath: "inset(0px round 20px)" } : {}),
      ease: "none",
      scrollTrigger: { trigger, start: "top 90%", end: "top 40%", scrub: true },
    },
  );
}

/** Stops a looping animation while its section is off screen. */
export function pauseOffscreen(
  animations: gsap.core.Animation[],
  trigger: Element,
  canPlay: () => boolean = () => true,
) {
  const sync = (isActive: boolean) => {
    animations.forEach((animation) => {
      if (isActive && canPlay()) animation.play();
      else animation.pause();
    });
  };
  const scrollTrigger = ScrollTrigger.create({
    trigger,
    start: "top bottom",
    end: "bottom top",
    onToggle: (self) => sync(self.isActive),
  });
  sync(scrollTrigger.isActive);
  return scrollTrigger;
}

/** Recalculates every trigger, in page order, after layout has settled. */
export function refreshTriggers() {
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
}
