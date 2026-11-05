"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuthUser } from "@/components/auth/use-auth-user";
import { BusyBar } from "@/components/loader/busy-bar";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/logistics/client";
import { DECLINE_REASONS, declineProblem, type DeclinedUnit } from "@/lib/logistics/decline";

const FIELD =
  "mt-1.5 h-12 w-full rounded-md border border-line bg-white px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const LABEL = "block text-body-sm font-medium text-ink";

export async function uploadPhoto(user: NonNullable<ReturnType<typeof useAuthUser>["user"]>, file: File) {
  const data = new FormData();
  data.set("photo", file);
  const token = await user.getIdToken();
  const response = await fetch("/api/uploads/delivery-photo", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: data,
  });
  const result = (await response.json().catch(() => null)) as { url?: string } | null;
  return result?.url ?? null;
}

/** Declined units are left out of the weight, so they're never paid for. */
export function DeliveryForm({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const { user } = useAuthUser();
  const [received, setReceived] = useState("");
  const [measured, setMeasured] = useState("");
  const [declined, setDeclined] = useState<DeclinedUnit[]>([]);
  const [scalePhotos, setScalePhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateUnit = (index: number, change: Partial<DeclinedUnit>) =>
    setDeclined((units) => units.map((unit, at) => (at === index ? { ...unit, ...change } : unit)));

  async function addPhoto(file: File | undefined, done: (url: string) => void) {
    if (!file || !user) return;
    setBusy(true);
    setError(null);
    const url = await uploadPhoto(user, file).catch(() => null);
    setBusy(false);
    if (url) done(url);
    else setError("That photo didn't upload. Please try again.");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    const problem = declined.map(declineProblem).findIndex(Boolean);
    if (problem !== -1) {
      setError(`Declined unit ${problem + 1}: ${declineProblem(declined[problem])}`);
      return;
    }
    if (scalePhotos.length === 0) {
      setError("Add at least one photo of the scale.");
      return;
    }
    setBusy(true);
    setError(null);
    const response = await apiFetch(user, `/api/bookings/${bookingId}/record`, {
      unitsReceived: Number(received),
      declined,
      measuredKg: Number(measured),
      scalePhotos,
    }).catch(() => null);
    const result = (await response?.json().catch(() => null)) as { ok?: boolean; code?: string } | null;
    setBusy(false);
    if (result?.ok) {
      router.push(`/dashboard/bookings/${bookingId}`);
      return;
    }
    setError(
      result?.code === "record_deadline_passed"
        ? "The time to record this delivery has passed."
        : "That didn't save. Check the numbers and try again.",
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-[640px] space-y-5 px-4 py-8 md:px-6">
      <h1 className="text-title font-semibold text-ink">Record delivery</h1>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className={LABEL}>
          Units accepted
          <input type="number" min={0} required value={received} onChange={(event) => setReceived(event.target.value)} className={`${FIELD} font-num`} />
        </label>
        <label className={LABEL}>
          Total kg of accepted units
          <input type="number" min={0} step="0.001" required value={measured} onChange={(event) => setMeasured(event.target.value)} className={`${FIELD} font-num`} />
        </label>
      </div>
      <p className="-mt-3 text-body-sm text-ink-muted">Don&apos;t weigh declined units with these. They aren&apos;t paid for.</p>

      <label className={LABEL}>
        Photo of the scale
        <input
          type="file"
          accept="image/*"
          capture="environment"
          disabled={busy}
          onChange={(event) => addPhoto(event.target.files?.[0], (url) => setScalePhotos((photos) => [...photos, url]))}
          className="mt-1.5 block min-h-12 w-full py-2 text-base"
        />
        {scalePhotos.length > 0 && <span className="font-num font-normal text-ink-muted">{scalePhotos.length} added</span>}
      </label>

      <fieldset className="space-y-4">
        <legend className={LABEL}>Declined units</legend>
        {declined.map((unit, index) => {
          const reason = DECLINE_REASONS.find((item) => item.value === unit.reason);
          return (
            <div key={index} className="rounded-lg border border-line bg-white p-4">
              <label className={LABEL}>
                Reason for unit <span className="font-num">{index + 1}</span>
                <select
                  required
                  value={unit.reason}
                  onChange={(event) => updateUnit(index, { reason: event.target.value as DeclinedUnit["reason"] })}
                  className={FIELD}
                >
                  <option value="">Choose a reason</option>
                  {DECLINE_REASONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              {unit.reason === "other" && (
                <label className={`${LABEL} mt-3`}>
                  Note
                  <input required value={unit.note ?? ""} onChange={(event) => updateUnit(index, { note: event.target.value })} className={FIELD} />
                </label>
              )}
              {reason?.photo && (
                <label className={`${LABEL} mt-3`}>
                  Photo (required)
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={busy}
                    onChange={(event) => addPhoto(event.target.files?.[0], (url) => updateUnit(index, { photo_url: url }))}
                    className="mt-1.5 block min-h-12 w-full py-2 text-base"
                  />
                  {unit.photo_url && <span className="font-normal text-ink-muted">Added</span>}
                </label>
              )}
              <Button
                type="button"
                variant="ghost"
                className="mt-2 h-12"
                onClick={() => setDeclined((units) => units.filter((_, at) => at !== index))}
              >
                Remove
              </Button>
            </div>
          );
        })}
        <Button type="button" variant="outline" className="h-12 w-full" onClick={() => setDeclined((units) => [...units, { reason: "" }])}>
          Decline a unit
        </Button>
      </fieldset>

      {error && (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" aria-busy={busy} className="relative h-12 w-full overflow-hidden text-base" disabled={busy}>
        <BusyBar active={busy} />
        Save delivery
      </Button>
    </form>
  );
}
