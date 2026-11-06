"use client";

import { useEffect, useRef, useState } from "react";

import { fx, gsap, isReducedMotion, playOnEnter, refreshTriggers, useGSAP } from "@/lib/gsap/effects";

import { CONTAINER } from "./shared";

type Question = { question: string; answer: string };

const GROUPS: { title: string; startsOpen: number | null; questions: Question[] }[] = [
  {
    title: "Buying",
    startsOpen: 0,
    questions: [
      {
        question: "How do I post what I need?",
        answer: "Say what you need, how many, your price and when you want it delivered. Farmers near you see it on the board and book what they can supply.",
      },
      {
        question: "What happens to my money?",
        answer: "It's held for your order, not paid to anyone yet. The farmer is paid after the delivery is weighed and you give them the code.",
      },
      {
        question: "What if some of the delivery is bad?",
        answer: "Record what you accepted, and decline the rest with a reason and a photo. You only pay for the weight you accepted.",
      },
      {
        question: "What if a farmer doesn't show up?",
        answer: "The money held for that booking comes back to you, and the farmer gets a strike on their record.",
      },
      {
        question: "Does posting cost anything?",
        answer: "No. Lumora takes a small fee only when a delivery is paid, and you'll see it on your receipt.",
      },
    ],
  },
  {
    title: "Selling",
    startsOpen: null,
    questions: [
      {
        question: "How do I find buyers?",
        answer: "Open the board to see who's buying near you, what they pay and how many they still need. When a price suits you, tap Sell to them.",
      },
      {
        question: "How do I know the buyer can pay?",
        answer: "A buyer's money is held before you deliver, so you aren't left chasing anyone for payment.",
      },
      {
        question: "When do I get paid?",
        answer: "The buyer weighs your delivery and gives you a code. Enter it, and your money is on its way to your bank account.",
      },
      {
        question: "What if the weight looks wrong?",
        answer: "Tell us before you enter the code. We look at the scale photos and decide within 48 hours.",
      },
      {
        question: "Which areas do you cover?",
        answer: "Jos and towns across Plateau State.",
      },
    ],
  },
];

const OPEN_S = 0.62;
const CLOSE_S = 0.42;
const EASE = "expo.out";

