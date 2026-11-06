"use client";

import { Check, ImagePlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuthUser } from "@/components/auth/use-auth-user";
import { money } from "@/lib/email/format";
import { gsap, isReducedMotion, useGSAP } from "@/lib/gsap/effects";
import { wipeAway } from "@/lib/gsap/page-wipe";
import { apiFetch } from "@/lib/logistics/client";
import { nairaToKobo } from "@/lib/money/rules";
import { cn } from "@/lib/utils";

/** Commodities a farmer can list, with the unit buyers see them in. */
const SELL_COMMODITIES = [
  { name: "Live broilers", unit: "kg" },
  { name: "Turkey", unit: "kg" },
  { name: "Tomatoes", unit: "basket" },
  { name: "Eggs", unit: "crate" },
] as const;

export const SELL_STEPS = 3;

export type SellDraft = {
  title: string;
  description: string;
  commodity: (typeof SELL_COMMODITIES)[number]["name"];
  price: string;
  qty: string;
  images: string[];
};

const START: SellDraft = {
  title: "",
  description: "",
  commodity: "Live broilers",
  price: "",
  qty: "",
  images: [],
};

const FIELD =
  "mt-2 h-[52px] w-full min-w-0 appearance-none rounded-2xl border border-line bg-white px-4 text-base text-ink outline-none transition-colors duration-150 placeholder:text-ink-muted/70 focus-visible:border-green focus-visible:bg-white focus-visible:ring-3 focus-visible:ring-ring/40 sm:h-14 sm:bg-paper/60";
const LABEL = "block text-body-sm font-medium text-ink";
const HINT = "mt-1.5 block text-body-sm font-normal text-ink-muted";
/** Equal columns on phones, so rows line up. */
const CHIPS = "mt-2 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap";

const STEPS = [
  { title: "What are you selling?", lead: "Buyers near you see this on the board." },
  { title: "What do you want for it?", lead: "Set your price and how much you have." },
  { title: "Add photos and post", lead: "Buyers can start reaching you as soon as you post." },
];

const FAILURES: Record<string, string> = {
  not_a_farmer: "Only farmer accounts can post supply. Check your role in your profile.",
  invalid_numbers: "Check the price and quantity.",
  too_many_images: "You can only add up to 4 photos.",
  images_required: "Add 1 to 4 photos so buyers can see what you have.",
  title_required: "Give your listing a title.",
  location_required: "Set your location in your profile first, so buyers can see how far you are.",
  db_error: "", // message comes from the API
};

/** What's wrong with a step, in plain words, or null when it can move on. Steps count from 1. */
function stepProblem(step: number, draft: SellDraft): string | null {
  if (step === 1) {
    if (!draft.title.trim()) return "Give your listing a title.";
    if (!draft.commodity) return "Choose what you're selling.";
    return null;
  }
  if (step === 2) {
    if (nairaToKobo(draft.price) === null || nairaToKobo(draft.price) === 0) return "Enter the price in naira, like 3500.";
    const qty = Number(draft.qty);
    if (!Number.isFinite(qty) || qty <= 0) return "Enter how many you have.";
    return null;
  }
  if (step === 3) {
    if (draft.images.length < 1) return "Add at least 1 photo so buyers can see what you have.";
    return null;
  }
  return null;
}

const unitFor = (name: SellDraft["commodity"]) =>
  SELL_COMMODITIES.find((item) => item.name === name)?.unit ?? "unit";

/** The check sits against its label and slides open, so the two stay centred together as one. */
function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-12 items-center justify-center rounded-full border px-4 text-[15px] font-medium transition-[background-color,border-color,color,transform] duration-200 ease-out [-webkit-tap-highlight-color:transparent] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 sm:px-5 sm:text-base",
        selected ? "border-field bg-field text-paper" : "border-line bg-white text-ink hover:border-sage",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex shrink-0 justify-center overflow-hidden text-[#9BD27A] transition-[width,margin,opacity] duration-200 ease-out motion-reduce:transition-none",
          selected ? "mr-1.5 w-4 opacity-100" : "mr-0 w-0 opacity-0",
        )}
      >
        <Check strokeWidth={3} className="size-4 shrink-0" />
      </span>
      {children}
    </button>
  );
}

