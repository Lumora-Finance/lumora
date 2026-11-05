"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import { formatNaira } from "@/lib/format";
import { fx, gsap, ScrollTrigger, useGSAP } from "@/lib/gsap/effects";

import { CONTAINER, EYEBROW, Num } from "./shared";

// This section deliberately uses no brand green, so buttons and focus rings are ink here.
const PILL =
  "inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-medium transition-colors duration-200 ease-out focus-visible:ring-3 focus-visible:ring-ink/40 focus-visible:outline-none md:min-h-10";

const FROM_NUMBER = 80;
const TO_NUMBER = 60;
const REPLY = "BOOK 20";

const KEYS = Array.from({ length: 9 });

/** Draws the arc between the two objects, from where they really are right now. */
function updateArc(root: HTMLElement) {
  const stage = root.querySelector<HTMLElement>("[data-post-stage]");
  const browser = root.querySelector("[data-post-browser]");
  const phone = root.querySelector("[data-post-phone]");
  if (!stage || !browser || !phone) return;

  // The stage may be part way through its entrance, so its scale is taken out of the measurements.
  const box = stage.getBoundingClientRect();
  const scale = box.width / stage.offsetWidth || 1;
  const measure = (element: Element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: (rect.left - box.left) / scale,
      right: (rect.right - box.left) / scale,
      top: (rect.top - box.top) / scale,
      bottom: (rect.bottom - box.top) / scale,
      width: rect.width / scale,
      height: rect.height / scale,
    };
  };
  const from = measure(browser);
  const to = measure(phone);
  let d: string;

  if (window.matchMedia("(min-width: 768px)").matches) {
    const start = { x: from.right, y: from.top + from.height * 0.42 };
    const end = { x: to.left, y: to.top + to.height * 0.32 };
    const middle = (start.x + end.x) / 2;
    d = `M${start.x} ${start.y}C${middle} ${start.y - 90} ${middle} ${end.y - 90} ${end.x} ${end.y}`;
  } else {
    const start = { x: from.left + from.width / 2, y: from.bottom };
    const end = { x: to.left + to.width / 2, y: to.top };
    const third = (end.y - start.y) / 3;
    d = `M${start.x} ${start.y}C${start.x + 44} ${start.y + third} ${end.x - 44} ${end.y - third} ${end.x} ${end.y}`;
  }

  root.querySelectorAll("[data-arc]").forEach((path) => path.setAttribute("d", d));
}

