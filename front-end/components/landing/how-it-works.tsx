import Image from "next/image";
import type { ReactNode } from "react";

import { formatNaira } from "@/lib/format";
import { cn } from "@/lib/utils";

import { JourneyMotion } from "./journey-motion";
import { KERNEL_SLICES } from "./lumora-mark";
import { CONTAINER, EYEBROW, Num, SECTION_HEADING } from "./shared";

// Photos are free Pexels images (16830912, 34705724, 14305368).
// They must not be presented as Lumora customers or endorsements.

const LISTING = `80 broilers · ${formatNaira(3500, "kg")} · Thu`;
const PAYOUT = formatNaira(323400);
const PAID = `Paid · 92.4 kg × ${formatNaira(3500, "kg")}`;

function Step({
  number,
  title,
  copy,
  visual,
  inverted = false,
  footer,
}: {
  number: string;
  title: string;
  copy: ReactNode;
  visual: ReactNode;
  inverted?: boolean;
  footer?: ReactNode;
}) {
  return (
    <li data-journey-step>
      <article
        data-journey-panel
        className={cn(
          "grid h-full gap-6 overflow-hidden rounded-[20px] p-6 md:grid-cols-2 md:p-8",
          inverted ? "bg-green text-paper" : "border border-line bg-paper text-ink",
        )}
      >
        <div className="flex min-w-0 flex-col justify-center">
          <span
            aria-hidden="true"
            className={cn(
              "journey-number font-num leading-none font-medium",
              inverted ? "text-paper/30" : "text-ink-muted/30",
            )}
          >
            {number}
          </span>
          <h3 className="journey-title mt-3 font-display leading-[1.1] font-medium text-balance">
            {title}
          </h3>
          <p className="mt-3 text-base leading-6">{copy}</p>
          {footer}
        </div>
        {visual}
      </article>
    </li>
  );
}

function StepPhoto({
  src,
  alt,
  position,
  children,
}: {
  src: string;
  alt: string;
  position: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl md:aspect-auto md:min-h-[260px]">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(min-width: 768px) 35vw, 100vw"
        className={cn("object-cover", position)}
      />
      {children}
    </div>
  );
}

export function HowItWorks() {
  return (
    <JourneyMotion>
      {/* The logo's kernel, in coordinates relative to the box it clips. */}
      <svg aria-hidden="true" width="0" height="0" className="absolute">
        <clipPath id="kernel-window" clipPathUnits="objectBoundingBox">
          {KERNEL_SLICES.map((d) => (
            <path key={d} d={d} />
          ))}
        </clipPath>
      </svg>

      <div className={CONTAINER}>
        <p className={cn(EYEBROW, "text-sage")}>How it works</p>
        <h2 className={cn(SECTION_HEADING, "mt-1 text-paper")}>
          From posted bid to paid delivery.
        </h2>
        <p className="mt-1 text-sage">One example delivery, from Rayfield to Bukuru.</p>
      </div>

      <ol data-journey-track className={cn(CONTAINER, "mt-10 grid gap-6")}>
        <Step
          number="01"
          title="Buyers post what they need"
          copy={
            <>
              Restaurant A in Rayfield posts <Num>80</Num> live broilers a day at{" "}
              <Num>{formatNaira(3500, "kg")}</Num>.
            </>
          }
          visual={
            <StepPhoto
              src="/images/step-buyer.jpg"
              alt="A smiling man carrying a live chicken and a bag through a covered market"
              position="object-[85%_30%]"
            >
              <p
                data-listing
                className="font-num absolute right-3 bottom-3 left-3 grid rounded-xl bg-paper px-3.5 py-3 text-xs leading-5 text-ink lg:text-sm"
              >
                {/* An invisible copy holds the card's full size while the text types in. */}
                <span aria-hidden="true" className="invisible col-start-1 row-start-1">
                  {LISTING}
                </span>
                <span data-listing-text className="col-start-1 row-start-1">
                  {LISTING}
                </span>
              </p>
            </StepPhoto>
          }
        />

        <Step
          number="02"
          inverted
          title="Farmers book a slot"
          copy={
            <>
              Amina in Bukuru books <Num>30</Num> birds for Thursday, and capacity drops to{" "}
              <Num>50</Num> for everyone else.
            </>
          }
          visual={
            <div className="flex min-w-0 flex-col items-center justify-center">
              <div className="journey-kernel w-full max-w-md">
                <div>
                  <div
                    data-kernel
                    className="relative aspect-[556/495] w-full"
                    style={{ clipPath: "url(#kernel-window)" }}
                  >
                    <Image
                      src="/images/step-farmer.jpg"
                      alt="A farmer in a straw hat holding fresh tomatoes in a green field"
                      fill
                      sizes="(min-width: 768px) 35vw, 448px"
                      className="object-cover object-[28%_0%]"
                    />
                  </div>
                </div>
                <div aria-hidden="true" className="mt-3 flex flex-col items-center gap-1.5">
                  <span data-ledger className="h-1 w-[92%] bg-sage" />
                  <span data-ledger className="h-1 w-[66%] bg-sage" />
                  <span data-ledger className="h-1 w-[40%] bg-sage" />
                </div>
              </div>
            </div>
          }
        />

        <Step
          number="03"
          title="Deliver and get paid"
          copy={
            <>
              The buyer records the weight, and Amina gets a bank transfer and an SMS.
            </>
          }
          footer={
            <>
              <p data-payout className="journey-payout font-num mt-4 leading-none font-medium text-[#9A6A1A]">
                {PAYOUT}
              </p>
              <p data-paid className="font-num mt-2 text-sm text-ink-muted">
                {PAID}
              </p>
            </>
          }
          visual={
            <StepPhoto
              src="/images/step-scale.jpg"
              alt="Hands weighing goods on a dial scale at an outdoor market"
              position="object-[50%_40%]"
            />
          }
        />
      </ol>
    </JourneyMotion>
  );
}