function Review({ label, value, onEdit }: { label: string; value: React.ReactNode; onEdit: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <dt className="text-body-sm text-ink-muted">{label}</dt>
        <dd className="mt-0.5 break-words text-ink">{value}</dd>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Change ${label.toLowerCase()}`}
        className="min-h-12 shrink-0 text-body-sm text-ink-muted underline underline-offset-4 hover:text-ink md:min-h-0"
      >
        Change
      </button>
    </div>
  );
}

export function SellForm() {
  const router = useRouter();
  const { user } = useAuthUser();
  const panel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const direction = useRef(1);
  const moved = useRef(false);
  const leaving = useRef(false);
  const entrance = useRef<gsap.core.Timeline | null>(null);
  const previousHeight = useRef<number | null>(null);
  const progress = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<SellDraft>(START);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const unit = unitFor(draft.commodity);

  const change = (values: Partial<SellDraft>) => {
    setDraft((current) => ({ ...current, ...values }));
    setError(null);
  };
  const input = (name: keyof SellDraft) => ({
    value: draft[name] as string,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      change({ [name]: event.target.value } as Partial<SellDraft>),
  });

  async function handleImageUpload(files: FileList | null) {
    if (!files || !user) return;
    const remaining = 4 - draft.images.length;
    const toUpload = Array.from(files).slice(0, remaining);
    if (toUpload.length === 0) return;
    setUploading(true);
    const newImages: string[] = [];
    for (const file of toUpload) {
      const formData = new FormData();
      formData.append("photo", file);
      const token = await user.getIdToken();
      const res = await fetch("/api/uploads/listing-image?bucket=farmer-listing-images", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const result = await res.json();
      if (result.ok && result.url) newImages.push(result.url);
    }
    if (newImages.length > 0) {
      change({ images: [...draft.images, ...newImages] });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeImage(idx: number) {
    change({ images: draft.images.filter((_, i) => i !== idx) });
  }

  /** What moves between steps: the heading, the line under it, and each field in turn. */
  const stepParts = () => {
    const root = panel.current;
    if (!root) return { lead: null, fields: [] as Element[] };
    return { lead: root.querySelector("[data-step-lead]"), fields: Array.from(root.querySelectorAll("[data-step-fields] > *")) };
  };

  // Plays each step in: on arrival, as the wipe lifts, and after every move.
  useGSAP(
    () => {
      const root = panel.current;
      const title = heading.current;
      if (!root || !title) return;
      const { lead, fields } = stepParts();
      // Also runs when a kept-alive form comes back into view, which is another arrival if a wipe is up.
      const covered = wipeAway();
      const arriving = covered || !moved.current;

      if (isReducedMotion()) {
        if (!arriving) gsap.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.15 });
        return;
      }

      // With the wipe, everything comes up with it. Otherwise it comes in from the side you're heading.
      const delay = covered ? 0.42 : arriving ? 0.05 : 0;
      const from = arriving ? { y: 44 } : { x: 64 * direction.current };
      const timeline = gsap.timeline();
      entrance.current = timeline;
      if (arriving) timeline.fromTo(progress.current, { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: "expo.out", transformOrigin: "left" }, delay);
      if (previousHeight.current !== null) {
        timeline.fromTo(
          root,
          { height: previousHeight.current, overflow: "hidden" },
          { height: "auto", duration: 0.55, ease: "expo.out", clearProps: "height,overflow" },
          0,
        );
        previousHeight.current = null;
      }
      timeline
        .fromTo(title.firstElementChild, { yPercent: 115, x: 0, opacity: 1 }, { yPercent: 0, duration: 0.75, ease: "expo.out", clearProps: "transform,opacity" }, delay)
        .fromTo(lead, { opacity: 0, x: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", clearProps: "transform,opacity" }, delay + 0.1)
        .fromTo(
          fields,
          { opacity: 0, ...from },
          { opacity: 1, x: 0, y: 0, duration: 0.7, ease: "expo.out", stagger: 0.06, clearProps: "transform,opacity" },
          delay + 0.08,
        );
    },
    { dependencies: [step], revertOnUpdate: false },
  );

  // A new step is a new page to someone using a screen reader.
  // It also starts at the top, wherever the last one was scrolled to.
  useEffect(() => {
    if (!moved.current) return;
    heading.current?.focus({ preventScroll: true });
    heading.current?.closest("[data-scroll-root]")?.scrollTo({ top: 0 });
  }, [step]);

  // The step leaves first, so the new one has somewhere to land. Taps during that are ignored.
  function goTo(next: number) {
    if (leaving.current) return;
    entrance.current?.kill();
    moved.current = true;
    direction.current = next > step ? 1 : -1;
    setError(null);

    const swap = () => {
      leaving.current = false;
      previousHeight.current = panel.current?.offsetHeight ?? null;
      setStep(next);
    };
    if (isReducedMotion()) {
      swap();
      return;
    }
    leaving.current = true;
    const { lead, fields } = stepParts();
    gsap
      .timeline({ onComplete: swap })
      .to(heading.current?.firstElementChild ?? null, { opacity: 0, x: -36 * direction.current, duration: 0.2, ease: "power3.in" }, 0)
      .to(lead, { opacity: 0, x: -36 * direction.current, duration: 0.2, ease: "power3.in" }, 0.02)
      .to(fields, { opacity: 0, x: -48 * direction.current, duration: 0.2, ease: "power3.in", stagger: 0.015 }, 0.02);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = stepProblem(step, draft);
    if (problem) {
      setError(problem);
      return;
    }
    if (step < SELL_STEPS) {
      goTo(step + 1);
      return;
    }
    if (!user) {
      setError("Sign in to post your supply.");
      return;
    }
    setSaving(true);
    setError(null);
    const response = await apiFetch(user, "/api/supply-listings", {
      title: draft.title.trim(),
      description: draft.description.trim(),
      commodity: draft.commodity,
      unitPriceKobo: nairaToKobo(draft.price),
      qty: Number(draft.qty),
      unit,
      images: draft.images,
    }).catch(() => null);
    const result = (await response?.json().catch(() => null)) as { ok?: boolean; code?: string; message?: string } | null;
    setSaving(false);
    if (result?.ok) {
      router.push("/dashboard/marketplace");
      return;
    }
    setError(FAILURES[result?.code ?? ""] || result?.message || "That didn't save. Please try again.");
  }

  const copy = STEPS[step - 1];

  return (
    <div className="mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-[640px] flex-col px-4 pt-5 sm:block sm:min-h-0 sm:py-6 md:px-6 md:py-10">
      {/* On phones the page is the surface. A card inside it would only take width away. */}
      <form onSubmit={submit} noValidate className="flex flex-1 flex-col sm:block sm:rounded-[28px] sm:border sm:border-line sm:bg-white sm:p-8">
        <p className="text-body-sm text-ink-muted">
          Sell produce · Step <span className="font-num">{step}/{SELL_STEPS}</span>
        </p>
        <div
          role="progressbar"
          aria-label="Progress"
          aria-valuemin={1}
          aria-valuemax={SELL_STEPS}
          aria-valuenow={step}
          className="mt-3 h-1 overflow-hidden rounded-full bg-line"
        >
          <div ref={progress} className="h-full rounded-full bg-green transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none" style={{ width: `${(step / SELL_STEPS) * 100}%` }} />
        </div>

        {/* Reaches the edge of the screen or card, so fields slide off it rather than vanish inside it. */}
        <div ref={panel} className="-mx-4 overflow-x-clip px-4 pb-6 sm:-mx-8 sm:px-8 sm:pb-0">
          {/* The overflow is the mask the title rises out of. The padding keeps its descenders inside it. */}
          <h1 ref={heading} tabIndex={-1} className="mt-5 -mb-1 overflow-hidden pb-1 font-display text-[26px] leading-[1.2] font-medium text-ink outline-none sm:mt-6 sm:text-[32px]">
            <span className="block">{copy.title}</span>
          </h1>
          <p data-step-lead className="mt-1.5 text-body-sm text-ink-muted sm:mt-2 sm:text-base">{copy.lead}</p>

          <div data-step-fields key={step} className="mt-6 space-y-5 sm:mt-7 sm:space-y-6">
            {step === 1 && (
              <>
                <label className={LABEL}>
                  Title
                  <input {...input("title")} placeholder="e.g. Fresh live broilers from Bukuru" className={FIELD} />
                </label>
                <label className={LABEL}>
                  Description <span className="font-normal text-ink-muted">(optional)</span>
                  <textarea
                    {...input("description")}
                    rows={3}
                    placeholder="Healthy birds, raised free-range, ready this week."
                    className={cn(FIELD, "h-auto min-h-[88px] resize-y py-3 sm:h-auto")}
                  />
                </label>
                <fieldset>
                  <legend className={LABEL}>What are you selling?</legend>
                  <div className={CHIPS}>
                    {SELL_COMMODITIES.map((item) => (
                      <Chip key={item.name} selected={draft.commodity === item.name} onClick={() => change({ commodity: item.name })}>
                        {item.name}
                      </Chip>
                    ))}
                  </div>
                  <p className={HINT}>The unit is set from what you choose: {unit}.</p>
                </fieldset>
              </>
            )}

            {step === 2 && (
              <>
                <label className={LABEL}>
                  Price per {unit}
                  <span className="relative block">
                    <span aria-hidden="true" className="absolute top-1/2 left-4 mt-1 -translate-y-1/2 text-ink-muted">₦</span>
                    <input {...input("price")} inputMode="decimal" placeholder="3500" className={cn(FIELD, "font-num pl-9")} />
                  </span>
                </label>
                <label className={LABEL}>
                  How many {unit}s?
                  <input {...input("qty")} inputMode="numeric" placeholder="30" className={cn(FIELD, "font-num")} />
                </label>
                <p aria-live="polite" className="rounded-2xl bg-sage-soft px-4 py-3 text-body-sm text-ink">
                  {nairaToKobo(draft.price) !== null && Number(draft.qty) > 0 ? (
                    <>
                      Buyers see <span className="font-num font-medium">{money(nairaToKobo(draft.price) ?? 0)}</span> per {unit}. Total value{" "}
                      <span className="font-num font-medium">{money((nairaToKobo(draft.price) ?? 0) * Number(draft.qty))}</span>.
                    </>
                  ) : (
                    <>Enter a price and quantity to see the total value.</>
                  )}
                </p>
              </>
            )}

            {step === 3 && (
              <>
                <fieldset>
                  <legend className={LABEL}>Photos <span className="font-normal text-ink-muted">(1–4 required)</span></legend>
                  <div className="mt-2 grid grid-cols-4 gap-2.5">
                    {draft.images.map((url, idx) => (
                      <div key={idx} className="group relative aspect-square overflow-hidden rounded-2xl border border-line bg-paper">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Upload ${idx + 1}`} className="size-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-field/80 text-paper opacity-0 transition-opacity group-hover:opacity-100"
                          aria-label={`Remove photo ${idx + 1}`}
                        >
                          <X strokeWidth={2} className="size-3.5" />
                        </button>
                      </div>
                    ))}
                    {draft.images.length < 4 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex aspect-square items-center justify-center rounded-2xl border-2 border-dashed border-line bg-paper text-ink-muted transition-colors hover:border-green hover:text-green disabled:opacity-50"
                      >
                        {uploading ? (
                          <span className="text-xs">Uploading…</span>
                        ) : (
                          <ImagePlus strokeWidth={1.5} className="size-6" />
                        )}
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={(e) => handleImageUpload(e.target.files)}
                  />
                  <span className={HINT}>Add 1 to 4 photos so buyers can see what you have.</span>
                </fieldset>
                <dl className="divide-y divide-line rounded-2xl border border-line bg-white px-4">
                  <Review label="Title" value={draft.title} onEdit={() => goTo(1)} />
                  <Review label="What" value={draft.commodity} onEdit={() => goTo(1)} />
                  <Review
                    label="Price"
                    value={<><span className="font-num">{money(nairaToKobo(draft.price) ?? 0)}</span> per {unit}</>}
                    onEdit={() => goTo(2)}
                  />
                  <Review
                    label="Quantity"
                    value={<><span className="font-num">{draft.qty}</span> {unit}{Number(draft.qty) !== 1 ? "s" : ""}</>}
                    onEdit={() => goTo(2)}
                  />
                </dl>
              </>
            )}
          </div>
        </div>

        {/* Always in reach on a phone, and so is any message about why Next didn't move on. */}
        <div className="sticky bottom-0 z-10 -mx-4 mt-auto border-t border-line bg-paper px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:mt-0 sm:border-0 sm:bg-transparent sm:p-0">
          {error && (
            <p role="alert" className="mb-3 text-body-sm text-danger sm:mt-5 sm:mb-0">
              {error}
            </p>
          )}
          <div className="flex gap-3 sm:mt-8 sm:justify-end">
            {step > 1 && (
              <button
                type="button"
                onClick={() => goTo(step - 1)}
                className="h-[52px] rounded-2xl bg-sage-soft px-6 font-medium text-ink transition-[background-color,transform] duration-150 [-webkit-tap-highlight-color:transparent] hover:bg-line focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.98] motion-reduce:active:scale-100 sm:h-14 sm:px-7"
              >
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="h-[52px] flex-1 rounded-2xl bg-green px-8 font-medium text-paper transition-[background-color,transform] duration-150 [-webkit-tap-highlight-color:transparent] hover:bg-green-hover focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.98] disabled:opacity-60 motion-reduce:active:scale-100 sm:h-14 sm:flex-none"
            >
              {step === SELL_STEPS ? (saving ? "Posting…" : "Post listing") : "Next"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
