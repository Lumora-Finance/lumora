"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useAuthUser } from "@/components/auth/use-auth-user";
import { BusyBar } from "@/components/loader/busy-bar";
import { RowsSkeleton } from "@/components/loader/skeletons";
import { Button } from "@/components/ui/button";
import { ACTION_SCREENS } from "@/lib/email/actions";
import { pricePer, windowText } from "@/lib/email/format";

type Preview = {
  ok: boolean;
  code?: string;
  action?: string;
  booking_id?: string;
  facts?: {
    code: string; qty: number; unit: string; farmer: string; buyer: string; price_kobo: number; price_unit: string;
    window_start: string; window_end: string;
  };
};

const PROBLEMS: Record<string, string> = {
  used: "This link has already been used.",
  expired: "This link has expired, because that step's deadline has passed.",
  not_yours: "This link is for a different account. Sign in with the account the email was sent to.",
  invalid: "This link isn't valid.",
  token_not_found: "This link isn't valid.",
  wrong_state: "This booking has moved on, so there's nothing to do here.",
  confirm_deadline_passed: "It's past the cut-off, so this booking was released.",
  too_early: "You can find backup farmers once the delivery window starts.",
  needs_more_funds: "Your balance doesn't cover this. Add funds and try again.",
};

/**
 * Where an email button lands. Opening it only reads what it's for, so a mail scanner or a stray tap
 * changes nothing. The one button below is what acts, and it needs this person signed in.
 */
export function ActionScreen({ token }: { token: string }) {
  const { user, loading } = useAuthUser();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [claimKg, setClaimKg] = useState("");

  const call = useCallback(async (perform: boolean, claim?: number) => {
    if (!user) return null;
    const idToken = await user.getIdToken();
    const response = await fetch("/api/actions", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ token, perform, claimKg: claim }),
    }).catch(() => null);
    return ((await response?.json().catch(() => null)) ?? { ok: false }) as Preview;
  }, [user, token]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void call(false).then((result) => {
      if (cancelled || !result) return;
      setPreview(result);
      setBookingId(result.booking_id ?? null);
      if (!result.ok) setProblem(PROBLEMS[result.code ?? ""] ?? "Something went wrong. Please try again.");
    });
    return () => {
      cancelled = true;
    };
  }, [user, call]);

  async function press() {
    setBusy(true);
    const claim = preview?.action === "dispute" && claimKg ? Number(claimKg) : undefined;
    const result = await call(true, claim);
    setBusy(false);
    if (result?.ok) setDone(true);
    else setProblem(PROBLEMS[result?.code ?? ""] ?? "That didn't work. Please try again.");
  }

  const screen = preview?.action ? ACTION_SCREENS[preview.action] : undefined;
  const facts = preview?.facts;
  const backToBooking = bookingId && (
    <Link href={`/dashboard/bookings/${bookingId}`} className="mt-4 inline-flex min-h-12 items-center font-medium underline underline-offset-4">
      Go to this booking
    </Link>
  );

  let body;
  if (loading || (user && !preview)) {
    body = <RowsSkeleton rows={2} label="Opening your booking" />;
  } else if (!user) {
    body = (
      <>
        <h1 className="text-title font-semibold text-ink">Sign in to continue</h1>
        <p className="mt-2 text-ink-muted">Sign in with the account this email was sent to. Nothing changes until you press the button on the next screen.</p>
        <Link href={`/auth/login?next=/action/${token}`} className="mt-4 inline-flex h-12 items-center rounded-md bg-primary px-5 font-medium text-primary-foreground hover:bg-green-hover">
          Sign in
        </Link>
      </>
    );
  } else if (done) {
    body = (
      <>
        <h1 className="text-title font-semibold text-ink">Done</h1>
        <p role="status" className="mt-2 text-ink">{screen?.done}</p>
        {backToBooking}
      </>
    );
  } else if (problem || !screen) {
    body = (
      <>
        <h1 className="text-title font-semibold text-ink">We can&apos;t do that</h1>
        <p role="alert" className="mt-2 text-ink">{problem ?? "This link isn't valid."}</p>
        {backToBooking}
      </>
    );
  } else {
    body = (
      <>
        <h1 className="text-title font-semibold text-ink">{screen.title}</h1>
        {facts && (
          <p className="mt-2 text-ink">
            <span className="font-num">{facts.qty}</span> {facts.unit}, {facts.farmer} to {facts.buyer}. {windowText(facts.window_start, facts.window_end)}, <span className="font-num">{pricePer(facts.price_kobo, facts.price_unit)}</span>. <span className="font-num">{facts.code}</span>.
          </p>
        )}
        <p className="mt-2 text-ink-muted">{screen.body}</p>
        {preview?.action === "dispute" && (
          <label className="mt-4 block text-body-sm font-medium text-ink">
            What did you weigh it at, in kg? (optional)
            <input
              inputMode="decimal" value={claimKg} onChange={(event) => setClaimKg(event.target.value)}
              className="font-num mt-1.5 h-12 w-full rounded-md border border-line bg-white px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
        )}
        <Button className="relative mt-5 h-12 w-full overflow-hidden text-base" disabled={busy} onClick={press}>
          {screen.button}
          <BusyBar active={busy} />
        </Button>
        {backToBooking}
      </>
    );
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-paper px-4 py-8">
      <div className="w-full max-w-[440px] rounded-xl border border-line bg-white p-6">{body}</div>
    </main>
  );
}
