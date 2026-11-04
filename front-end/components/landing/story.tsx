import Image from "next/image";

import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

import { CONTAINER, SECTION_SPACING } from "./shared";

const CHIP = "mx-1 inline-block h-10 w-14 overflow-hidden rounded-lg align-middle";

export function Story() {
  return (
    <section data-rhythm="paper" className={SECTION_SPACING}>
      <div className={CONTAINER}>
        <Reveal effect="wordReveal" selector="p">
          <p className="max-w-[900px] text-[28px] leading-10 font-medium md:text-[40px] md:leading-[3.5rem]">
            Every harvest starts with{" "}
            <span className={CHIP}>
              <Image
                src="/images/step-buyer.jpg"
                alt=""
                width={112}
                height={80}
                className="size-full object-cover object-[85%_30%]"
              />
            </span>{" "}
            a buyer. Then come the phone calls, the &apos;come back tomorrow&apos; and the wasted
            trip to market.{" "}
            <span className={cn(CHIP, "border border-line bg-card p-1.5")}>
              <Image
                src="/brand/lumora-mark.png"
                alt=""
                width={64}
                height={59}
                className="size-full object-contain"
              />
            </span>{" "}
            Lumora puts every buyer on one board, with the price per kg and how much they can take
            today, so you book before you load the truck.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
