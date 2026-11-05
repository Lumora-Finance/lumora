"use client";

import { useRef } from "react";

import { gsap, isReducedMotion, pauseOffscreen, useGSAP } from "@/lib/gsap/effects";
import { AREAS } from "@/lib/logistics/areas";

const RADIUS = 92;
const PULSE_SECONDS = 3.6;
const PULSES = 3;

/**
 * The real areas around this farmer, each on its true bearing. Radius goes by nearness rank rather than
 * kilometres, or the town areas would pile on top of each other with Barkin Ladi far beyond them.
 */
function placeAreas(areaName: string) {
  const center = AREAS.find((area) => area.name === areaName);
  const lat = center?.lat ?? AREAS.reduce((sum, area) => sum + area.lat, 0) / AREAS.length;
  const lng = center?.lng ?? AREAS.reduce((sum, area) => sum + area.lng, 0) / AREAS.length;
  const offsets = AREAS.filter((area) => area.name !== center?.name)
    .map((area) => {
      const east = (area.lng - lng) * Math.cos((lat * Math.PI) / 180);
      const north = area.lat - lat;
      return { name: area.name, angle: Math.atan2(north, east), reach: Math.hypot(east, north) };
    })
    .sort((a, b) => a.reach - b.reach);
  return offsets.map(({ name, angle }, rank) => {
    const r = RADIUS * (0.28 + (0.66 * rank) / Math.max(offsets.length - 1, 1));
    return { name, x: Math.cos(angle) * r, y: -Math.sin(angle) * r, r };
  });
}

export function BuyerRadar({ area }: { area: string }) {
  const scope = useRef<SVGSVGElement>(null);
  const places = placeAreas(area);

  useGSAP(
    () => {
      const root = scope.current;
      if (!root || isReducedMotion()) return;
      const pulses = gsap.utils.toArray<SVGCircleElement>("[data-pulse]", root).map((pulse, index) =>
        gsap.fromTo(
          pulse,
          { attr: { r: 6 }, opacity: 0.6 },
          { attr: { r: RADIUS }, opacity: 0, duration: PULSE_SECONDS, ease: "none", repeat: -1, delay: (index * PULSE_SECONDS) / PULSES },
        ),
      );
      // Each place lights as a pulse reaches it.
      const dots = gsap.utils.toArray<SVGCircleElement>("[data-place]", root).map((dot) => {
        const reach = Number(dot.dataset.place) / RADIUS;
        const timeline = gsap.timeline({ repeat: -1, repeatDelay: PULSE_SECONDS / PULSES - 0.9, delay: reach * PULSE_SECONDS });
        timeline
          .to(dot, { opacity: 1, duration: 0.25, ease: "power2.out" })
          .to(dot, { opacity: 0.35, duration: 0.65, ease: "power1.in" });
        return timeline;
      });
      gsap.fromTo(root, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: "expo.out", transformOrigin: "center" });
      pauseOffscreen([...pulses, ...dots], root);
    },
    { scope, dependencies: [area], revertOnUpdate: true },
  );

  return (
    <svg ref={scope} aria-hidden="true" viewBox="-100 -100 200 200" className="mx-auto block size-44 sm:size-52">
      {[RADIUS / 3, (RADIUS * 2) / 3, RADIUS].map((r) => (
        <circle key={r} r={r} fill="none" className="stroke-line" strokeWidth={1} />
      ))}
      {Array.from({ length: PULSES }, (_, index) => (
        <circle key={index} data-pulse r={RADIUS} fill="none" className="stroke-green" strokeWidth={1.25} opacity={0} />
      ))}
      {places.map((place) => (
        <circle key={place.name} data-place={place.r} cx={place.x} cy={place.y} r={3} className="fill-green" opacity={0.35} />
      ))}
      <circle r={11} className="fill-sage-soft" />
      <circle r={5.5} className="fill-field" />
    </svg>
  );
}
