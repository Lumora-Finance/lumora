"use client";

import { Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useLayoutEffect, useRef, useState } from "react";

import { BusyBar } from "@/components/loader/busy-bar";
import { LocationPicker, type PickedLocation } from "@/components/location/location-picker";
import { gsap, isReducedMotion } from "@/lib/gsap/effects";
import { validPhone } from "@/lib/logistics/location-input";
import { cn } from "@/lib/utils";

export type OnboardingRole = "farmer" | "buyer";
export type OnboardingStep = "role" | "name" | "phone" | "location" | "done";

const QUESTION_STEPS: OnboardingStep[] = ["role", "name", "phone", "location"];

const ROLES = [
  { value: "farmer", title: "I sell produce", detail: "See who's buying before you load up." },
  { value: "buyer", title: "I buy in bulk", detail: "Post what you need and what you'll pay." },
] as const;

const NEXT =
  "relative inline-flex h-[52px] min-w-28 items-center overflow-hidden justify-center rounded-2xl bg-green px-7 font-medium text-paper transition-[background-color,transform] duration-150 [-webkit-tap-highlight-color:transparent] hover:bg-green-hover focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.97] disabled:opacity-60 motion-reduce:active:scale-100";
const QUIET =
  "inline-flex h-[52px] items-center justify-center rounded-2xl px-4 font-medium text-ink transition-colors duration-150 [-webkit-tap-highlight-color:transparent] hover:bg-sage-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
const FIELD =
  "mt-2 h-[52px] w-full rounded-2xl border border-line bg-white px-4 text-base text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-ink-muted/70 focus-visible:border-green focus-visible:ring-3 focus-visible:ring-ring/30";
/** The small typewriter labels: "QUESTION 01", "SELECT ONLY ONE". */
const MICRO = "font-num text-[11px] leading-4 tracking-[0.08em] uppercase";

/** The tilt each sheet behind the card rests at. */
const FAN = [-3.5, 2.5];