function buildTimeline(root: HTMLElement) {
  const q = gsap.utils.selector(root);
  const one = <T extends Element = HTMLElement>(selector: string) => q<T>(selector)[0];

  const screen = one("[data-phone-screen]");
  const phone = one("[data-post-phone]");
  const number = one("[data-post-number]");
  const button = one("[data-post-button]");
  const sent = one("[data-post-sent]");
  const booked = one("[data-post-booked]");
  const initial = one("[data-phone-initial]");
  const replyLine = one("[data-phone-reply]");
  const replyText = one("[data-phone-reply-text]");
  const finalMessage = one("[data-phone-final]");
  const firstMessages = q<HTMLElement>("[data-phone-first]");
  const path = one<SVGPathElement>("[data-arc-base]");
  const activePath = one<SVGPathElement>("[data-arc-active]");
  const dot = one<SVGCircleElement>("[data-arc-dot]");

  const rise = { autoAlpha: 1, y: 0, duration: 0.3, ease: "power2.out" };
  const hidden = { autoAlpha: 0, y: 6 };
  const keepInView = (element: HTMLElement) => () =>
    Math.max(0, element.offsetTop + element.offsetHeight - screen.clientHeight);

  // Text isn't rewound by a timeline restart, so the start of each run sets it back.
  const reset = () => {
    number.textContent = String(FROM_NUMBER);
    screen.scrollTop = 0;
  };

  const timeline = gsap.timeline({ paused: true });
  timeline.call(reset, undefined, 0.001);

  gsap.set(initial, { autoAlpha: 1 });
  gsap.set(replyLine, { autoAlpha: 0 });

  // 0.5s: the buyer posts.
  timeline.to(button, { scale: 0.94, duration: 0.1, yoyo: true, repeat: 1, ease: "power1.inOut" }, 0.5);
  timeline.fromTo(sent, hidden, rise, 0.6);

  // 0.9s: the signal reaches the phone.
  timeline.add(fx("signalTravel", dot, { path, activePath, direction: 1 }), 0.9);

  // 2.25s: the phone buzzes and the messages arrive.
  timeline.add(fx("phoneBuzz", phone), 2.25);
  timeline.to(initial, { autoAlpha: 0, duration: 0.15 }, 2.25);
  timeline.fromTo(firstMessages, hidden, { ...rise, stagger: 0.12 }, 2.4);

  // 4.3s: the farmer replies.
  timeline.set(replyLine, { autoAlpha: 1 }, 4.3);
  timeline.to(screen, { scrollTop: keepInView(replyLine), duration: 0.2, ease: "power1.out" }, 4.3);
  timeline.add(fx("typeIn", replyText, { text: REPLY }), 4.3);

  // 5.4s: the booking travels back.
  timeline.add(fx("signalTravel", dot, { path, activePath, direction: -1 }), 5.4);

  // 6.75s: the buyer's number drops.
  timeline.add(fx("countDown", number, { from: FROM_NUMBER, to: TO_NUMBER }), 6.75);
  timeline.fromTo(booked, hidden, rise, 6.75);
  reset();

  // 7.3s: the confirmation arrives.
  timeline.add(fx("phoneBuzz", phone), 7.3);
  timeline.fromTo(finalMessage, hidden, rise, 7.45);
  timeline.to(screen, { scrollTop: keepInView(finalMessage), duration: 0.25, ease: "power1.out" }, 7.45);

  ScrollTrigger.create({
    // The stage's wrapper, because the stage itself is being scaled by its entrance.
    trigger: one("[data-post-stage]").parentElement,
    start: "60% bottom",
    onEnter: () => timeline.restart(),
    onLeaveBack: () => {
      timeline.pause(0);
      reset();
    },
  });
}

