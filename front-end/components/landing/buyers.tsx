"use client";

import { Check } from "lucide-react";
import { useRef } from "react";

import { buttonVariants } from "@/components/ui/button";
import { formatNaira } from "@/lib/format";
import { fx, gsap, playOnEnter, useGSAP } from "@/lib/gsap/effects";
import { cn } from "@/lib/utils";

import { CheckList, CONTAINER, Num, SECTION_HEADING, SECTION_SPACING, TypedLine } from "./shared";

const LISTING = [
  { label: "Produce", value: "Live broilers, 2.5 to 3.5 kg each" },
  { label: "Price", value: formatNaira(3500, "kg") },
  { label: "Capacity", value: "80 birds a day, Monday to Saturday" },
  { label: "Delivery", value: "Rayfield, Jos, 7:00 to 11:00" },
  { label: "Booking", value: "By 6:00 the day before, minimum 10 birds" },
];

export function Buyers() {
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = scope.current;
      const composer = root?.querySelector("[data-composer]");
      if (!root || !composer) return;

      const timeline = gsap.timeline();
      gsap.utils.toArray<HTMLElement>("[data-type]", composer).forEach((field, index) => {
        timeline.add(fx("typeIn", field, { text: LISTING[index].value }), index === 0 ? 0 : "+=0.08");
      });
      timeline.add(fx("riseIn", composer.querySelector("[data-post]"), { stagger: 0 }), "+=0.15");
      timeline.add(
        gsap.fromTo(composer.querySelector("[data-confirm]"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }),
        "+=0.05",
      );

      // The checklist finishes the composer in a row. When stacked, it sits above it and can't wait.
      const copy = gsap.utils.toArray<Element>("[data-intro], [data-check]", root);
      if (window.matchMedia("(min-width: 1024px)").matches) {
        timeline.add(fx("riseIn", copy, { stagger: 0.08 }), "+=0.05");
      } else {
        playOnEnter(fx("riseIn", copy, { stagger: 0.08 }), root);
      }

      playOnEnter(timeline, composer, "top 75%");
    },
    { scope },
  );

  return (
    <section
      ref={scope}
      id="buyers"
      data-rhythm="white"
      className={cn("scroll-mt-4", SECTION_SPACING)}
    >
      <div className={cn(CONTAINER, "grid gap-10 lg:grid-cols-2 lg:gap-16")}>
        <div className="lg:order-2">
          <p data-intro className="text-label font-medium text-ink-muted">
            For buyers
          </p>
          <h2 data-intro className={cn(SECTION_HEADING, "mt-2")}>
            Post it once. Stop repeating it on every call.
          </h2>
          <CheckList
            items={[
              "Reach more suppliers competing to fill one clear specification.",
              "Bookings stop at your daily capacity, first come, first served.",
              "Check your bid against what other buyers are paying this week.",
              <>
                Pay a <Num>1.5%</Num> fee on settled value, and only on what you accept.
              </>,
            ]}
          />
        </div>

        <div
          data-composer
          className="self-start rounded-xl border border-line bg-paper p-4 md:p-5 lg:order-1"
        >
          <p className="text-body-sm text-ink-muted">Example demand listing</p>
          <dl className="mt-3">
            {LISTING.map((row) => (
              <div key={row.label} className="grid grid-cols-[5rem_1fr] gap-3 border-t border-line py-3">
                <dt className="text-body-sm text-ink-muted">{row.label}</dt>
                <dd className="font-num min-w-0 text-number">
                  <TypedLine text={row.value} />
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line pt-4">
            {/* Shows what happens in the product. It isn't a control on this page. */}
            <span data-post className={cn(buttonVariants(), "pointer-events-none")}>
              Post demand
            </span>
            <p data-confirm className="flex items-start gap-2 text-body-sm text-success">
              <Check aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-4 shrink-0" />
              <span>
                Live on the board. <Num>6</Num> farmers near Rayfield notified.
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
