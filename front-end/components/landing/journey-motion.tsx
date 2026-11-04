"use client";

import { type ReactNode, useRef } from "react";

import { formatNaira } from "@/lib/format";
import {
  fx,
  gsap,
  panelEntrance,
  playOnEnter,
  ScrollTrigger,
  useGSAP,
} from "@/lib/gsap/effects";

const PAYOUT = 323400;
const HOLD = 0.06;
/** How far along the track each panel is close enough to centre to play its moment. */
const CENTRED_AT = [0, 0.42, 0.85];

/** Each panel's moment, paused until that panel arrives. */
function buildMoments(root: HTMLElement) {
  const q = gsap.utils.selector(root);
  const listing = q("[data-listing]")[0];
  const listingText = q("[data-listing-text]")[0];
  const payout = q("[data-payout]")[0];
  const fullListing = listingText.textContent ?? "";

  const posted = gsap
    .timeline({ paused: true })
    .fromTo(listing, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out" })
    .add(fx("typeIn", listingText, { text: fullListing, perCharacter: 0.035 }), 0.25);

  const booked = gsap
    .timeline({ paused: true })
    .add(fx("kernelRise", q("[data-kernel]")[0]), 0)
    .add(fx("ledgerDraw", q("[data-ledger]")), 0.7);

  const paid = gsap
    .timeline({ paused: true })
    .add(fx("countUp", payout, { from: 0, to: PAYOUT, format: "naira" }), 0)
    .fromTo(q("[data-paid]"), { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "none" }, 0.9);

  return {
    moments: [posted, booked, paid],
    // A timeline's revert doesn't restore text, so the finished words go back by hand.
    restoreText: () => {
      listingText.textContent = fullListing;
      payout.textContent = formatNaira(PAYOUT);
    },
  };
}

function buildPinnedJourney(root: HTMLElement) {
  const q = gsap.utils.selector(root);
  const track = q("[data-journey-track]")[0];
  const { moments, restoreText } = buildMoments(root);

  root.dataset.live = "";
  q("[data-journey-panel]").forEach((panel) => panelEntrance(panel, root));

  // Reads the timeline rather than the scrollbar, so moments match what's on screen.
  const syncToTrack = () => {
    const travelled = gsap.utils.clamp(0, 1, timeline.time() - HOLD);
    moments.forEach((moment, index) => {
      if (travelled >= CENTRED_AT[index] && moment.paused()) moment.play();
    });
  };

  const timeline = gsap.timeline({
    defaults: { ease: "none" },
    onUpdate: syncToTrack,
    scrollTrigger: {
      trigger: root,
      pin: true,
      start: "top top",
      end: () => `+=${window.innerHeight * 2.5}`,
      scrub: 0.8,
      invalidateOnRefresh: true,
      onEnter: () => moments[0].play(),
    },
  });

  timeline
    .to(
      track,
      { xPercent: () => -100 * (1 - root.clientWidth / track.offsetWidth), duration: 1 },
      HOLD,
    )
    .set({}, {}, 1 + HOLD * 2);

  return () => {
    delete root.dataset.live;
    restoreText();
  };
}

function buildStackedJourney(root: HTMLElement) {
  const { moments, restoreText } = buildMoments(root);

  gsap.utils.toArray<HTMLElement>("[data-journey-step]", root).forEach((step, index) => {
    const panel = step.querySelector("[data-journey-panel]");
    if (panel) panelEntrance(panel, step);
    ScrollTrigger.create({
      trigger: step,
      start: "top 70%",
      once: true,
      onEnter: () => moments[index].play(),
    });
  });

  return restoreText;
}

/** The pinned, sideways journey on desktop. Phones and reduced motion get a plain stack. */
export function JourneyMotion({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;

      const media = gsap.matchMedia();
      media.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () =>
        buildPinnedJourney(root),
      );
      media.add("(max-width: 767px) and (prefers-reduced-motion: no-preference)", () =>
        buildStackedJourney(root),
      );
      media.add("(prefers-reduced-motion: reduce)", () => {
        gsap.utils.toArray<HTMLElement>("[data-journey-step]", root).forEach((step) => {
          playOnEnter(fx("riseIn", step, { stagger: 0 }), step);
        });
      });
      return () => media.revert();
    },
    { scope },
  );

  return (
    <section
      ref={scope}
      id="how-it-works"
      data-bg="field"
      data-journey
      className="relative py-10 lg:py-16"
    >
      {children}
    </section>
  );
}
