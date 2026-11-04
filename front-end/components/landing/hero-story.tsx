"use client";

import { Check } from "lucide-react";
import Image from "next/image";
import { type ReactNode, useRef } from "react";

import { Num } from "@/components/landing/shared";
import { formatNaira } from "@/lib/format";
import {
  Flip,
  fx,
  gsap,
  isReducedMotion,
  playOnEnter,
  refreshTriggers,
  SplitText,
  useGSAP,
} from "@/lib/gsap/effects";
import { kernelPoints, roundedRectPoints, toPolygon } from "@/lib/shapes";

// Pexels photo 33624059, free licence. Must not imply this person endorses Lumora.
const PHOTO = "/images/hero-market.jpg";
const HERO_RADIUS = 16;

const PAYOUT = 323400;
const COUNT_DURATION = 0.05;

// The reveal: words share this stretch of the timeline, and the turning line sits between.
const REVEAL_START = 0.4;
const REVEAL_LENGTH = 0.55;
const TURN_DURATION = 0.06;

// Where the woman's face sits in the photo, in percent, so the kernel is centred on it.
const FACE = { desktop: { x: 31, y: 27, zoom: 2.2 }, mobile: { x: 52, y: 30, zoom: 1.6 } };
// How big the kernel starts, before it flies into its place in the text.
const START_HEIGHT = { desktop: 0.2, mobile: 0.22 };

const CHIP_TEXT = "text-[0.46em] leading-none";

