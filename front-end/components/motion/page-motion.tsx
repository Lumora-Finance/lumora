"use client";

import Lenis from "lenis";

import { gsap, panelEntrance, refreshTriggers, ScrollTrigger, useGSAP } from "@/lib/gsap/effects";

const COLORS: Record<string, string> = {
  paper: "#F6F3EC",
  white: "#FFFFFF",
  field: "#0E2E23",
};

/** Smooth wheel scrolling, driven by GSAP's clock so pins and scrubs stay in step with it. */
function startSmoothScroll() {
  const lenis = new Lenis({ anchors: true });
  const raf = (time: number) => lenis.raf(time * 1000);
  // Lenis measures the page on a delay, but a pin can make the page taller on the first scroll.
  const measure = () => lenis.resize();

  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);
  ScrollTrigger.addEventListener("refresh", measure);

  return () => {
    ScrollTrigger.removeEventListener("refresh", measure);
    gsap.ticker.remove(raf);
    gsap.ticker.lagSmoothing(500, 33);
    lenis.destroy();
  };
}

/** One trigger per section. The page takes the colour of the last section to reach 60%. */
function startBackgrounds() {
  const root = document.documentElement;
  root.classList.add("bg-live");

  const apply = () => {
    const current = triggers.filter((trigger) => trigger.isActive).at(-1);
    const name = (current?.trigger as HTMLElement | undefined)?.dataset.bg ?? "paper";
    gsap.to(document.body, {
      backgroundColor: COLORS[name],
      duration: 0.5,
      ease: "power2.inOut",
      overwrite: true,
    });
  };

  const triggers = gsap.utils.toArray<HTMLElement>("[data-bg]").map((section) =>
    ScrollTrigger.create({
      trigger: section,
      start: "top 60%",
      end: "max",
      onToggle: apply,
    }),
  );

  return () => {
    root.classList.remove("bg-live");
    gsap.killTweensOf(document.body);
    gsap.set(document.body, { clearProps: "backgroundColor" });
  };
}

/** Page-wide scroll behaviour: smooth scroll, backgrounds, entrances, refreshes. Renders nothing. */
export function PageMotion() {
  useGSAP(() => {
    const media = gsap.matchMedia();

    media.add("(prefers-reduced-motion: no-preference)", () => {
      const stopSmoothScroll = startSmoothScroll();
      const stopBackgrounds = startBackgrounds();

      gsap.utils.toArray<HTMLElement>("[data-entrance]").forEach((panel) => {
        panelEntrance(panel, panel.parentElement, {
          rounded: panel.dataset.entrance !== "scale",
        });
      });

      return () => {
        stopBackgrounds();
        stopSmoothScroll();
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
