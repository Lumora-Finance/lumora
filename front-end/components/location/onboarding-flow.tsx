"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuthUser } from "@/components/auth/use-auth-user";
import { OnboardingView, type OnboardingRole, type OnboardingStep } from "@/components/onboarding/onboarding-view";
import { apiFetch } from "@/lib/logistics/client";

import { locationBody, type PickedLocation } from "./location-picker";

type Profile = { role: string; name: string; area: string | null } | null;

/** Sign-in and saving for the onboarding screens. Nothing here can stop someone reaching the dashboard. */
export function OnboardingFlow() {
  const router = useRouter();
  const { user, loading } = useAuthUser();
  const [start, setStart] = useState<{ step: OnboardingStep; role: OnboardingRole; name: string } | null>(null);

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
        setStart({
          step: profile ? "location" : "role",
          role: profile?.role === "buyer" ? "buyer" : "farmer",
          name: profile?.name ?? user.displayName ?? "",
        });
      })
      .catch(() => {
        if (!cancelled) router.replace("/dashboard");
      });
    return () => {
      cancelled = true;
    };
  }, [loading, user, router]);

  if (!start || !user) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-paper">
        <p className="text-ink-muted">One moment…</p>
      </main>
    );
  }

  async function saveDetails(details: { role: OnboardingRole; name: string; phone: string }) {
    if (!user) return "Please sign in again.";
    const response = await apiFetch(user, "/api/me", details).catch(() => null);
    if (response?.ok) return null;
    const result = (await response?.json().catch(() => null)) as { code?: string } | null;
    if (result?.code === "phone_in_use") return "That phone number already has an account.";
    if (result?.code === "invalid_details") return "Please check your name and phone number.";
    return "That didn't save. Please try again.";
  }

  async function saveLocation(location: PickedLocation) {
    if (!user) return;
    // Location can be set later from the profile, so a failed save doesn't hold anyone up.
    await apiFetch(user, "/api/me/location", locationBody(location)).catch(() => null);
  }

  return (
    <OnboardingView
      initialStep={start.step}
      initialRole={start.role}
      initialName={start.name}
      onSaveDetails={saveDetails}
      onSaveLocation={saveLocation}
      onFinish={() => router.replace("/dashboard")}
    />
  );
}