export function OnboardingView({
  initialStep = "role",
  initialRole = "farmer",
  initialName = "",
  onSaveDetails,
  onSaveLocation,
  onFinish,
}: {
  initialStep?: OnboardingStep;
  initialRole?: OnboardingRole;
  initialName?: string;
  /** Returns an error message to show, or null when saved. */
  onSaveDetails: (details: { role: OnboardingRole; name: string; phone: string }) => Promise<string | null>;
  onSaveLocation: (location: PickedLocation) => Promise<void>;
  /** With details when they finished properly. Without when they skipped. */
  onFinish: (details?: { role: OnboardingRole; area: string | null }) => void;
}) {
  const [step, setStep] = useState(initialStep);
  const [role, setRole] = useState(initialRole);
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deck = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const direction = useRef<1 | -1>(1);
  const changing = useRef(false);
  const firstRender = useRef(true);
  const deckHeight = useRef<number | null>(null);
  const entrance = useRef<gsap.core.Timeline | null>(null);

  const firstName = name.trim().split(/\s+/)[0] ?? "";
  const position = QUESTION_STEPS.indexOf(step);
  // Someone returning to finish has no earlier step to go back to.
  const canGoBack = position > 0 && !(initialStep === "location" && step === "location");

  const sheets = () => deck.current?.querySelectorAll("[data-sheet]") ?? [];

  /**
   * Going on, the top card flicks away and the sheets behind straighten up to take its place. Going
   * back, it sinks into the deck, and the entrance brings the earlier card down on top.
   */
  function goTo(next: OnboardingStep, to: 1 | -1 = 1) {
    if (changing.current) return;
    setError(null);
    direction.current = to;
    const swap = () => {
      changing.current = false;
      deckHeight.current = deck.current?.offsetHeight ?? null;
      setStep(next);
    };
    if (isReducedMotion() || !card.current) {
      swap();
      return;
    }
    changing.current = true;
    entrance.current?.kill();
    const timeline = gsap.timeline({ onComplete: swap });
    if (to === 1) {
      timeline
        .to(card.current, { xPercent: -125, rotate: -9, duration: 0.36, ease: "power3.in" }, 0)
        .to(card.current, { opacity: 0, duration: 0.14, ease: "none" }, 0.22);
    } else {
      timeline.to(card.current, { scale: 0.93, rotate: 4, opacity: 0, duration: 0.26, ease: "power2.in" }, 0);
    }
    timeline.to(sheets(), { rotate: 0, scale: 0.98, duration: 0.34, ease: "power2.inOut" }, 0);
  }

  useLayoutEffect(() => {
    const front = card.current;
    if (!front) return;
    const arriving = firstRender.current;
    if (!arriving && !front.querySelector("input:not([type=radio])")) {
      // Keyboard and screen reader users land on the new question, or in its field if it has one.
      heading.current?.focus({ preventScroll: true });
    }
    firstRender.current = false;

    if (isReducedMotion()) {
      gsap.set(front, { clearProps: "transform,opacity" });
      gsap.fromTo(front, { opacity: 0 }, { opacity: 1, duration: 0.15, clearProps: "opacity" });
      return;
    }

    const items = front.querySelectorAll("[data-rise]");
    const title = heading.current?.firstElementChild ?? null;
    const timeline = gsap.timeline({ onComplete: () => void gsap.set(front, { clearProps: "transform,opacity" }) });
    entrance.current = timeline;

    if (deckHeight.current !== null && deck.current) {
      timeline.fromTo(deck.current, { height: deckHeight.current }, { height: "auto", duration: 0.6, ease: "expo.out", clearProps: "height" }, 0);
      deckHeight.current = null;
    }

    const start = arriving
      ? { xPercent: 0, y: 44, rotate: 3, scale: 0.96, opacity: 0 }
      : direction.current === 1
        ? { xPercent: 0, y: 0, rotate: 4, scale: 0.93, opacity: 0 }
        : { xPercent: -125, y: 0, rotate: -9, scale: 1, opacity: 0 };
    timeline
      .fromTo(front, start, { xPercent: 0, y: 0, rotate: 0, scale: 1, opacity: 1, duration: 0.7, ease: "expo.out" }, 0)
      .fromTo(
        sheets(),
        { rotate: 0, scale: 0.98 },
        { rotate: (index: number) => FAN[index], scale: 1, duration: 0.8, ease: "back.out(1.8)", stagger: 0.04 },
        0.04,
      )
      .fromTo(title, { yPercent: 115 }, { yPercent: 0, duration: 0.7, ease: "expo.out", clearProps: "transform" }, 0.1)
      .fromTo(items, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: "expo.out", stagger: 0.05, clearProps: "transform,opacity" }, 0.16);

    return () => {
      timeline.kill();
    };
  }, [step]);

  async function next(event: FormEvent) {
    event.preventDefault();
    if (step === "role") {
      goTo("name");
    } else if (step === "name") {
      if (name.trim().length < 2) setError("Please tell us your name.");
      else goTo("phone");
    } else if (step === "phone") {
      if (!validPhone(phone)) {
        setError("That doesn't look like a phone number. Try 0803 000 0000.");
        return;
      }
      setSaving(true);
      setError(null);
      const problem = await onSaveDetails({ role, name: name.trim(), phone });
      setSaving(false);
      if (problem) setError(problem);
      else goTo("location");
    }
  }

  async function chooseLocation(location: PickedLocation) {
    setSaving(true);
    await onSaveLocation(location);
    setSaving(false);
    setArea(location.area);
    goTo("done");
  }

  const headings: Record<OnboardingStep, string> = {
    role: "What brings you to Lumora?",
    name: "What should we call you?",
    phone: firstName ? `Nice to meet you, ${firstName}. What's your number?` : "What's your number?",
    location: role === "buyer" ? "Where should farmers deliver?" : "Where is your farm?",
    done: firstName ? `You're all set, ${firstName}.` : "You're all set.",
  };

  return (
    <main className="relative flex min-h-svh flex-col overflow-x-clip bg-[#DCE4DF] px-5 pt-4 pb-8 text-ink">
      {/* Faint rules on the page, like the sample's. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background-image:repeating-linear-gradient(90deg,rgb(14_46_35/0.05)_0_1px,transparent_1px_min(25vw,220px))]"
      />

      <Link
        href="/"
        className="relative inline-flex min-h-11 w-fit items-center gap-2 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:pl-3"
      >
        <Image src="/brand/lumora-mark.png" alt="" width={1024} height={945} className="h-6 w-auto" />
        <span className="font-display text-lg font-medium">lumora</span>
      </Link>

      <div className="relative flex flex-1 items-center justify-center py-5 sm:py-8">
        <div ref={deck} className="relative w-full max-w-[460px]">
          <div data-sheet aria-hidden="true" className="absolute inset-0 -rotate-[3.5deg] rounded-[28px] bg-white/45" />
          <div data-sheet aria-hidden="true" className="absolute inset-0 rotate-[2.5deg] rounded-[28px] bg-white/70" />

          <div ref={card} className="relative flex min-h-[min(520px,calc(100svh-7.5rem))] flex-col rounded-[28px] bg-white p-6 sm:p-9">
            <div
              role="progressbar"
              aria-label="Progress"
              aria-valuemin={0}
              aria-valuemax={QUESTION_STEPS.length}
              aria-valuenow={step === "done" ? QUESTION_STEPS.length : position + 1}
              className="flex gap-1.5"
            >
              {QUESTION_STEPS.map((item, index) => (
                <span key={item} className="h-[3px] flex-1 overflow-hidden rounded-full bg-line">
                  <span
                    className={cn(
                      "block h-full origin-left rounded-full bg-field transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
                      step === "done" || index <= position ? "scale-x-100" : "scale-x-0",
                    )}
                  />
                </span>
              ))}
            </div>

            <form onSubmit={next} noValidate className="mt-8 flex flex-1 flex-col sm:mt-10">
              <p data-rise className={cn(MICRO, "text-ink")}>
                {step === "done" ? "All done" : `Question 0${position + 1}`}
              </p>
              {/* The overflow is the mask the title rises out of. The padding keeps its descenders inside. */}
              <h1
                ref={heading}
                tabIndex={-1}
                className="mt-3 overflow-hidden pb-1 font-display text-[26px] leading-[1.2] font-medium text-balance outline-none sm:text-[30px]"
              >
                <span className="block">{headings[step]}</span>
              </h1>

              <div className="mt-6 sm:mt-8">
                {step === "role" && (
                  <fieldset>
                    <legend data-rise className={cn(MICRO, "text-ink-muted")}>
                      Select only one
                    </legend>
                    <div className="mt-2">
                      {ROLES.map(({ value, title, detail }) => (
                        <label
                          key={value}
                          data-rise
                          className="group -mx-2 flex cursor-pointer items-start gap-3 rounded-2xl px-2 py-3 transition-colors duration-150 [-webkit-tap-highlight-color:transparent] hover:bg-paper has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
                        >
                          <input
                            type="radio"
                            name="role"
                            value={value}
                            checked={role === value}
                            onChange={() => setRole(value)}
                            className="peer sr-only"
                          />
                          <span
                            aria-hidden="true"
                            className={cn(
                              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors duration-200",
                              role === value ? "border-field" : "border-ink-muted group-hover:border-ink",
                            )}
                          >
                            <span
                              className={cn(
                                "size-2.5 rounded-full bg-field transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none",
                                role === value ? "scale-100" : "scale-0",
                              )}
                            />
                          </span>
                          <span className="min-w-0">
                            <span className={cn("block leading-6 text-ink", role === value && "font-medium")}>{title}</span>
                            <span className="mt-0.5 block text-body-sm text-ink-muted">{detail}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}

                {step === "name" && (
                  <label data-rise className="block">
                    <span className={cn(MICRO, "text-ink-muted")}>Your name</span>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoComplete="name"
                      autoFocus
                      className={FIELD}
                    />
                  </label>
                )}

                {step === "phone" && (
                  <>
                    <label data-rise className="block">
                      <span className={cn(MICRO, "text-ink-muted")}>Phone number</span>
                      <input
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        autoFocus
                        placeholder="0803 000 0000"
                        className={cn(FIELD, "font-num")}
                      />
                    </label>
                    <p data-rise className="mt-3 text-body-sm text-ink-muted">
                      {role === "buyer"
                        ? "We email you when a farmer books. Farmers only see it after that."
                        : "We email you when buyers want what you have. Buyers only see it after you book."}
                    </p>
                  </>
                )}

                {step === "location" && (
                  <div data-rise>
                    <LocationPicker onPick={chooseLocation} disabled={saving} />
                  </div>
                )}

                {step === "done" && (
                  <div>
                    <span data-rise className="flex size-12 items-center justify-center rounded-full bg-field text-[#9BD27A]">
                      <Check aria-hidden="true" strokeWidth={2.5} className="size-6" />
                    </span>
                    <p data-rise className="mt-4 text-ink-muted">
                      {role === "buyer"
                        ? `Farmers${area ? ` near ${area}` : ""} can sell to you now. Post what you need to get started.`
                        : `We'll show you buyers${area ? ` near ${area}` : ""}, closest and best paying first.`}
                    </p>
                  </div>
                )}

                {error && (
                  <p role="alert" className="mt-3 text-body-sm text-danger">
                    {error}
                  </p>
                )}
              </div>

              <div data-rise className="mt-auto flex items-center justify-end gap-2 pt-8">
                {canGoBack && (
                  <button type="button" onClick={() => goTo(QUESTION_STEPS[position - 1], -1)} className={QUIET}>
                    Back
                  </button>
                )}
                {step === "location" && (
                  <button type="button" onClick={() => onFinish()} className={cn(QUIET, "text-ink-muted")}>
                    Skip for now
                  </button>
                )}
                {step === "done" && (
                  <button type="button" onClick={() => onFinish({ role, area })} className={NEXT}>
                    Take me in
                  </button>
                )}
                {(step === "role" || step === "name" || step === "phone") && (
                  <button type="submit" disabled={saving} className={NEXT}>
                    Next
                    <BusyBar active={saving} />
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
