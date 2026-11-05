"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuthUser } from "@/components/auth/use-auth-user";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/logistics/client";
import { cn } from "@/lib/utils";

import { LocationPicker, locationBody, type PickedLocation } from "./location-picker";

type Profile = { role: string; area: string | null } | null;
type Step = "loading" | "details" | "location";

const FIELD =
  "mt-1.5 h-12 w-full rounded-md border border-line bg-white px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const ROLE_BUTTON =
  "min-h-12 rounded-md border px-3 py-2 text-base font-medium transition-colors duration-200 ease-out focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

/** Name, phone and role, then location. Nothing here can stop someone reaching the dashboard. */
export function OnboardingFlow() {
  const router = useRouter();
  const { user, loading } = useAuthUser();
  const [step, setStep] = useState<Step>("loading");
  const [role, setRole] = useState<"farmer" | "buyer">("farmer");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    let cancelled = false;
    apiFetch(user, "/api/me")
      .then(async (response) => {
        // If our API can't answer, carry on rather than trap someone here.
        if (!response.ok) throw new Error("Unavailable");
        const profile = (await response.json()) as Profile;
        if (cancelled) return;
        if (profile?.area) {
          router.replace("/dashboard");
          return;
        }
        if (profile) setRole(profile.role === "buyer" ? "buyer" : "farmer");
        setName((current) => current || user.displayName || "");
        setStep(profile ? "location" : "details");
      })
      .catch(() => {
        if (!cancelled) router.replace("/dashboard");
      });
    return () => {
      cancelled = true;
    };
  }, [loading, user, router]);

  async function saveDetails(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    const response = await apiFetch(user, "/api/me", { name, phone, role }).catch(() => null);
    setSaving(false);
    if (response?.ok) {
      setStep("location");
      return;
    }
    const result = (await response?.json().catch(() => null)) as { code?: string } | null;
    setError(
      result?.code === "phone_in_use"
        ? "That phone number already has an account."
        : "Please check your name and phone number.",
    );
  }

  async function saveLocation(location: PickedLocation) {
    if (!user) return;
    setSaving(true);
    await apiFetch(user, "/api/me/location", locationBody(location)).catch(() => null);
    // Location can be set later from the profile, so a failed save doesn't hold anyone up.
    router.replace("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-[28rem] flex-col justify-center px-4 py-10">
      {step === "loading" && <p className="text-ink-muted">One moment…</p>}

      {step === "details" && (
        <form onSubmit={saveDetails}>
          <h1 className="text-[1.75rem] leading-9 font-semibold text-ink">Tell us about you</h1>
          <fieldset className="mt-6">
            <legend className="text-body-sm font-medium text-ink">Are you selling or buying?</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-3">
              {(["farmer", "buyer"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={role === option}
                  onClick={() => setRole(option)}
                  className={cn(ROLE_BUTTON, role === option ? "border-green bg-green text-paper" : "border-line bg-white text-ink")}
                >
                  {option === "farmer" ? "I'm a farmer" : "I'm a buyer"}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="mt-5 block text-body-sm font-medium text-ink">
            Your name
            <input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className={FIELD} />
          </label>
          <label className="mt-5 block text-body-sm font-medium text-ink">
            Phone number
            <input
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0803 000 0000"
              className={cn(FIELD, "font-num")}
            />
          </label>
          {error && (
            <p role="alert" className="mt-3 text-body-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="mt-6 h-12 w-full text-base" disabled={saving}>
            Continue
          </Button>
        </form>
      )}

      {step === "location" && (
        <>
          <h1 className="mb-6 text-[1.75rem] leading-9 font-semibold text-ink">
            {role === "buyer" ? "Where should farmers deliver?" : "Where is your farm?"}
          </h1>
          <LocationPicker onPick={saveLocation} disabled={saving} />
          <Link
            href="/dashboard"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-md text-ink-muted underline-offset-4 hover:underline"
          >
            Skip for now
          </Link>
        </>
      )}
    </main>
  );
}