function FaqGroup({ title, startsOpen, questions }: (typeof GROUPS)[number]) {
  const [open, setOpen] = useState<number | null>(startsOpen);
  const list = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const motion = useRef<gsap.core.Timeline | null>(null);
  const reduced = useRef(false);
  const current = useRef(open);

  const part = (name: string, index: number) => list.current?.querySelector<HTMLElement>(`[data-${name}="${index}"]`) ?? null;

  /** Where the card sits around a question once it's open. Only one is open, so those above are closed. */
  function placeFor(index: number) {
    const root = list.current;
    if (!root) return { y: 0, height: 0 };
    const gap = parseFloat(getComputedStyle(root).rowGap) || 0;
    let y = 0;
    for (let above = 0; above < index; above += 1) y += (part("head", above)?.offsetHeight ?? 0) + gap;
    return { y, height: (part("head", index)?.offsetHeight ?? 0) + (part("inner", index)?.offsetHeight ?? 0) };
  }

  /** Puts the card where it belongs straight away, when the layout changed underneath it. */
  function snap() {
    if (motion.current?.isActive() || !card.current) return;
    if (current.current === null) {
      gsap.set(card.current, { autoAlpha: 0 });
      return;
    }
    gsap.set(card.current, { ...placeFor(current.current), autoAlpha: 1, scale: 1 });
  }

  useGSAP(
    () => {
      reduced.current = isReducedMotion();
      snap();
    },
    { scope: list },
  );

  useEffect(() => {
    const root = list.current;
    if (!root) return;
    const observer = new ResizeObserver(() => snap());
    observer.observe(root);
    document.fonts?.ready.then(() => snap()).catch(() => {});
    return () => {
      observer.disconnect();
      motion.current?.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(tapped: number) {
    const previous = current.current;
    const next = previous === tapped ? null : tapped;
    current.current = next;
    setOpen(next);

    const quick = reduced.current;
    const timeline = gsap.timeline({ onComplete: refreshTriggers });
    motion.current?.kill();
    motion.current = timeline;
    const duration = quick ? 0 : next === null ? CLOSE_S : OPEN_S;

    // Every other answer, not just the last one: a click can interrupt one that was still closing.
    questions.forEach((_, index) => {
      if (index === next) return;
      const closing = part("body", index);
      if (!closing || getComputedStyle(closing).visibility === "hidden") return;
      timeline.to(part("inner", index), { autoAlpha: 0, duration: quick ? 0 : 0.18, ease: "power1.out" }, 0);
      timeline.to(closing, { height: 0, duration, ease: EASE }, 0);
      timeline.set(closing, { visibility: "hidden" }, duration);
    });

    if (next === null) {
      timeline.to(card.current, { autoAlpha: 0, scale: 0.985, duration: quick ? 0 : 0.28, ease: "power2.out" }, 0);
      return;
    }

    const body = part("body", next);
    const inner = part("inner", next);
    const place = placeFor(next);
    gsap.set(body, { visibility: "visible" });
    timeline.to(body, { height: inner?.offsetHeight ?? 0, duration, ease: EASE }, 0);
    timeline.set(body, { height: "auto" });

    // From another question it glides across. From nothing it settles in where it's going.
    if (previous === null) {
      gsap.set(card.current, { y: place.y, height: part("head", next)?.offsetHeight ?? 0, scale: 0.985 });
      timeline.to(card.current, { autoAlpha: 1, scale: 1, duration: quick ? 0 : 0.3, ease: "power2.out" }, 0);
      timeline.to(card.current, { height: place.height, duration, ease: EASE }, 0);
    } else {
      timeline.to(card.current, { ...place, autoAlpha: 1, scale: 1, duration, ease: EASE }, 0);
    }
    if (!quick) {
      timeline.fromTo(inner, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out", clearProps: "transform" }, 0.12);
    } else {
      gsap.set(inner, { autoAlpha: 1, y: 0 });
    }
  }

  return (
    <div data-faq-panel className="rounded-[28px] bg-[#ECE8DD] p-2.5 sm:rounded-[32px] sm:p-3">
      <p className="px-3.5 pt-3 pb-3 text-body-sm font-medium text-ink-muted sm:px-5 sm:pt-4">{title}</p>
      <div ref={list} className="relative grid gap-1">
        <div
          ref={card}
          aria-hidden="true"
          style={{ visibility: "hidden" }}
          className="absolute inset-x-0 top-0 rounded-[20px] bg-white shadow-[0_18px_40px_-22px_rgb(14_46_35/0.35)] sm:rounded-[24px]"
        />
        {questions.map(({ question, answer }, index) => {
          const isOpen = open === index;
          const startsVisible = startsOpen === index;
          return (
            <div key={question} data-faq-row className="relative">
              <h3 data-head={index}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`faq-${title}-${index}`}
                  onClick={() => toggle(index)}
                  className="group flex min-h-16 w-full items-center gap-4 rounded-[20px] px-3.5 py-3 text-left text-[16px] leading-snug font-medium text-ink [-webkit-tap-highlight-color:transparent] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:min-h-[72px] sm:rounded-[24px] sm:px-5 sm:text-[17px]"
                >
                  <span className="min-w-0 flex-1 transition-transform duration-300 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none">{question}</span>
                  <span
                    aria-hidden="true"
                    className={`relative flex size-10 shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-300 ease-out group-active:scale-90 motion-reduce:transition-none ${
                      isOpen ? "bg-green text-paper" : "bg-paper text-ink group-hover:bg-sage-soft"
                    }`}
                  >
                    <span className="absolute h-[1.5px] w-3.5 rounded-full bg-current" />
                    <span
                      className={`absolute h-3.5 w-[1.5px] rounded-full bg-current transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
                        isOpen ? "rotate-90 scale-y-0" : ""
                      }`}
                    />
                  </span>
                </button>
              </h3>
              <div
                id={`faq-${title}-${index}`}
                role="region"
                aria-label={question}
                data-body={index}
                style={startsVisible ? undefined : { height: 0, visibility: "hidden" }}
                className="overflow-hidden"
              >
                <div data-inner={index} className="px-3.5 pb-5 sm:px-5 sm:pb-6">
                  <p className="max-w-[46ch] pr-12 text-body leading-relaxed text-ink-muted">{answer}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Faq() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = root.current;
      if (!section) return;
      playOnEnter(fx("riseIn", section.querySelectorAll("[data-faq-title]"), { stagger: 0.08 }), section, "top 75%");
      playOnEnter(fx("riseIn", section.querySelectorAll("[data-faq-panel]"), { stagger: 0.12 }), section, "top 65%");
    },
    { scope: root },
  );

  return (
    <section ref={root} id="producers" data-bg="paper" aria-labelledby="faq-heading" className="scroll-mt-4 py-16 md:py-24">
      {/* The hero nav and step cards link to these names. */}
      <span id="buyers" className="block scroll-mt-4" />
      <div className={CONTAINER}>
        <div className="mx-auto max-w-[36rem] text-center">
          <h2 id="faq-heading" data-faq-title className="font-display text-[36px] leading-[1.1] font-medium text-balance text-ink sm:text-[52px]">
            Questions, answered
          </h2>
          <p data-faq-title className="mt-3 text-body text-ink-muted sm:text-[18px]">
            Whether you&apos;re buying produce or selling it.
          </p>
        </div>
        <div className="mt-10 grid items-start gap-3 md:mt-14 md:grid-cols-2 md:gap-4">
          {GROUPS.map((group) => (
            <FaqGroup key={group.title} {...group} />
          ))}
        </div>
      </div>
    </section>
  );
}
