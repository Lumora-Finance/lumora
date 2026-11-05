"use client";

import { useEffect, useState } from "react";

import { useAuthUser } from "@/components/auth/use-auth-user";
import { apiFetch } from "@/lib/logistics/client";
import { reliabilityWords } from "@/lib/money/booking-view";

/** A farmer's delivery record, for their profile. Hidden for buyers. */
export function ProfileReliability() {
  const { user } = useAuthUser();
  const [words, setWords] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    apiFetch(user, "/api/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((profile: { role?: string; reliability?: { on_time: number; total: number } } | null) => {
        if (!cancelled && profile?.role === "farmer" && profile.reliability) setWords(reliabilityWords(profile.reliability));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!words) return null;
  return (
    <p className="text-body-sm text-ink">
      <span className="text-ink-muted">Your delivery record: </span>
      {words}
    </p>
  );
}
