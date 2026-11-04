"use client";

import { Bus, Check, PhoneOff } from "lucide-react";
import Image from "next/image";
import { type ReactNode, useRef } from "react";

import { formatNaira } from "@/lib/format";
import { fx, gsap, pauseOffscreen, playOnEnter, refreshTriggers, useGSAP } from "@/lib/gsap/effects";

import { Num } from "./shared";

const DUSTY = "#EDE8DC";
const PAPER = "#F6F3EC";

// Where each note starts. `left` is a percent of the stage. `top` is a fraction of the space
// between the headline and the bottom of the card, so notes can't reach the headline on any screen.
const SCATTER = {
  desktop: [
    { left: 21, top: 0.16, rotation: -6 },
    { left: 36, top: 0.02, rotation: 4 },
    { left: 52, top: 0.14, rotation: -3 },
    { left: 26, top: 0.46, rotation: 5 },
    { left: 41, top: 0.34, rotation: -8 },
    { left: 57, top: 0.48, rotation: 7 },
  ],
  mobile: [
    { left: 3, top: 0.05, rotation: -6 },
    { left: 45, top: 0.02, rotation: 5 },
    { left: 8, top: 0.3, rotation: 4 },
    { left: 47, top: 0.26, rotation: -5 },
    { left: 4, top: 0.56, rotation: -3 },
    { left: 44, top: 0.52, rotation: 8 },
  ],
};

const FIELDS: { label: string; answer: ReactNode; problem: string }[] = [
  { label: "Buyers near you", answer: "4 buyers", problem: "3 missed calls" },
  { label: "Still needs", answer: "40 birds", problem: "We've already bought today" },
  {
    label: "Price, set by the buyer",
    answer: <span className="rounded-sm bg-amber-soft px-1.5 text-amber">{formatNaira(3800, "kg")}</span>,
    problem: "Last price? Abeg reduce",
  },
  { label: "Delivery slot", answer: "Thu 7 to 11am", problem: "Come back tomorrow" },
  { label: "Average this week", answer: formatNaira(3540, "kg"), problem: "₦2,900? ₦3,200?" },
  { label: "Trips to market", answer: "One, already sold", problem: "Bus to market, −₦4,000" },
];

const NOTES: ReactNode[] = [
  <>
    <p className="flex items-center gap-2 font-medium">
      <PhoneOff aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0" />
      Restaurant A
    </p>
    <p className="mt-1 text-body-sm text-danger">
      <Num>3</Num> missed calls
    </p>
  </>,
  <>
    <p className="font-medium italic">We&apos;ve already bought today.</p>
    <p className="mt-1 text-body-sm text-ink-muted">Hotel B</p>
  </>,
  <>
    <p className="font-medium italic">Last price? Abeg reduce.</p>
    <p className="mt-1 text-body-sm text-ink-muted">App message</p>
  </>,
  <>
    <p className="font-medium italic">Come back tomorrow.</p>
    <p className="mt-1 text-body-sm text-ink-muted">Caterer</p>
  </>,
  <>
    <p className="font-medium">Market price today?</p>
    <p className="font-num mt-1 text-body-sm text-ink-muted line-through">₦2,900? ₦3,200?</p>
  </>,
  <>
    <p className="flex items-center gap-2 font-medium">
      <Bus aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0" />
      Bus to market
    </p>
    <p className="font-num mt-1 text-body-sm text-danger">−₦4,000</p>
  </>,
];

function FieldContent({ field }: { field: (typeof FIELDS)[number] }) {
  return (
    <>
      <p className="text-label font-medium text-ink-muted">{field.label}</p>
      <p className="font-num mt-1 text-body-sm font-medium md:text-number">{field.answer}</p>
      <p className="mt-1 text-[11px] leading-[14px] text-ink-muted line-through">{field.problem}</p>
    </>
  );
}

function buildTimeline(root: HTMLElement, isDesktop: boolean) {
  const q = gsap.utils.selector(root);
  const stage = q<HTMLElement>("[data-chaos-stage]")[0];
  const notes = q<HTMLElement>("[data-note]");
  const floats = q<HTMLElement>("[data-note-float]");
  const fields = q<HTMLElement>("[data-field]");
  const card = q<HTMLElement>("[data-booking-card]")[0];
  const footer = q<HTMLElement>("[data-booking-footer]")[0];
  const before = q<HTMLElement>("[data-headline-before]")[0];
  const after = q<HTMLElement>("[data-headline-after]")[0];
  const scatter = isDesktop ? SCATTER.desktop : SCATTER.mobile;

  const stageBox = stage.getBoundingClientRect();
  const headlineBottom = before.parentElement?.getBoundingClientRect().bottom ?? stageBox.top;
  const space = {
    start: headlineBottom - stageBox.top + 20,
    end: card.getBoundingClientRect().bottom - stageBox.top,
  };

  notes.forEach((note, index) => {
    const { left, top, rotation } = scatter[index];
    const range = Math.max(0, space.end - space.start - note.offsetHeight);
    gsap.set(note, { left: `${left}%`, top: space.start + top * range, rotation });
  });

  // A loop that runs only until scrolling begins, on a wrapper so it can't fight the flight.
  let floating = true;
  const drift = fx("floatDrift", floats);

  const timeline = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: stage,
      pin: true,
      pinSpacing: true,
      start: "top top",
      end: `+=${isDesktop ? 200 : 160}%`,
      scrub: 0.8,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const atStart = self.progress === 0;
        if (atStart === floating) return;
        floating = atStart;
        if (atStart) drift.restart();
        else {
          drift.pause();
          gsap.to(floats, { y: 0, duration: 0.3, ease: "power2.out" });
        }
      },
    },
  });

  // Measured before the card is scaled down, so the notes aim for its final layout.
  timeline.add(fx("chaosToOrder", notes, { landings: fields, stage }), 0.1);

  timeline.fromTo(stage, { backgroundColor: DUSTY }, { backgroundColor: PAPER, duration: 0.7 }, 0);
  timeline.fromTo(
    card,
    { opacity: 0, scale: 0.96 },
    { opacity: 1, scale: 1, duration: 0.15, ease: "power2.out" },
    0.25,
  );
  timeline.fromTo(before, { opacity: 1, y: 0 }, { opacity: 0, y: -12, duration: 0.1 }, 0.3);
  timeline.fromTo(after, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.1 }, 0.42);
  timeline.fromTo(
    footer,
    { yPercent: 100 },
    { yPercent: 0, duration: 0.1, ease: "power3.out" },
    0.84,
  );
  timeline.set({}, {}, 1);

  pauseOffscreen([drift], stage, () => floating);
  return timeline;
}

