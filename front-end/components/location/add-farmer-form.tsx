"use client";

import { useState } from "react";

import { useAuthUser } from "@/components/auth/use-auth-user";
import { apiFetch } from "@/lib/logistics/client";

import { LocationPicker, locationBody, type PickedLocation } from "./location-picker";

const FIELD =
  "mt-1.5 h-12 w-full rounded-md border border-line bg-white px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/** For an agent standing at the farm, so the location comes from their phone. */
export function AddFarmerForm() {
  const { user } = useAuthUser();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function save(location: PickedLocation) {
    if (!user) return;
    if (!name.trim() || !phone.trim()) {
      setResult({ ok: false, message: "Add the farmer's name and phone number first." });
      return;
    }
    setSaving(true);
    setResult(null);
    const response = await apiFetch(user, "/api/agent/farmers", { name, phone, ...locationBody(location) }).catch(() => null);
    const body = (await response?.json().catch(() => null)) as { ok?: boolean; code?: string } | null;
    setSaving(false);
    if (body?.ok) {
      setResult({ ok: true, message: `${name} is on Lumora, near ${location.area}.` });
      setName("");
      setPhone("");
      return;
    }
    setResult({
      ok: false,
      message:
        response?.status === 403
          ? "You need an agent account to add farmers."
          : body?.code === "phone_in_use"
            ? "That phone number already has an account."
            : "That didn't save. Please try again.",
    });
  }

  return (
    <div className="mx-auto w-full max-w-[28rem] px-4 py-8">
      <h1 className="text-title font-semibold text-ink">Add a farmer</h1>
      <p className="mt-1 text-ink-muted">Stand at the farm, then tap Use my location.</p>
      <label className="mt-5 block text-body-sm font-medium text-ink">
        Farmer&apos;s name
        <input value={name} onChange={(event) => setName(event.target.value)} className={FIELD} />
      </label>
      <label className="mt-5 mb-6 block text-body-sm font-medium text-ink">
        Farmer&apos;s phone number
        <input value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" inputMode="tel" className={`${FIELD} font-num`} />
      </label>
      <LocationPicker key={result?.ok ? name : "form"} onPick={save} disabled={saving} />
      {result && (
        <p role={result.ok ? "status" : "alert"} className={`mt-4 ${result.ok ? "font-medium text-green" : "text-body-sm text-danger"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
