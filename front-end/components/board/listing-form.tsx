"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuthUser } from "@/components/auth/use-auth-user";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/logistics/client";
import { nairaToKobo } from "@/lib/money/rules";
import { cn } from "@/lib/utils";

/** Mirrors the commodities seed, for showing rules before submitting. The database enforces them. */
const COMMODITIES = [
  { name: "Live broilers", unit: "kg", latest: "11:00", crate: 10 },
  { name: "Turkey", unit: "kg", latest: "11:00", crate: 10 },
  { name: "Tomatoes", unit: "basket", latest: null, crate: null },
  { name: "Eggs", unit: "crate", latest: null, crate: null },
] as const;

const MODES = [
  { value: "farmer_delivers", label: "Farmer delivers", detail: "Farmers bring it to your address, and you weigh it there." },
  { value: "buyer_collects", label: "I collect", detail: "You go to the farm on the day and time you set here." },
] as const;

const FIELD =
  "mt-1.5 h-12 w-full rounded-md border border-line bg-white px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-10";
const LABEL = "block text-body-sm font-medium text-ink";

const FAILURES: Record<string, string> = {
  location_required: "Set your location in your profile first, so farmers can see how far you are.",
  not_a_buyer: "Only buyer accounts can post demand.",
  address_required: "Add the delivery address.",
  invalid_window: "The window has to end after it starts.",
  invalid_weights: "The maximum weight can't be less than the minimum.",
  invalid_numbers: "Check the price and quantities.",
  too_soon: "That day is too soon. It has to be after the booking cut-off.",
};

export function ListingForm() {
  const router = useRouter();
  const { user } = useAuthUser();
  const [commodity, setCommodity] = useState<(typeof COMMODITIES)[number]["name"]>("Live broilers");
  const [mode, setMode] = useState<(typeof MODES)[number]["value"]>("farmer_delivers");
  const [windowEnd, setWindowEnd] = useState("11:00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rules = COMMODITIES.find((item) => item.name === commodity) ?? COMMODITIES[0];
  const tooLate = rules.latest !== null && windowEnd > rules.latest;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || tooLate) return;
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "");
    const unitPriceKobo = nairaToKobo(text("price"));
    if (unitPriceKobo === null) {
      setError("Check the price.");
      return;
    }
    setSaving(true);
    setError(null);
    const response = await apiFetch(user, "/api/listings", {
      commodity,
      unitPriceKobo,
      capacity: Number(text("capacity")),
      minQty: Number(text("minQty")),
      minWeight: Number(text("minWeight")),
      maxWeight: Number(text("maxWeight")),
      mode,
      date: text("date"),
      windowStart: text("windowStart"),
      windowEnd,
      address: mode === "farmer_delivers" ? text("address") : null,
      spec: text("spec"),
    }).catch(() => null);
    const result = (await response?.json().catch(() => null)) as { ok?: boolean; code?: string; latest?: string } | null;
    setSaving(false);
    if (result?.ok) {
      router.push("/dashboard/board");
      return;
    }
    setError(
      result?.code === "window_too_late"
        ? `${commodity} must be delivered by ${result.latest}.`
        : (FAILURES[result?.code ?? ""] ?? "That didn't save. Please try again."),
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-[640px] space-y-5 px-4 py-8 md:px-6">
      <h1 className="text-title font-semibold text-ink">Post demand</h1>

      <label className={LABEL}>
        What do you need?
        <select value={commodity} onChange={(event) => setCommodity(event.target.value as typeof commodity)} className={FIELD}>
          {COMMODITIES.map((item) => (
            <option key={item.name}>{item.name}</option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className={LABEL}>How does it reach you?</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-lg border border-line bg-white p-1">
          {MODES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={mode === option.value}
              onClick={() => setMode(option.value)}
              className={cn(
                "min-h-12 rounded-md text-base font-medium transition-colors duration-200 ease-out focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                mode === option.value ? "bg-green text-paper" : "text-ink hover:bg-sage-soft",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-body-sm text-ink-muted">{MODES.find((option) => option.value === mode)?.detail}</p>
      </fieldset>

      {mode === "farmer_delivers" && (
        <label className={LABEL}>
          Delivery address
          <input name="address" required className={FIELD} />
          <span className="mt-1 block font-normal text-ink-muted">Farmers only see this after they book.</span>
        </label>
      )}

      <div className="grid gap-5 sm:grid-cols-3">
        <label className={LABEL}>
          {mode === "buyer_collects" ? "Collection day" : "Delivery day"}
          <input name="date" type="date" required className={cn(FIELD, "font-num")} />
        </label>
        <label className={LABEL}>
          From
          <input name="windowStart" type="time" required defaultValue="07:00" className={cn(FIELD, "font-num")} />
        </label>
        <label className={LABEL}>
          Until
          <input
            name="windowEnd"
            type="time"
            required
            value={windowEnd}
            onChange={(event) => setWindowEnd(event.target.value)}
            aria-invalid={tooLate}
            className={cn(FIELD, "font-num")}
          />
        </label>
      </div>
      {tooLate && (
        <p role="alert" className="text-body-sm text-danger">
          {commodity} must be delivered by {rules.latest}.
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-3">
        <label className={LABEL}>
          Price per {rules.unit} (₦)
          <input name="price" inputMode="decimal" required className={cn(FIELD, "font-num")} />
        </label>
        <label className={LABEL}>
          How many?
          <input name="capacity" type="number" min={1} required className={cn(FIELD, "font-num")} />
        </label>
        <label className={LABEL}>
          Smallest order
          <input name="minQty" type="number" min={1} required defaultValue={1} className={cn(FIELD, "font-num")} />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className={LABEL}>
          Smallest weight each (kg)
          <input name="minWeight" type="number" step="0.001" min="0.001" required className={cn(FIELD, "font-num")} />
        </label>
        <label className={LABEL}>
          Largest weight each (kg)
          <input name="maxWeight" type="number" step="0.001" min="0.001" required className={cn(FIELD, "font-num")} />
        </label>
      </div>
      <p className="-mt-3 text-body-sm text-ink-muted">
        {rules.unit === "kg"
          ? "We hold enough of your balance for the largest weight."
          : `For ${rules.unit}s, enter 1 for both, and record each ${rules.unit} as 1.`}
      </p>

      <label className={LABEL}>
        Spec
        <input name="spec" placeholder="Healthy, no visible injuries" className={FIELD} />
        {rules.crate && <span className="mt-1 block font-normal text-ink-muted">We&apos;ll add: Up to {rules.crate} per crate.</span>}
      </label>

      {error && (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={saving || tooLate}>
        Post demand
      </Button>
    </form>
  );
}