export function ChaosToOrder() {
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;

      const media = gsap.matchMedia();

      media.add("(prefers-reduced-motion: reduce)", () => {
        playOnEnter(fx("riseIn", root.querySelector("[data-booking-card]")), root, "top 70%");
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
          // The flying notes are visual copies here, so screen readers get only the real fields.
          const flyingNotes = root.querySelector("[data-notes]");
          flyingNotes?.setAttribute("aria-hidden", "true");

          let built: gsap.Context | undefined;
          // Rebuilt rather than patched, so the notes always aim for the fields' real positions.
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

          // Waits for the visitor's first move, and reserves its height so nothing shifts.
          const pinLength = isDesktop ? 2 : 1.6;
          const reserve = () => {
            root.style.minHeight = `${window.innerHeight * (1 + pinLength)}px`;
          };
          reserve();
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
              if (built) build();
              else reserve();
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
            flyingNotes?.removeAttribute("aria-hidden");
            delete root.dataset.live;
          };
        },
      );

      return () => media.revert();
    },
    { scope },
  );

  return (
    <section ref={scope} data-chaos aria-label="From calls and guessing to one booking">
      <div
        data-chaos-stage
        className="relative flex flex-col items-center gap-6 overflow-hidden bg-paper px-4 py-16 md:gap-8 md:px-6"
      >
        <div className="grid w-full max-w-[46rem] text-center">
          <h2
            data-headline-before
            className="font-display text-[min(28px,4vh)] leading-[1.2] font-medium text-balance [grid-area:1/1] md:text-[min(40px,5.6vh)]"
          >
            Selling today is calls, waiting and guessing.
          </h2>
          <div data-headline-after className="[grid-area:1/1]">
            <h2 className="font-display text-[min(28px,4vh)] leading-[1.2] font-medium text-balance md:text-[min(40px,5.6vh)]">
              Every problem, answered before you leave the farm.
            </h2>
            <p className="mt-2 text-body-sm md:text-body">
              Who is buying, how many they still need, the price, the slot. One booking, one trip.
            </p>
          </div>
        </div>

        <div data-notes className="w-full max-w-[720px]">
          <p data-notes-label className="mb-3 text-label font-medium text-ink-muted">
            Before Lumora
          </p>
          <ul data-notes-list className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {NOTES.map((note, index) => (
              <li key={index} data-note-float>
                <div
                  data-note
                  className="overflow-hidden rounded-xl border border-line bg-card text-body-sm md:text-body"
                >
                  <div data-face="chaos" className="p-3">
                    {note}
                  </div>
                  <div data-face="field" className="p-2.5 md:p-3">
                    <FieldContent field={FIELDS[index]} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <article
          data-booking-card
          className="w-full max-w-[540px] overflow-hidden rounded-[20px] border border-line bg-card"
        >
          <div className="p-4 pb-4 md:p-5 md:pb-4">
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="text-label font-medium text-ink-muted">Live broilers near Bukuru</p>
                <h3 className="mt-0.5 font-semibold md:text-heading">Caterer D, Angwan Rukuba</h3>
              </div>
              <Image
                src="/brand/lumora-mark.png"
                alt=""
                width={64}
                height={59}
                className="h-7 w-auto shrink-0 md:h-8"
              />
            </header>
            <div className="mt-3 grid auto-rows-fr grid-cols-2 gap-2 md:mt-4 md:gap-3">
              {FIELDS.map((field) => (
                <div
                  key={field.label}
                  data-field
                  className="rounded-xl border border-line p-2.5 md:p-3"
                >
                  <FieldContent field={field} />
                </div>
              ))}
            </div>
          </div>
          <p
            data-booking-footer
            className="flex items-center justify-between gap-3 bg-green px-4 py-3 text-paper md:px-5"
          >
            <span className="flex items-center gap-2 font-medium">
              <Check aria-hidden="true" strokeWidth={1.5} className="size-5 shrink-0" />
              <span>
                Booked <Num>30</Num> birds
              </span>
            </span>
            <span className="font-num text-number">LM-4821</span>
          </p>
        </article>
      </div>
    </section>
  );
}
