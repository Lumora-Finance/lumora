"use client";

import { gsap, refreshTriggers, ScrollTrigger, useGSAP } from "@/lib/gsap/effects";

const COLORS: Record<string, string> = {
  paper: "#F6F3EC",
  white: "#FFFFFF",
  field: "#0E2E23",
};

const TEXT_COLORS: Record<string, { from: string; to: string }> = {
  heading: { from: "#14201B", to: "#F6F3EC" },
  muted: { from: "#6B7B73", to: "#8FB8A4" },
};

/** Page-wide scroll behaviour: background rhythm and trigger refreshes. Renders nothing. */
export function PageMotion() {
  useGSAP(() => {
    const media = gsap.matchMedia();

    media.add("(prefers-reduced-motion: no-preference)", () => {
      const root = document.documentElement;
      root.classList.add("rhythm-live");

      let previous = COLORS.paper;
      gsap.utils.toArray<HTMLElement>("[data-rhythm]").forEach((section) => {
        const color = COLORS[section.dataset.rhythm ?? "paper"];
        if (color !== previous) {
          const scrollTrigger = {
            trigger: section,
            start: "top 70%",
            end: "top 30%",
            scrub: true,
          };

          gsap.fromTo(
            document.body,
            { backgroundColor: previous },
            { backgroundColor: color, ease: "none", immediateRender: false, scrollTrigger },
          );
          section.querySelectorAll<HTMLElement>("[data-rhythm-text]").forEach((text) => {
            const colors = TEXT_COLORS[text.dataset.rhythmText ?? "heading"];
            gsap.fromTo(
              text,
              { color: colors.from },
              { color: colors.to, ease: "none", scrollTrigger },
            );
          });
        }
        previous = color;
      });

      return () => {
        root.classList.remove("rhythm-live");
        gsap.set(document.body, { clearProps: "backgroundColor" });
      };
    });

    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      clearTimeout(timer);
      // A refresh cancels a smooth scroll in progress, such as a click on a nav link.
      timer = setTimeout(() => {
        if (ScrollTrigger.isScrolling()) scheduleRefresh();
        else refreshTriggers();
      }, 150);
    };
    const images = Array.from(document.images).filter((image) => !image.complete);

    images.forEach((image) => image.addEventListener("load", scheduleRefresh));
    window.addEventListener("load", scheduleRefresh);
    document.fonts?.ready.then(scheduleRefresh);
    scheduleRefresh();

    return () => {
      clearTimeout(timer);
      images.forEach((image) => image.removeEventListener("load", scheduleRefresh));
      window.removeEventListener("load", scheduleRefresh);
      media.revert();
    };
  });

  return null;
}
