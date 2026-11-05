"use client";

import { ArrowLeft, Check, MessageSquareText, ShoppingBasket, Sprout } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useLayoutEffect, useRef, useState } from "react";

import { LocationPicker, type PickedLocation } from "@/components/location/location-picker";
import { gsap, isReducedMotion } from "@/lib/gsap/effects";
import { validPhone } from "@/lib/logistics/location-input";
import { cn } from "@/lib/utils";

import { SidePanel } from "./side-panel";

export type OnboardingRole = "farmer" | "buyer";
export type OnboardingStep = "role" | "name" | "phone" | "location" | "done";

const QUESTION_STEPS: OnboardingStep[] = ["role", "name", "phone", "location"];

const ROLES = [
  { value: "farmer", icon: Sprout, title: "I sell produce", detail: "See who's buying before you load up." },
  { value: "buyer", icon: ShoppingBasket, title: "I buy in bulk", detail: "Post what you need and what you'll pay." },
] as const;

const PRIMARY =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-green px-8 text-base font-medium text-paper transition-[background-color,scale] duration-200 ease-out hover:bg-green-hover focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none";
const SECONDARY =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-line bg-white px-6 text-base font-medium text-ink transition-colors duration-200 ease-out hover:bg-sage-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
const FIELD =
  "mt-2 h-14 w-full rounded-2xl border border-line bg-white px-4 text-lg text-ink outline-none transition-[border-color,box-shadow] duration-200 ease-out focus-visible:border-green focus-visible:ring-3 focus-visible:ring-ring/30";

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
  onFinish: () => void;
}) {
  const [step, setStep] = useState(initialStep);
  const [role, setRole] = useState(initialRole);
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const content = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const direction = useRef<1 | -1>(1);
  const changing = useRef(false);
  const firstRender = useRef(true);

  const firstName = name.trim().split(/\s+/)[0] ?? "";
  const position = QUESTION_STEPS.indexOf(step);
  // Someone returning to finish has no earlier step to go back to.
  const canGoBack = position > 0 && !(initialStep === "location" && step === "location");

  /** Slides the current question away, then swaps it. The new one slides in below. */
  function goTo(next: OnboardingStep, to: 1 | -1 = 1) {
    if (changing.current) return;
    setError(null);
    direction.current = to;
    if (isReducedMotion() || !content.current) {
      setStep(next);
      return;
    }
    changing.current = true;
    // Opacity, not visibility: a hidden element can't take focus when the next question mounts.
    gsap.to(content.current, {
      opacity: 0,
      x: -28 * to,
      duration: 0.2,
      ease: "power2.in",
      onComplete: () => {
        changing.current = false;
        setStep(next);
      },
    });
  }

  useLayoutEffect(() => {
    const element = content.current;
    if (!element) return;
    if (firstRender.current) {
      firstRender.current = false;
    } else {
      // Keyboard and screen reader users land on the new question, or in its field if it has one.
      if (!element.querySelector("input")) heading.current?.focus({ preventScroll: true });
    }
    if (isReducedMotion()) {
      gsap.set(element, { clearProps: "all" });
      return;
    }
    const items = element.querySelectorAll("[data-rise]");
    const timeline = gsap.timeline();
    timeline.fromTo(element, { opacity: 0, x: 28 * direction.current }, { opacity: 1, x: 0, duration: 0.4, ease: "power3.out" });
    if (items.length > 0) {
      timeline.fromTo(items, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.06, ease: "power2.out", clearProps: "transform,opacity" }, 0.08);
    }
    return () => {
      timeline.kill();
    };
  }, [step]);

  function submitName(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError("Please tell us your name.");
      return;
    }
    goTo("phone");
  }

  async function submitPhone(event: FormEvent) {
    event.preventDefault();
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

  const errorLine = error && (
    <p role="alert" className="mt-3 text-body-sm text-danger">
      {error}
    </p>
  );

  const backButton = canGoBack && (
    <button
      type="button"
      onClick={() => goTo(QUESTION_STEPS[position - 1], -1)}
      className={SECONDARY}
    >
      <ArrowLeft aria-hidden="true" strokeWidth={1.5} className="size-4" />
      Back
    </button>
  );

  return (
    <main className="flex min-h-svh bg-paper p-3 text-ink lg:gap-3">
      <div className="flex min-w-0 flex-1 flex-col px-3 py-3 sm:px-8 lg:px-12 xl:px-20">
        <Link
          href="/"
          className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Image src="/brand/lumora-mark.png" alt="" width={1024} height={945} className="h-7 w-auto" />
          <span className="font-display text-xl font-medium">lumora</span>
        </Link>

        <div className="mx-auto flex w-full max-w-[32rem] flex-1 flex-col justify-center py-8">
          {step !== "done" && (
            <div className="mb-8">
              <div aria-hidden="true" className="flex gap-1.5">
                {QUESTION_STEPS.map((item, index) => (
                  <span key={item} className="h-1.5 w-10 overflow-hidden rounded-full bg-line">
                    <span
                      className={cn(
                        "block h-full origin-left rounded-full bg-green transition-transform duration-500 ease-out motion-reduce:transition-none",
                        index <= position ? "scale-x-100" : "scale-x-0",
                      )}
                    />
                  </span>
                ))}
              </div>
              <p className="font-num mt-2 text-xs text-ink-muted">
                {position + 1} of {QUESTION_STEPS.length}
              </p>
            </div>
          )}

          <div ref={content}>
            <h1
              ref={heading}
              tabIndex={-1}
              className="font-display text-[2rem] leading-[1.15] font-medium text-balance outline-none sm:text-[2.5rem]"
            >
              {headings[step]}
            </h1>

            {step === "role" && (
              <>
                <div role="radiogroup" aria-label="What brings you to Lumora?" className="mt-8 grid gap-3 sm:grid-cols-2">
                  {ROLES.map(({ value, icon: Icon, title, detail }) => {
                    const selected = role === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        data-rise
                        onClick={() => setRole(value)}
                        className={cn(
                          "relative flex min-h-[148px] flex-col rounded-3xl border p-5 text-left transition-[background-color,border-color,color,scale] duration-300 ease-out hover:scale-[1.02] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.99] motion-reduce:transition-none motion-reduce:hover:scale-100 sm:min-h-[196px]",
                          selected ? "border-field bg-field text-paper" : "border-line bg-white text-ink hover:border-sage",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-12 items-center justify-center rounded-2xl transition-colors duration-300",
                            selected ? "bg-field-soft text-sage" : "bg-sage-soft text-green",
                          )}
                        >
                          <Icon aria-hidden="true" strokeWidth={1.5} className="size-6" />
                        </span>
                        <span className="mt-auto pt-4 text-lg leading-6 font-semibold">{title}</span>
                        <span className={cn("mt-1 text-body-sm", selected ? "text-sage" : "text-ink-muted")}>{detail}</span>
                        <span
                          aria-hidden="true"
                          className={cn(
                            "absolute top-4 right-4 flex size-7 items-center justify-center rounded-full bg-amber text-ink transition-[scale,opacity] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none",
                            selected ? "scale-100 opacity-100" : "scale-50 opacity-0",
                          )}
                        >
                          <Check strokeWidth={2.5} className="size-4" />
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-8" data-rise>
                  <button type="button" onClick={() => goTo("name")} className={PRIMARY}>
                    Continue
                  </button>
                </div>
              </>
            )}

            {step === "name" && (
              <form onSubmit={submitName} className="mt-8">
                <label data-rise className="block text-body-sm font-medium">
                  Your name
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    autoFocus
                    className={FIELD}
                  />
                </label>
                {errorLine}
                <div data-rise className="mt-8 flex flex-wrap gap-3">
                  {backButton}
                  <button type="submit" className={PRIMARY}>
                    Continue
                  </button>
                </div>
              </form>
            )}

            {step === "phone" && (
              <form onSubmit={submitPhone} className="mt-8">
                <label data-rise className="block text-body-sm font-medium">
                  Phone number
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
                <p data-rise className="mt-3 flex items-start gap-2 text-body-sm text-ink-muted">
                  <MessageSquareText aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-4 shrink-0" />
                  {role === "buyer"
                    ? "We text you when a farmer books. Farmers only see it after that."
                    : "We text you when buyers want what you have. Buyers only see it after you book."}
                </p>
                {errorLine}
                <div data-rise className="mt-8 flex flex-wrap gap-3">
                  {backButton}
                  <button type="submit" disabled={saving} className={PRIMARY}>
                    {saving ? "Saving…" : "Continue"}
                  </button>
                </div>
              </form>
            )}

            {step === "location" && (
              <div className="mt-8">
                <div data-rise>
                  <LocationPicker onPick={chooseLocation} disabled={saving} />
                </div>
                <div data-rise className="mt-6 flex flex-wrap items-center gap-3">
                  {backButton}
                  <button
                    type="button"
                    onClick={onFinish}
                    className="inline-flex min-h-12 items-center rounded-full px-4 text-ink-muted underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    Skip for now
                  </button>
                </div>
              </div>
            )}

            {step === "done" && (
              <div className="mt-4">
                <p data-rise className="text-lg text-ink-muted">
                  {role === "buyer"
                    ? `Farmers${area ? ` near ${area}` : ""} can sell to you now. Post what you need to get started.`
                    : `We'll show you buyers${area ? ` near ${area}` : ""}, closest and best paying first.`}
                </p>
                <div data-rise className="mt-8">
                  <button type="button" onClick={onFinish} className={PRIMARY}>
                    Take me in
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <SidePanel step={step} role={role} firstName={firstName} area={area} />
    </main>
  );
}
