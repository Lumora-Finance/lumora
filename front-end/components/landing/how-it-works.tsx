import { ArrowUpRight } from "lucide-react";
import Image from "next/image";

import { formatNaira } from "@/lib/format";
import { cn } from "@/lib/utils";

import { CONTAINER, Num, SECTION_HEADING, SECTION_SPACING } from "./shared";
import { StepCardsMotion } from "./step-cards-motion";

// Photos are free Pexels images (16830912, 34705724, 14305368).
// They must not be presented as Lumora customers or endorsements.

const CARD =
  "group flex flex-col rounded-2xl transition-[translate] duration-200 ease-out motion-reduce:transition-none lg:min-h-[540px] lg:hover:-translate-y-1";

function StepHeader({
  step,
  href,
  linkLabel,
  inverted = false,
}: {
  step: number;
  href: string;
  linkLabel: string;
  inverted?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span
        className={cn(
          "rounded-md border px-2.5 py-1 text-label font-medium",
          inverted ? "border-paper/30 text-paper" : "border-line text-ink-muted",
        )}
      >
        Step <Num>{step}</Num>
      </span>
      <a
        href={href}
        aria-label={linkLabel}
        className={cn(
          "inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-line bg-card text-ink transition-colors duration-200 ease-out hover:bg-sage-soft focus-visible:ring-3 focus-visible:outline-none md:size-10",
          inverted ? "focus-visible:ring-paper/60" : "focus-visible:ring-ring/50",
        )}
      >
        <ArrowUpRight
          aria-hidden="true"
          strokeWidth={1.5}
          className="size-5 transition-[rotate] duration-200 ease-out motion-reduce:transition-none lg:group-hover:rotate-45"
        />
      </a>
    </div>
  );
}

function StepPhoto({ src, alt, position }: { src: string; alt: string; position: string }) {
  return (
    <div className="relative mt-auto aspect-[5/4] overflow-hidden rounded-t-xl md:aspect-video lg:aspect-[5/4]">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(min-width: 1024px) 33vw, 100vw"
        className={cn("object-cover", position)}
      />
    </div>
  );
}

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      data-rhythm="field"
      className={cn("relative scroll-mt-4", SECTION_SPACING)}
    >
      {/* The logo's kernel, in coordinates relative to the box it clips. */}
      <svg aria-hidden="true" width="0" height="0" className="absolute">
        <clipPath id="kernel-window" clipPathUnits="objectBoundingBox">
          <path d="M.5 0Q.73 .172 .888 .501H.112Q.27 .172 .5 0Z" />
          <path d="M.081 .572H.917Q.944 .642 .96 .715H.038Q.054 .642 .081 .572Z" />
          <path d="M.023 .786H.977Q.996 .889 1 1H0Q.004 .889 .023 .786Z" />
        </clipPath>
      </svg>

      <div className={CONTAINER}>
        <h2 data-rhythm-text="heading" className={cn(SECTION_HEADING, "text-paper")}>
          From posted bid to paid delivery.
        </h2>
        <p data-rhythm-text="muted" className="mt-3 text-sage">
          One example delivery, from Rayfield to Bukuru.
        </p>

        <StepCardsMotion>
          <li className={cn(CARD, "border border-line bg-paper px-5 pt-5")}>
            <StepHeader step={1} href="#buyers" linkLabel="See how buyers post demand" />
            <h3 className="mt-5 text-title font-semibold">Buyers post what they need</h3>
            <p className="mt-2 pb-8">
              Restaurant A in Rayfield posts <Num>80</Num> live broilers a day at{" "}
              <Num>{formatNaira(3500, "kg")}</Num>.
            </p>
            <StepPhoto
              src="/images/step-buyer.jpg"
              alt="A smiling man carrying a live chicken and a bag through a covered market"
              position="object-[85%_30%]"
            />
          </li>

          <li className={cn(CARD, "bg-green p-5 text-paper")}>
            <div className="mx-auto w-full max-w-md">
              <div
                data-kernel
                className="relative aspect-[556/495] w-full"
                style={{ clipPath: "url(#kernel-window)" }}
              >
                <Image
                  src="/images/step-farmer.jpg"
                  alt="A farmer in a straw hat holding fresh tomatoes in a green field"
                  fill
                  sizes="(min-width: 1024px) 33vw, 448px"
                  className="object-cover object-[28%_0%]"
                />
              </div>
            </div>
            <div aria-hidden="true" className="mt-3 flex flex-col items-center gap-1.5">
              <span data-ledger className="h-1 w-[92%] bg-sage" />
              <span data-ledger className="h-1 w-[66%] bg-sage" />
              <span data-ledger className="h-1 w-[40%] bg-sage" />
            </div>
            <div className="mt-auto pt-6">
              <StepHeader
                step={2}
                href="#producers"
                linkLabel="See how farmers find and book buyers"
                inverted
              />
              <h3 className="mt-5 text-title font-semibold">Farmers book a slot</h3>
              <p className="mt-2">
                Amina in Bukuru books <Num>30</Num> birds for Thursday. Capacity drops to{" "}
                <Num>50</Num> for everyone else.
              </p>
            </div>
          </li>

          <li className={cn(CARD, "border border-line bg-paper px-5 pt-5")}>
            <StepHeader
              step={3}
              href="#prices"
              linkLabel="See how settled deliveries feed the price index"
            />
            <h3 className="mt-5 text-title font-semibold">Deliver and get paid</h3>
            <p className="mt-2">
              The buyer records <Num>92.4</Num> kg at <Num>{formatNaira(3500, "kg")}</Num>. Amina
              gets a bank transfer and an SMS.
            </p>
            <p data-payout className="font-num mt-3 pb-8 text-number-lg font-medium">
              {formatNaira(323400)}
            </p>
            <StepPhoto
              src="/images/step-scale.jpg"
              alt="Hands weighing goods on a dial scale at an outdoor market"
              position="object-[50%_40%]"
            />
          </li>
        </StepCardsMotion>
      </div>
    </section>
  );
}
