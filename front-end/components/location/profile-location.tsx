"use client";

import { useEffect, useState } from "react";

import { useAuthUser } from "@/components/auth/use-auth-user";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/logistics/client";

import { LocationPicker, locationBody, type PickedLocation } from "./location-picker";

/** Lets someone update their location from their profile, with the same controls as onboarding. */
export function ProfileLocation() {
  const { user } = useAuthUser();
  const [area, setArea] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    apiFetch(user, "/api/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((profile: { area?: string | null } | null) => {
        if (!cancelled) setArea(profile?.area ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function save(location: PickedLocation) {
    if (!user) return;
    setSaving(true);
    setError(null);
    const response = await apiFetch(user, "/api/me/location", locationBody(location)).catch(() => null);
    setSaving(false);
    if (response?.ok) {
      setArea(location.area);
      setEditing(false);
    } else {
      setError("That didn't save. Please try again.");
    }
  }

  return (
    <div>
      <p className="mb-1.5 block text-body-sm font-medium text-ink">Your location</p>
      {editing ? (
        <>
          <LocationPicker onPick={save} disabled={saving} />
          {error && (
            <p role="alert" className="mt-3 text-body-sm text-danger">
              {error}
            </p>
          )}
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-ink">{area ? `Near ${area}` : "Not set yet"}</p>
          <Button type="button" variant="outline" className="h-12 md:h-10" onClick={() => setEditing(true)}>
            {area ? "Change" : "Set location"}
          </Button>
        </div>
      )}
      <p className="mt-2 text-body-sm text-ink-muted">Others only see your area until you have a booking together.</p>
    </div>
  );
}