function Chip({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      data-chip
      className={`mx-[0.1em] inline-flex h-[0.9em] items-center gap-[0.2em] rounded-[10px] px-[0.3em] align-middle whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  );
}

function Strong({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-ink">{children}</span>;
}

function buildTimeline(root: HTMLElement, isDesktop: boolean) {
  const q = gsap.utils.selector(root);
  const stage = q<HTMLElement>("[data-stage]")[0];
  const photo = q<HTMLElement>("[data-photo]")[0];
  const inner = q<HTMLElement>("[data-photo-inner]")[0];
  const image = q<HTMLElement>("[data-photo-image]")[0];
  const story = q<HTMLElement>("[data-paragraph]")[0];
  const turn = q<HTMLElement>("[data-turn]")[0];
  const paragraphs = q<HTMLElement>("[data-story-text]");
  const payout = q<HTMLElement>("[data-payout-count]")[0];
  const target = q<HTMLElement>(isDesktop ? "[data-target-inline]" : "[data-target-kernel]")[0];

  SplitText.create(paragraphs, {
    type: "words",
    tag: "span",
    wordsClass: "story-word",
    ignore: "[data-chip], [data-target-inline]",
    aria: "none",
  });

  // Measured after splitting, because that's the layout the photo has to land in.
  const landing = target.getBoundingClientRect();
  const stageBox = stage.getBoundingClientRect();
  const kernel = toPolygon(kernelPoints());
  const face = isDesktop ? FACE.desktop : FACE.mobile;

  // It starts as a larger copy of where it lands, centred in the dark, so the flight is one
  // uniform scale and the crop never distorts.
  const startScale =
    (window.innerHeight * (isDesktop ? START_HEIGHT.desktop : START_HEIGHT.mobile)) / landing.height;
  const startWidth = landing.width * startScale;
  const startHeight = landing.height * startScale;
  gsap.set(photo, {
    width: startWidth,
    height: startHeight,
    left: (stageBox.width - startWidth) / 2,
    top: (stageBox.height - startHeight) / 2,
    clipPath: kernel,
  });
  // The inner layer is slightly smaller, so the paper behind it shows as a 1px edge on landing.
  gsap.set(inner, {
    clipPath: kernel,
    scaleX: 1 - 2 / landing.width,
    scaleY: 1 - 2 / landing.height,
  });
  gsap.set(image, {
    scale: face.zoom,
    xPercent: (50 - face.x) * face.zoom,
    yPercent: (50 - face.y) * face.zoom,
  });

  // Worked out from the playhead on every update, not by tweening. A fast flick can jump a
  // whole tween in one frame, and this number must never disagree with the scroll position.
  let payoutStart = 1;
  const syncPayout = () => {
    const progress = gsap.utils.clamp(0, 1, (timeline.time() - payoutStart) / COUNT_DURATION);
    const text = formatNaira(Math.round(PAYOUT * progress));
    if (payout.textContent !== text) payout.textContent = text;
  };

  const timeline: gsap.core.Timeline = gsap.timeline({
    defaults: { ease: "none" },
    onUpdate: syncPayout,
    scrollTrigger: {
      trigger: stage,
      pin: true,
      pinSpacing: true,
      start: "top top",
      end: `+=${isDesktop ? 250 : 180}%`,
      scrub: 0.8,
      invalidateOnRefresh: true,
    },
  });

  // 0.05 to 0.40: the kernel flies into the text.
  timeline.add(
    Flip.fit(photo, target, { duration: 0.35, ease: "power2.inOut", scale: true }) as gsap.core.Tween,
    0.05,
  );

  // 0.12 to 0.40: the lights come on.
  timeline.fromTo(
    stage,
    { backgroundColor: "#0E2E23" },
    { backgroundColor: "#F6F3EC", duration: 0.28 },
    0.12,
  );
  // Ink text stays hidden until the page is light enough, so it never sits at low contrast.
  timeline.fromTo(story, { opacity: 0 }, { opacity: 1, duration: 0.08 }, 0.3);

  // 0.40 to 0.95: the first paragraph word by word, the turning line, then the second paragraph
  // with its chips popping in as the reading reaches them.
  const [first, second] = paragraphs.map((paragraph) =>
    Array.from(paragraph.querySelectorAll<HTMLElement>(".story-word, [data-chip]")),
  );
  const count = first.length + second.length;
  const wordDuration = Math.max(0.02, ((REVEAL_LENGTH - TURN_DURATION) / count) * 2.5);
  const step = (REVEAL_LENGTH - TURN_DURATION - wordDuration) / Math.max(1, count - 1);
  let at = REVEAL_START;

  const reveal = (item: HTMLElement) => {
    if (item.matches("[data-chip]")) {
      timeline.add(fx("chipPop", item, { duration: 0.03 }), at);
      if (item.contains(payout)) payoutStart = at + 0.01;
    } else {
      timeline.fromTo(item, { opacity: 0.15 }, { opacity: 1, duration: wordDuration }, at);
    }
    at += step;
  };

  first.forEach(reveal);
  timeline.fromTo(turn, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: TURN_DURATION }, at);
  at += TURN_DURATION;
  second.forEach(reveal);

  // 0.95 to 1.00: hold before the pin releases.
  timeline.set({}, {}, 1);
  syncPayout();
  return timeline;
}

// Set while the hero is opening, so a double-click can't start a second copy.
let closeHeroOverlay: (() => void) | null = null;

/** Grows the kernel into the hero, then lands on the real hero at the top of the page. */
function openHero(source: HTMLElement) {
  if (closeHeroOverlay) return;

  const goToTop = () => window.scrollTo({ top: 0, behavior: "instant" });
  const heroImage = document.querySelector<HTMLImageElement>('img[src*="hero-farm"]');
  const heroPhoto = heroImage?.parentElement;
  const hero = heroImage?.closest("section");
  const sourceImage = source.querySelector("[data-photo-image]");
  if (isReducedMotion() || !heroPhoto || !hero || !sourceImage) {
    goToTop();
    return;
  }

  const from = source.getBoundingClientRect();
  const heroBox = hero.getBoundingClientRect();
  const to = { left: heroBox.left, top: heroBox.top + window.scrollY, width: heroBox.width, height: heroBox.height };

  // The story fades to paper behind it, so nothing shows around the growing photo.
  const backdrop = document.createElement("div");
  backdrop.setAttribute("aria-hidden", "true");
  backdrop.style.cssText = "position:fixed;inset:0;z-index:100;background:var(--color-paper);opacity:0";

  const overlay = document.createElement("div");
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.cssText = `position:fixed;left:${to.left}px;top:${to.top}px;width:${to.width}px;height:${to.height}px;z-index:101;isolation:isolate;overflow:hidden;transform-origin:0 0`;

  // Copies, so the final frame matches the hero to the pixel without touching it.
  const heroCopy = heroPhoto.cloneNode(true) as HTMLElement;
  const kernelCopy = document.createElement("div");
  kernelCopy.style.cssText = "position:absolute;inset:0;overflow:hidden";
  kernelCopy.append(sourceImage.cloneNode(true));
  overlay.append(heroCopy, kernelCopy);
  document.body.append(backdrop, overlay);

  closeHeroOverlay = () => {
    backdrop.remove();
    overlay.remove();
    closeHeroOverlay = null;
  };

  gsap
    .timeline({ onComplete: () => closeHeroOverlay?.() })
    .fromTo(
      overlay,
      {
        x: from.left - to.left,
        y: from.top - to.top,
        scaleX: from.width / to.width,
        scaleY: from.height / to.height,
        clipPath: toPolygon(kernelPoints()),
      },
      {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        clipPath: toPolygon(roundedRectPoints(to.width, to.height, HERO_RADIUS)),
        duration: 0.95,
        ease: "expo.inOut",
      },
      0,
    )
    .to(backdrop, { opacity: 1, duration: 0.5, ease: "power2.out" }, 0)
    .to(kernelCopy, { opacity: 0, duration: 0.4, ease: "none" }, 0.2)
    .add(goToTop, 0.95)
    .to([overlay, backdrop], { opacity: 0, duration: 0.4, ease: "power1.inOut" }, 1);
}

export function HeroStory() {
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    (_, contextSafe) => {
      const root = scope.current;
      if (!root || !contextSafe) return;

      const onOpen = contextSafe((event: Event) => {
        openHero(event.currentTarget as HTMLElement);
      });
      const openers = root.querySelectorAll("[data-open-hero]");
      openers.forEach((opener) => opener.addEventListener("click", onOpen));

      const media = gsap.matchMedia();

      media.add("(prefers-reduced-motion: reduce)", () => {
        playOnEnter(fx("riseIn", root.querySelector("[data-paragraph]")), root);
      });

      media.add(
        {
          desktop: "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
          mobile: "(max-width: 767px) and (prefers-reduced-motion: no-preference)",
        },
        (context) => {
          if (!context.conditions) return;
          const isDesktop = Boolean(context.conditions.desktop);
          root.dataset.live = "";

          let built: gsap.Context | undefined;
          // Rebuilt rather than patched, so the photo always lands on the chip's real position.
          const build = () => {
            const rebuilding = Boolean(built);
            const y = window.scrollY;
            built?.revert();
            built = gsap.context(() => {
              buildTimeline(root, isDesktop);
            }, root);
            // Only a rebuild can move the page. On the first build, this would cancel a scroll
            // the visitor just started, such as a click on a nav link.
            if (rebuilding) window.scrollTo({ top: y, behavior: "instant" });
            refreshTriggers();
          };

          // Heavy work (splitting, measuring, 100+ tweens), and nobody can see this section
          // before they move. So it waits for that, and for final fonts. The height is reserved
          // so nothing shifts when it runs.
          const pinLength = isDesktop ? 2.5 : 1.8;
          root.style.minHeight = `${window.innerHeight * (1 + pinLength)}px`;
          let active = true;
          const FIRST_MOVE = ["scroll", "wheel", "touchstart", "pointerdown", "keydown"];
          const stopWaiting = () => {
            FIRST_MOVE.forEach((name) => window.removeEventListener(name, start));
          };
          const start = () => {
            stopWaiting();
            document.fonts.ready.then(() => {
              if (!active) return;
              root.style.minHeight = "";
              build();
            });
          };
          if (window.scrollY > 0) start();
          else {
            FIRST_MOVE.forEach((name) => window.addEventListener(name, start, { passive: true }));
          }

          let width = window.innerWidth;
          let height = window.innerHeight;
          let timer: ReturnType<typeof setTimeout> | undefined;
          const onResize = () => {
            // Phone address bars change the height while scrolling. That mustn't rebuild.
            const changed =
              window.innerWidth !== width || (isDesktop && window.innerHeight !== height);
            if (!changed) return;
            width = window.innerWidth;
            height = window.innerHeight;
            clearTimeout(timer);
            timer = setTimeout(() => {
              // Not built yet: only the reserved height needs updating.
              if (built) build();
              else root.style.minHeight = `${window.innerHeight * (1 + pinLength)}px`;
            }, 200);
          };
          window.addEventListener("resize", onResize);

          return () => {
            active = false;
            stopWaiting();
            root.style.minHeight = "";
            clearTimeout(timer);
            window.removeEventListener("resize", onResize);
            built?.revert();
            delete root.dataset.live;
          };
        },
      );

      return () => {
        openers.forEach((opener) => opener.removeEventListener("click", onOpen));
        closeHeroOverlay?.();
        media.revert();
      };
    },
    { scope },
  );

  return (
    <section ref={scope} data-hero-story aria-label="Why Lumora" className="relative">
      {/* Only this strip sits behind the hero, filling in around its rounded bottom corners. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 -top-4 -z-10 mx-auto h-8 w-[calc(100%-1rem)] max-w-[1600px] bg-field md:w-[calc(100%-1.5rem)]"
      />
      <div
        data-stage
        className="mx-auto w-[calc(100%-1rem)] max-w-[1600px] rounded-b-2xl md:w-[calc(100%-1.5rem)]"
      >
        <button
          type="button"
          data-photo
          data-open-hero
          aria-label="Open the hero"
          className="cursor-pointer"
        >
          <span data-photo-inner className="absolute inset-0 block overflow-hidden">
            <span data-photo-image className="absolute inset-0 block">
              <Image
                src={PHOTO}
                alt=""
                fill
                sizes="320px"
                className="object-cover object-[28%_25%] md:object-[50%_28%]"
              />
            </span>
          </span>
        </button>

        <div data-copy className="px-4 py-16 md:px-6">
          <span
            data-target-kernel
            aria-hidden="true"
            className="mx-auto mb-5 hidden h-24 w-[3.25rem]"
          />
          <div
            data-paragraph
            className="mx-auto max-w-[860px] text-[min(24px,3vh)] leading-[1.25] font-medium text-ink md:text-[min(38px,4.9vh)]"
          >
            <p data-story-text>
              A farmer in Jos{" "}
              <button
                type="button"
                data-target-inline
                data-open-hero
                aria-label="Open the hero"
                className="mx-[0.1em] inline-block h-[0.95em] w-[1.6em] cursor-pointer overflow-hidden rounded-[10px] align-middle focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Image
                  src={PHOTO}
                  alt=""
                  width={160}
                  height={95}
                  className="size-full object-cover object-[28%_25%]"
                />
              </button>{" "}
              has{" "}
              <Strong>
                <Num>50</Num> chickens
              </Strong>{" "}
              to sell. She calls a restaurant. They already bought today. She calls another. No
              answer. So she carries the chickens to the market and hopes. By evening she sells
              them <Strong>cheap</Strong>, just to go home.
            </p>

            <p data-turn className="my-10 font-display text-[1.2em] leading-[1.2] text-green">
              Lumora fixes this.
            </p>

            <p data-story-text>
              Restaurants and hotels post what they want to buy and the price they&apos;ll pay{" "}
              <Chip className="bg-amber-soft text-amber">
                <span className={`font-num ${CHIP_TEXT} font-medium`}>
                  {formatNaira(3500, "kg")}
                </span>
              </Chip>
              . The farmer sees it on her phone, books it{" "}
              <Chip className="border border-line bg-card text-ink">
                <Check aria-hidden="true" strokeWidth={1.5} className="size-[0.5em] text-green" />
                <span className={CHIP_TEXT}>Booked</span>
              </Chip>
              , delivers, and gets paid{" "}
              <Chip className="border border-line bg-card text-ink">
                <Check aria-hidden="true" strokeWidth={1.5} className="size-[0.5em] text-success" />
                {/* The hidden copy reserves the final width, so counting up can't reflow the text. */}
                <span className={`font-num ${CHIP_TEXT} relative`}>
                  <span aria-hidden="true" className="invisible">
                    {formatNaira(PAYOUT)}
                  </span>
                  <span data-payout-count className="absolute inset-y-0 right-0">
                    {formatNaira(PAYOUT)}
                  </span>
                </span>
                <span className={`font-num ${CHIP_TEXT}`}>paid</span>
              </Chip>
              . <Strong>No guessing, no wasted trip.</Strong>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
