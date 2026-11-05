"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuthUser } from "@/components/auth/use-auth-user";
import { RowsSkeleton } from "@/components/loader/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatKobo, nairaToKobo } from "@/lib/money/rules";

type Dispute = {
  id: string;
  deadline_at: string;
  undisputed_kobo: number;
  disputed_kobo: number;
  minimum_kobo: number;
  evidence: { claim_kg?: number | null };
  booking: { code: string; qty: number; unit_price_kobo: number; reserve_kobo: number };
  farmer: { name: string; phone: string };
  buyer: { name: string; phone: string };
  delivery: {
    measured_kg: number;
    units_received: number;
    units_declined: number;
    decline_reasons: { reason?: string; photo_url?: string }[];
    scale_photo_urls: string[];
  };
  messages: { from: string; body: string; at: string }[];
};

const FAILURES: Record<string, string> = {
  custom_out_of_range: "The custom amount must be between the undisputed amount and the reserve.",
  above_amount_held: "That's more than is still held. The rest of the reserve has gone back to the buyer.",
};

const timeLeft = (deadline: string) => {
  const hours = Math.round((new Date(deadline).getTime() - Date.now()) / 3_600_000);
  return hours <= 0 ? "Past deadline" : `${hours}h left`;
};

function Evidence({ dispute }: { dispute: Dispute }) {
  const declinePhotos = dispute.delivery.decline_reasons.filter((item) => item.photo_url);
  return (
    <>
      {[...dispute.delivery.scale_photo_urls, ...declinePhotos.map((item) => item.photo_url as string)].length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {dispute.delivery.scale_photo_urls.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="rounded-md border border-line px-3 py-2 text-body-sm underline">
              Scale photo
            </a>
          ))}
          {declinePhotos.map((item) => (
            <a key={item.photo_url} href={item.photo_url} target="_blank" rel="noreferrer" className="rounded-md border border-line px-3 py-2 text-body-sm underline">
              Decline photo: {item.reason ?? "no reason given"}
            </a>
          ))}
        </div>
      )}
      {dispute.messages.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-line pt-3 text-body-sm">
          {dispute.messages.map((message) => (
            <li key={`${message.at}${message.body}`}>
              <span className="font-medium">
                {message.from === dispute.farmer.phone ? dispute.farmer.name : dispute.buyer.name}:
              </span>{" "}
              {message.body}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function DisputeCard({ dispute, token, onDone }: { dispute: Dispute; token: string; onDone: () => void }) {
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: string, customKobo?: number) {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/admin/disputes", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ disputeId: dispute.id, decision, customKobo }),
    });
    const result = (await response.json().catch(() => ({}))) as { ok?: boolean; code?: string };
    setBusy(false);
    if (result.ok) onDone();
    else setError(FAILURES[result.code ?? ""] ?? "That didn't save. Please try again.");
  }

  const customKobo = nairaToKobo(custom);

  return (
    <li className="rounded-xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">
          <span className="font-num">{dispute.booking.code}</span> · {dispute.farmer.name} and {dispute.buyer.name}
        </p>
        <p className="font-num text-body-sm text-ink-muted">{timeLeft(dispute.deadline_at)}</p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          ["Recorded", `${dispute.delivery.measured_kg} kg`],
          ["Farmer claims", dispute.evidence.claim_kg ? `${dispute.evidence.claim_kg} kg` : "Not given"],
          ["Units", `${dispute.delivery.units_received} received, ${dispute.delivery.units_declined} declined`],
          ["Unit price", `${formatKobo(dispute.booking.unit_price_kobo)}/kg`],
          ["Already paid", formatKobo(dispute.undisputed_kobo)],
          ["In dispute", formatKobo(dispute.disputed_kobo)],
          ["Booked minimum", formatKobo(dispute.minimum_kobo)],
          ["Reserve", formatKobo(dispute.booking.reserve_kobo)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-label text-ink-muted">{label}</dt>
            <dd className="font-num text-number">{value}</dd>
          </div>
        ))}
      </dl>

      <Evidence dispute={dispute} />

      <div className="mt-5 flex flex-wrap items-end gap-2 border-t border-line pt-4">
        <Button disabled={busy} onClick={() => decide("pay_recorded")}>
          Pay recorded
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => decide("pay_booked_minimum")}>
          Pay booked minimum
        </Button>
        <label className="ml-auto flex flex-col gap-1 text-label">
          Custom total, in naira
          <Input
            inputMode="decimal"
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            className="font-num w-40"
          />
        </label>
        <Button
          variant="outline"
          disabled={busy || customKobo === null}
          onClick={() => decide("custom", customKobo ?? undefined)}
        >
          Custom amount
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-body-sm text-danger">
          {error}
        </p>
      )}
    </li>
  );
}

/** Open disputes, soonest deadline first. Access is enforced by the API, not by this page. */
export function DisputeQueue() {
  const { user, loading } = useAuthUser();
  const [disputes, setDisputes] = useState<Dispute[] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const idToken = await user.getIdToken();
    const response = await fetch("/api/admin/disputes", { headers: { Authorization: `Bearer ${idToken}` } });
    if (!response.ok) {
      setDenied(true);
      return;
    }
    setToken(idToken);
    setDisputes((await response.json()) as Dispute[]);
  }, [user]);

  useEffect(() => {
    // Loading from the API is the external system this effect stays in step with.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  let body;
  if (loading || (user && !disputes && !denied)) {
    body = <RowsSkeleton rows={3} label="Loading disputes" />;
  } else if (!user || denied) {
    body = <p>You need an admin account to see this page.</p>;
  } else if (disputes?.length === 0) {
    body = <p className="text-ink-muted">No open disputes.</p>;
  } else {
    body = (
      <ul className="space-y-4">
        {disputes?.map((dispute) => (
          <DisputeCard key={dispute.id} dispute={dispute} token={token as string} onDone={load} />
        ))}
      </ul>
    );
  }

  return (
    <main className="mx-auto max-w-[960px] px-4 py-8 md:px-6">
      <h1 className="text-title font-semibold">Open disputes</h1>
      <p className="mt-1 mb-6 text-ink-muted">If nobody decides by the deadline, the recorded weight is paid.</p>
      {body}
    </main>
  );
}
