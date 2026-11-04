"use client";

import { useRef } from "react";

import { Reveal } from "@/components/motion/reveal";
import { formatNaira } from "@/lib/format";
import { fx, gsap, playOnEnter, useGSAP } from "@/lib/gsap/effects";
import { cn } from "@/lib/utils";

import { CheckList, CONTAINER, SECTION_HEADING, SECTION_SPACING, TypedLine } from "./shared";

const SMS_EXCHANGE = [
  {
    sent: "BUYERS BROILER JOS",
    reply: [
      `1) Caterer D ${formatNaira(3800, "kg")}, 40 left Thu`,
      `2) Hotel B ${formatNaira(3650, "kg")}, 25 left Fri.`,
      "Reply BOOK 1 20 THU",
    ],
  },
  {
    sent: "BOOK 1 20 THU",
    reply: [
      "Booked: 20 birds, Caterer D, Thu 7 to 11am, Angwan Rukuba.",
      "Code LM-4821.",
      "Reply CANCEL LM-4821 before Wed 6pm.",
    ],
  },
];

export function Producers() {
  const card = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = card.current;
      if (!root) return;

      const timeline = gsap.timeline();
      gsap.utils.toArray<HTMLElement>("[data-exchange]", root).forEach((exchange, index) => {
        const typed = exchange.querySelector("[data-type]");
        timeline.add(fx("typeIn", typed, { text: SMS_EXCHANGE[index].sent }), index === 0 ? 0 : "+=0.4");
        timeline.add(fx("riseIn", exchange.querySelectorAll("[data-reply]"), { stagger: 0.18 }), "+=0.6");
      });
      playOnEnter(timeline, root, "top 75%");
    },
    { scope: card },
  );

  return (
    <section
      id="producers"
      data-rhythm="paper"
      className={cn("scroll-mt-4", SECTION_SPACING)}
    >
      <div className={cn(CONTAINER, "grid gap-10 lg:grid-cols-2 lg:gap-16")}>
        <Reveal selector="[data-intro], li">
          <p data-intro className="text-label font-medium text-ink-muted">
            For producers
          </p>
          <h2 data-intro className={cn(SECTION_HEADING, "mt-2")}>
            Know the buyer before you load the truck.
          </h2>
          <CheckList
            items={[
              "See every active buyer near you, with price and capacity left.",
              "Compare bids side by side before you commit any stock.",
              "Get paid on what the buyer records, at the price they posted.",
              "No data? Every core action also works by SMS on a feature phone.",
            ]}
          />
        </Reveal>

        <div
          ref={card}
          role="group"
          aria-label="Example SMS exchange"
          className="self-start rounded-xl border border-line bg-card p-4 md:p-5"
        >
          <p className="text-body-sm text-ink-muted">Example SMS exchange</p>
          <dl className="mt-3">
            {SMS_EXCHANGE.map((message) => (
              <div key={message.sent} data-exchange className="border-t border-line py-3">
                <dt className="font-num text-number font-medium">
                  <TypedLine text={message.sent} />
                </dt>
                <dd className="font-num mt-1 text-body-sm text-ink-muted">
                  {message.reply.map((line) => (
                    <span key={line} data-reply className="block">
                      {line}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
