"use client";

import { CheckCircle2, MapPin, MessageSquareText } from "lucide-react";
import Image from "next/image";
import { useLayoutEffect, useRef } from "react";

import { gsap, isReducedMotion } from "@/lib/gsap/effects";

import type { OnboardingRole, OnboardingStep } from "./onboarding-view";

// Pexels photos, free licence. They must not imply these people endorse Lumora.
const PHOTOS = [
  { src: "/images/hero-farm.jpg", position: "object-[62%_25%]" },
  { src: "/images/step-buyer.jpg", position: "object-[80%_30%]" },
  { src: "/images/step-farmer.jpg", position: "object-[28%_15%]" },
  { src: "/images/signup.jpg", position: "object-[28%_20%]" },
  { src: "/images/step-scale.jpg", position: "object-[50%_40%]" },
];

function photoFor(step: OnboardingStep, role: OnboardingRole) {
  if (step === "role") return role === "buyer" ? 1 : 0;
  if (step === "name") return role === "buyer" ? 3 : 2;
  if (step === "phone") return role === "buyer" ? 4 : 3;
  if (step === "location") return role === "buyer" ? 1 : 2;
  return role === "buyer" ? 1 : 0;
}

function FloatingCard({
  step,
  role,
  firstName,
  area,
}: {
  step: OnboardingStep;
  role: OnboardingRole;
  firstName: string;
  area: string | null;
}) {
  const heading = "text-base leading-5 font-semibold text-ink";
  const detail = "mt-1 text-body-sm text-ink-muted";

  if (step === "role" && role === "farmer") {
    return (
      <>
        <p className="font-num text-2xl leading-7 font-medium text-[#9A6A1A]">₦3,800</p>
        <p className="text-body-sm text-ink-muted">for every kg</p>
        <p className="mt-2 border-t border-line pt-2 text-body-sm font-medium text-ink">Caterer D needs 40 chickens</p>
      </>
    );
  }
  if (step === "role") {
    return (
      <>
        <p className={heading}>Amina booked 30 birds</p>
        <p className={detail}>For Thursday, 7 to 11</p>
      </>
    );
  }
  if (step === "name") {
    return (
      <>
        <p className="text-body-sm text-ink-muted">{role === "buyer" ? "Farmers will see" : "Buyers will see"}</p>
        <p className="mt-0.5 min-h-7 truncate font-display text-xl leading-7 font-medium text-ink">{firstName || "Your name"}</p>
      </>
    );
  }
  if (step === "phone") {
    return (
      <div className="flex gap-3">
        <MessageSquareText aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-5 shrink-0 text-green" />
        <p className="font-num text-sm leading-5 text-ink">
          {role === "buyer" ? "Amina booked 30. Code LM-4821." : "Caterer D wants chickens. Reply SELL 1 20"}
        </p>
      </div>
    );
  }
  if (step === "location") {
    return (
      <div className="flex gap-3">
        <MapPin aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-5 shrink-0 text-green" />
        <div>
          <p className={heading}>Very close to you</p>
          <p className={detail}>About 3 km. We only ever show your area.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <CheckCircle2 aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-5 shrink-0 text-green" />
      <div>
        <p className={heading}>Welcome to Lumora</p>
        <p className={detail}>{area ? `Near ${area}` : "Set your area any time"}</p>
      </div>
    </div>
  );
}

/** The photo beside each question, with a small card that reacts to the answers. Wide screens only. */
export function SidePanel({
  step,
  role,
  firstName,
  area,
}: {
  step: OnboardingStep;
  role: OnboardingRole;
  firstName: string;
  area: string | null;
}) {
  const root = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const shown = useRef<number | null>(null);
  const active = photoFor(step, role);

  // Crossfades to the new photo, which also settles from a slight zoom.
  useLayoutEffect(() => {
    const photos = gsap.utils.toArray<HTMLElement>("[data-panel-photo]", root.current);
    const previous = shown.current;
    shown.current = active;

    if (previous === null || isReducedMotion()) {
      photos.forEach((photo, index) => gsap.set(photo, { autoAlpha: index === active ? 1 : 0, scale: 1 }));
      return;
    }
    if (previous === active) return;
    gsap.fromTo(photos[active], { autoAlpha: 0, scale: 1.06 }, { autoAlpha: 1, scale: 1, duration: 0.7, ease: "power2.out", zIndex: 1, overwrite: true });
    gsap.to(photos[previous], { autoAlpha: 0, duration: 0.7, ease: "none", zIndex: 0, overwrite: true });
  }, [active]);

  // A new card rises in whenever the question or the choice changes.
  useLayoutEffect(() => {
    if (isReducedMotion() || !card.current) return;
    const tween = gsap.fromTo(card.current, { y: 16, autoAlpha: 0, rotate: -1.5 }, { y: 0, autoAlpha: 1, rotate: 0, duration: 0.5, delay: 0.15, ease: "back.out(1.6)" });
    return () => {
      tween.kill();
    };
  }, [step, role]);

  return (
    <aside ref={root} aria-hidden="true" className="relative hidden w-[44%] shrink-0 overflow-hidden rounded-3xl bg-field lg:block">
      {PHOTOS.map((photo, index) => (
        <div key={photo.src} data-panel-photo className="absolute inset-0 opacity-0 first:opacity-100">
          <Image
            src={photo.src}
            alt=""
            fill
            sizes="44vw"
            preload={index === 0}
            className={`object-cover ${photo.position}`}
          />
        </div>
      ))}
      <div className="absolute inset-x-0 bottom-0 z-10 h-1/3 bg-linear-to-t from-field/50 to-transparent" />
      <div ref={card} className="absolute bottom-8 left-8 z-20 w-[min(280px,calc(100%-4rem))] rounded-2xl bg-white p-4">
        <FloatingCard step={step} role={role} firstName={firstName} area={area} />
      </div>
      <p className="absolute right-8 bottom-8 z-20 text-xs text-paper/80">Example</p>
    </aside>
  );
}