export function OnePost() {
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;

      const syncArc = () => updateArc(root);
      syncArc();
      window.addEventListener("resize", syncArc);
      window.addEventListener("load", syncArc);
      document.fonts?.ready.then(syncArc);
      ScrollTrigger.addEventListener("refresh", syncArc);

      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        root.dataset.live = "";
        buildTimeline(root);
        return () => {
          delete root.dataset.live;
        };
      });
      // Reduced motion, and no JS, show the finished conversation. This keeps its end in view.
      media.add("(prefers-reduced-motion: reduce)", () => {
        const screen = root.querySelector("[data-phone-screen]");
        if (screen) screen.scrollTop = screen.scrollHeight;
      });

      return () => {
        window.removeEventListener("resize", syncArc);
        window.removeEventListener("load", syncArc);
        ScrollTrigger.removeEventListener("refresh", syncArc);
        media.revert();
      };
    },
    { scope },
  );

  return (
    <section
      ref={scope}
      id="producers"
      data-bg="paper"
      aria-labelledby="one-post-title"
      className="scroll-mt-4 pt-10 pb-10 lg:pt-16 lg:pb-0"
    >
      {/* The hero nav and step cards also link here, under the old buyers section's name. */}
      <span id="buyers" className="block scroll-mt-4" />
      <div className={CONTAINER}>
        <div
          data-post-stage
          data-entrance
          className="relative isolate overflow-hidden rounded-[20px] border border-[#E2DDD2] bg-paper px-[18px] py-16 md:px-9"
        >
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 size-full">
            <path data-arc data-arc-base fill="none" stroke="#D9D2C3" strokeWidth={1} />
            <path
              data-arc
              data-arc-active
              fill="none"
              stroke="#C08A2E"
              strokeWidth={1.5}
              opacity={0}
            />
            <circle data-arc-dot r={5} fill="#C08A2E" opacity={0} />
          </svg>

          <p className={`${EYEBROW} text-ink-muted`}>For buyers and farmers</p>
          <h2
            id="one-post-title"
            className="mt-1 font-display text-[26px] leading-[1.2] font-medium text-ink md:text-[34px]"
          >
            One post. Every farmer nearby knows.
          </h2>
          <p className="mt-2 text-body text-ink-muted">
            Buyers post on the web. Farmers get it by SMS, on any phone.
          </p>

          <div className="mt-9 grid grid-cols-1 items-center justify-items-center gap-y-[70px] md:grid-cols-[minmax(0,1fr)_120px_210px] md:justify-items-stretch md:gap-y-0">
            <div
              data-post-browser
              className="w-full max-w-[420px] overflow-hidden rounded-[14px] md:max-w-none border border-[#E2DDD2] bg-white md:justify-self-end"
            >
              <div className="flex items-center gap-1.5 border-b border-[#EEE9DF] px-3.5 py-2.5">
                <span className="size-2 rounded-full bg-[#E2DDD2]" />
                <span className="size-2 rounded-full bg-[#E2DDD2]" />
                <span className="size-2 rounded-full bg-[#E2DDD2]" />
                <span className="font-num ml-2 text-[11px] text-[#9AA59F]">lumora.ng/post</span>
              </div>
              <div className="p-[22px]">
                <p className="text-[13px] text-ink-muted">Caterer D, Angwan Rukuba needs</p>
                <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-ink">
                  <span
                    data-post-number
                    className="font-num text-[64px] leading-none tracking-[-0.02em]"
                  >
                    {TO_NUMBER}
                  </span>
                  <span className="text-[17px]">live broilers</span>
                </p>
                <p className="mt-2 text-sm text-ink-muted">
                  <span className="font-num font-medium text-[#9A6A1A]">
                    {formatNaira(3500, "kg")}
                  </span>{" "}
                  · Thursday, <Num>7</Num> to <Num>11</Num>am
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                  {/* Part of the illustration. It isn't a control on this page. */}
                  <span
                    data-post-button
                    className="inline-flex rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-paper"
                  >
                    Post demand
                  </span>
                  <p data-post-sent className="text-[13px] text-ink-muted">
                    Sent to <Num>6</Num> farmers nearby
                  </p>
                </div>
                <p
                  data-post-booked
                  className="mt-4 flex items-center gap-2 border-t border-[#EEE9DF] pt-3 text-sm text-ink"
                >
                  <Check aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0" />
                  <span>
                    Amina in Bukuru booked <Num>20</Num>
                  </span>
                </p>
              </div>
            </div>

            <div aria-hidden="true" className="hidden md:block" />

            <div
              data-post-phone
              className="relative w-[200px] justify-self-center rounded-[34px] bg-[#1C1C1E] px-3.5 pt-5 pb-[18px] md:col-start-3"
            >
              <span
                aria-hidden="true"
                className="absolute top-3.5 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-[#3A3A3C]"
              />
              <div
                data-phone-screen
                className="font-num relative mt-3 h-[210px] space-y-1.5 overflow-hidden rounded-[10px] bg-[#F4EFE4] px-3 py-3.5 text-xs leading-normal text-ink"
              >
                <p
                  data-phone-initial
                  aria-hidden="true"
                  className="invisible absolute top-3.5 left-3 text-[#9AA59F]"
                >
                  Amina · Bukuru
                </p>
                <p data-phone-first className="text-[#9AA59F]">
                  LUMORA · now
                </p>
                <p data-phone-first>Caterer D needs 80 broilers on Thursday. ₦3,500/kg.</p>
                <p data-phone-first>Reply BOOK 20</p>
                <p data-phone-reply className="min-h-[18px] text-right">
                  <span data-phone-reply-text>{REPLY}</span>
                </p>
                <p data-phone-final>Booked. Code LM-4821. See you Thursday.</p>
              </div>
              <div aria-hidden="true" className="mt-4 grid grid-cols-3 justify-items-center gap-[9px]">
                {KEYS.map((_, index) => (
                  <span key={index} className="h-2 w-[26px] rounded-full bg-[#2C2C2E]" />
                ))}
              </div>
            </div>
          </div>

          <div className="mt-[30px] flex flex-wrap items-center justify-between gap-4">
            <p className="text-[13px] text-ink-muted">
              No data or smartphone needed. Illustrative example.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/auth/login"
                className={`${PILL} bg-ink text-paper hover:bg-ink/85`}
              >
                Post your demand
              </Link>
              <Link
                href="/auth/login"
                className={`${PILL} border border-[#D9D2C3] text-ink hover:bg-[#EEE9DF]`}
              >
                See buyers near you
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
