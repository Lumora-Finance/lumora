"use client";

import { Check, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useAuthUser } from "@/components/auth/use-auth-user";
import { uploadPhoto } from "@/components/board/delivery-form";
import { BusyBar } from "@/components/loader/busy-bar";
import { DetailSkeleton } from "@/components/loader/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LumoraSelect } from "@/components/ui/lumora-select";
import { clock, dayAndClock, kilos, money, pricePer, windowText } from "@/lib/email/format";
import { apiFetch } from "@/lib/logistics/client";
import {
  bookingOptions, type BookingView, endedWords, reliabilityWords, timelineSteps,
} from "@/lib/money/booking-view";
import { nairaToKobo } from "@/lib/money/rules";
import { cn } from "@/lib/utils";

const FAILURES: Record<string, string> = {
  wrong_code: "That code isn't right. Check it with the buyer's staff.",
  code_locked: "Too many wrong codes. Our team has been told and will help you.",
  confirm_deadline_passed: "It's past the cut-off, so this booking was released.",
  report_window_closed: "It's too late to report this now.",
  needs_more_funds: "Your balance doesn't cover this. Add funds, or lower the price.",
  price_too_low: "The price can't be lower than your original price.",
  invalid_deadline: "Choose a later time today.",
  too_early: "You can find backup farmers once the delivery window starts.",
  photo_required: "Add a photo.",
  invalid_reason: "Choose a reason.",
  wrong_state: "This booking has moved on. Refresh to see the latest.",
};

const GATE_REASONS = [
  { value: "dead_on_arrival", label: "Dead on arrival" },
  { value: "underweight", label: "Underweight" },
  { value: "sick_or_injured", label: "Sick or injured" },
  { value: "outside_spec", label: "Outside the spec" },
  { value: "other", label: "Other" },
];

const FIELD = "mt-1.5 h-12 w-full rounded-md border border-line bg-white px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const LABEL = "block text-body-sm font-medium text-ink";
const CARD = "rounded-xl border border-line bg-white p-5";
const LATER_TODAY = (iso: string) => {
  // A time on the delivery day, in Lagos (UTC+1, with no daylight saving), for a time input.
  const lagos = new Date(new Date(iso).getTime() + 3_600_000);
  return lagos.toISOString().slice(11, 16);
};
const atLagosTime = (dayIso: string, time: string) => {
  const day = new Date(new Date(dayIso).getTime() + 3_600_000).toISOString().slice(0, 10);
  return new Date(`${day}T${time}:00+01:00`).toISOString();
};

function Timeline({ view }: { view: BookingView }) {
  return (
    <ol aria-label="Progress" className="mt-5 grid grid-cols-5 gap-1">
      {timelineSteps(view).map((step) => (
        <li key={step.label} aria-current={step.current ? "step" : undefined} className="min-w-0">
          <span className={cn("block h-1.5 rounded-full", step.done ? "bg-green" : step.current ? "bg-amber" : "bg-line")} />
          <span className={cn("mt-1.5 flex items-center gap-1 text-[11px] leading-4 sm:text-xs", step.done || step.current ? "font-medium text-ink" : "text-ink-muted")}>
            {step.done && <Check aria-hidden="true" strokeWidth={2} className="hidden size-3 sm:block" />}
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-label text-ink-muted">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

export function BookingPage({ bookingId }: { bookingId: string }) {
  const { user, loading } = useAuthUser();
  const [view, setView] = useState<BookingView | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [digits, setDigits] = useState("");
  const [lateOpen, setLateOpen] = useState(false);
  const [lateTime, setLateTime] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [claimKg, setClaimKg] = useState("");
  const [backupOpen, setBackupOpen] = useState(false);
  const [backupPrice, setBackupPrice] = useState("");
  const [backupTime, setBackupTime] = useState("");
  const [gateOpen, setGateOpen] = useState(false);
  const [gateReason, setGateReason] = useState("");
  const [gateNote, setGateNote] = useState("");
  const [gatePhoto, setGatePhoto] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const response = await apiFetch(user, `/api/bookings/${bookingId}`).catch(() => null);
    if (!response?.ok) {
      setMissing(true);
      return;
    }
    setMissing(false);
    setView((await response.json()) as BookingView);
  }, [user, bookingId]);

  useEffect(() => {
    // Loading from the API is the external system this effect stays in step with.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function act(action: string, body: Record<string, unknown> = {}, done?: string) {
    if (!user) return;
    setBusy(true);
    setPending(action);
    setMessage(null);
    const response = await apiFetch(user, `/api/money/bookings/${bookingId}`, { action, ...body }).catch(() => null);
    const result = (await response?.json().catch(() => null)) as { ok?: boolean; code?: string; attempts_left?: number } | null;
    setBusy(false);
    setPending(null);
    if (result?.ok) {
      setMessage(done ?? null);
      setLateOpen(false);
      setCancelOpen(false);
      setDisputeOpen(false);
      setBackupOpen(false);
      setGateOpen(false);
      setDigits("");
      await load();
      return;
    }
    if (result?.code === "wrong_code" && result.attempts_left) {
      setMessage(`That code isn't right. ${result.attempts_left} tries left.`);
    } else {
      setMessage(FAILURES[result?.code ?? ""] ?? "That didn't work. Please try again.");
    }
    await load();
  }

  if (loading || (user && !view && !missing)) return <DetailSkeleton label="Loading your booking" />;
  if (!user) {
    return (
      <p className="mx-auto max-w-[720px] px-4 py-8 md:px-6">
        <Link className="underline underline-offset-4" href={`/auth/login?next=/dashboard/bookings/${bookingId}`}>Sign in</Link> to see this booking.
      </p>
    );
  }
  if (!view) return <p className="mx-auto max-w-[720px] px-4 py-8 md:px-6">We couldn&apos;t find this booking on your account.</p>;

  const now = new Date();
  const can = bookingOptions(view, now);
  const ended = endedWords(view);
  const other = view.role === "farmer" ? view.buyer : view.farmer;
  const backupNeed = view.qty;

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-4 px-4 py-6 md:px-6">
      <Link href="/dashboard/bookings" className="inline-flex min-h-12 items-center text-body-sm text-ink-muted underline underline-offset-4 md:min-h-0">
        My bookings
      </Link>

      <section className={CARD}>
        <p className="font-num text-label text-ink-muted">{view.code}{view.is_backup ? " · urgent" : ""}</p>
        <h1 className="mt-1 text-title font-semibold text-ink">
          <span className="font-num">{view.qty}</span> {view.unit} {view.role === "farmer" ? "for" : "from"} {other}
        </h1>
        <p className="mt-1 text-ink-muted">
          {windowText(view.window_start, view.window_end)} · <span className="font-num">{pricePer(view.price_kobo, view.price_unit)}</span>
        </p>
        {ended ? <p role="status" className="mt-4 font-medium text-ink">{ended}</p> : <Timeline view={view} />}
      </section>

      {message && <p role="status" className="rounded-md bg-sage-soft px-4 py-3 text-ink">{message}</p>}

      {view.role === "buyer" && (
        <section className={CARD} aria-label="Farmer">
          <p className="font-medium text-ink">{view.farmer}</p>
          <p className="text-body-sm text-ink-muted">{reliabilityWords(view.reliability)}</p>
          {view.late_notice_at && !view.arrived_at && (
            <p role="status" className="mt-2 font-medium text-ink">
              {view.farmer} is running late{view.late_expected_at ? `, expected around ${clock(view.late_expected_at)}` : ""}.
            </p>
          )}
        </section>
      )}

      {can.confirm && (
        <section className={CARD}>
          <h2 className="font-semibold text-ink">Will you be there?</h2>
          <p className="mt-1 text-ink-muted">Tell us by {dayAndClock(view.confirm_deadline)}, or we give your place to another farmer.</p>
          <Button className="relative mt-3 h-12 w-full overflow-hidden text-base sm:w-auto" disabled={busy} onClick={() => act("confirm", {}, "You're confirmed. See you on delivery day.")}>
            Confirm
            <BusyBar active={pending === "confirm"} />
          </Button>
        </section>
      )}

      {view.status === "pending_approval" && view.role === "farmer" && (
        <p className={CARD}>{view.buyer} looks at first-time farmers first. If they don&apos;t answer by {clock(view.approval_deadline as string)}, you&apos;re booked.</p>
      )}

      {can.answerApproval && (
        <section className={CARD}>
          <h2 className="font-semibold text-ink">{view.farmer} hasn&apos;t delivered to you before</h2>
          <p className="mt-1 text-ink-muted">If you don&apos;t answer by {clock(view.approval_deadline as string)}, the booking goes ahead.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button className="h-12 text-base" disabled={busy} onClick={() => act("approval", { decision: "approve" }, "Approved. The farmer has been told.")}>Approve</Button>
            <Button className="h-12 text-base" variant="outline" disabled={busy} onClick={() => act("approval", { decision: "decline" }, "Declined. Your money is back in your balance.")}>Decline</Button>
          </div>
        </section>
      )}

      {can.showCode && (
        <section className={CARD}>
          <h2 className="font-semibold text-ink">Delivery code</h2>
          <p className="mt-1 text-ink-muted">No code, no delivery. Read this out when the farmer arrives, and only then.</p>
          {view.delivery_code ? (
            <p className="font-num mt-3 text-[2.5rem] leading-none font-medium tracking-[0.2em] text-ink">{view.delivery_code}</p>
          ) : (
            <Button className="mt-3 h-12 text-base" disabled={busy} onClick={() => act("regenerate_code")}>Get a code</Button>
          )}
          {view.code_locked && (
            <Button variant="outline" className="mt-3 h-12 text-base" disabled={busy} onClick={() => act("regenerate_code", {}, "New code ready. The old one no longer works.")}>
              Get a new code
            </Button>
          )}
        </section>
      )}

      {view.role === "buyer" && view.delivery_otp && (
        <section className={CARD}>
          <h2 className="font-semibold text-ink">Your delivery code</h2>
          <p className="mt-1 text-ink-muted">Record the weight first, then read this to {view.farmer}. Entering it pays them for the weight you recorded, and the rest comes back to you.</p>
          <p className="font-num mt-3 text-[2.5rem] leading-none font-medium tracking-[0.2em] text-ink">{view.delivery_otp}</p>
        </section>
      )}

      {can.gateDecline && (
        <section className={CARD}>
          <h2 className="font-semibold text-ink">{view.farmer} is at your gate</h2>
          <p className="mt-1 text-ink-muted">
            Give them the code above, or decline the delivery with a reason and photo.
            {view.report?.status === "open" && ` You have until ${clock(view.report.buyer_deadline_at)}.`}
            {view.report?.status === "ops" && " Our team is looking at this, but you can still do either."}
          </p>
          {!gateOpen ? (
            <Button variant="outline" className="mt-3 h-12 text-base" onClick={() => setGateOpen(true)}>Decline the delivery</Button>
          ) : (
            <div className="mt-3 space-y-3">
              <div>
                <p className={LABEL}>Reason</p>
                <div className="mt-1.5">
                  <LumoraSelect
                    portal
                    value={gateReason}
                    onChange={setGateReason}
                    placeholder="Choose a reason"
                    options={GATE_REASONS.map((r) => ({ value: r.value, label: r.label }))}
                  />
                </div>
              </div>
              <label className={LABEL}>
                Note (optional)
                <input className={FIELD} value={gateNote} onChange={(event) => setGateNote(event.target.value)} />
              </label>
              <label className={LABEL}>
                Photo
                <input
                  type="file" accept="image/*" capture="environment" className="mt-1.5 block w-full text-body-sm"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setBusy(true);
                    setGatePhoto(await uploadPhoto(user, file).catch(() => null));
                    setBusy(false);
                  }}
                />
              </label>
              {gatePhoto && <p className="text-body-sm text-ink-muted">Photo added.</p>}
              <Button
                className="h-12 text-base"
                disabled={busy || !gateReason || !gatePhoto}
                onClick={() => act("nocode_decline", { reason: gateReason, photoUrl: gatePhoto, note: gateNote || undefined }, "Declined. Your money is back in your balance.")}
              >
                Decline the delivery
              </Button>
            </div>
          )}
        </section>
      )}

      {view.role === "farmer" && view.status === "contested" && (
        <p className={CARD}>
          We&apos;ve told {view.buyer} you&apos;re at the gate.
          {view.report?.status === "ops" ? " They didn't answer in time, so our team will decide within 24 hours." : ` They have until ${clock((view.report as NonNullable<BookingView["report"]>).buyer_deadline_at)} to answer.`}
          {" "}You won&apos;t be marked as missing while this is open.
        </p>
      )}

      {can.enterCode && (
        <section className={CARD}>
          <h2 className="font-semibold text-ink">Enter delivery code</h2>
          <p className="mt-1 text-ink-muted">Ask the buyer&apos;s staff for the 4-digit code when you arrive.</p>
          <form
            className="mt-3 flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void act("submit_code", { digits }, "Thank you. The buyer will weigh your delivery next.");
            }}
          >
            <Input
              aria-label="Delivery code" inputMode="numeric" autoComplete="off" maxLength={4} value={digits}
              onChange={(event) => setDigits(event.target.value.replace(/\D/g, ""))}
              className="font-num h-12 w-32 text-center text-xl tracking-[0.2em]"
            />
            <Button type="submit" className="relative h-12 overflow-hidden text-base" disabled={busy || digits.length !== 4}>
              Enter code
              <BusyBar active={pending === "submit_code"} />
            </Button>
          </form>
        </section>
      )}
      {view.role === "farmer" && view.code_locked && !view.arrived_at && !["no_show", "cancelled"].includes(view.status) && (
        <p className={CARD}>Too many wrong codes, so entry is locked. Our team has been told. If you&apos;re at the gate, tap &ldquo;They won&apos;t give me the code&rdquo; below.</p>
      )}

      {can.weighReply && view.delivery && (
        <section className={CARD}>
          <h2 className="font-num font-semibold text-ink">
            {kilos(view.delivery.measured_kg)} kg × {money(view.price_kobo)} = {money(view.delivery.gross_kobo)}
          </h2>
          <p className="mt-1 text-ink-muted">If we don&apos;t hear from you by {clock(view.delivery.reply_deadline)}, we pay this amount.</p>
          {view.delivery.scale_photo && (
            <a href={view.delivery.scale_photo} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-12 items-center underline underline-offset-4 md:min-h-0">See the scale photo</a>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button className="relative h-12 overflow-hidden text-base" disabled={busy} onClick={() => act("reply", { reply: "yes" }, "Thank you. Your payout is on its way.")}>
              Confirm
              <BusyBar active={pending === "reply"} />
            </Button>
            <Button className="h-12 text-base" variant="outline" disabled={busy} onClick={() => setDisputeOpen((open) => !open)}>Something&apos;s wrong</Button>
          </div>
          {disputeOpen && (
            <div className="mt-3 space-y-3">
              <label className={LABEL}>
                What did you weigh it at, in kg? (optional)
                <input className={cn(FIELD, "font-num")} inputMode="decimal" value={claimKg} onChange={(event) => setClaimKg(event.target.value)} />
              </label>
              <p className="text-body-sm text-ink-muted">We pay the recorded amount now and hold only the difference while we look at it.</p>
              <Button
                className="h-12 text-base" disabled={busy}
                onClick={() => act("reply", { reply: "dispute", claimKg: claimKg ? Number(claimKg) : undefined }, "We've got it. We decide within 48 hours.")}
              >
                Tell Lumora
              </Button>
            </div>
          )}
        </section>
      )}

      {can.weighIn && (
        <section className={CARD}>
          <h2 className="font-semibold text-ink">{view.farmer} has arrived</h2>
          <p className="mt-1 text-ink-muted">Weigh the delivery and record it by {clock(view.record_by as string)}. If you don&apos;t, we pay the minimum weight and you get a strike.</p>
          <Link
            href={`/dashboard/bookings/${view.id}/record`}
            className="mt-3 inline-flex h-12 items-center rounded-md bg-primary px-4 font-medium text-primary-foreground hover:bg-green-hover"
          >
            Record the weight
          </Link>
        </section>
      )}

      {view.delivery && view.role === "buyer" && (
        <section className={CARD}>
          <h2 className="font-semibold text-ink">Recorded</h2>
          <p className="font-num mt-1 text-ink">{kilos(view.delivery.measured_kg)} kg = {money(view.delivery.gross_kobo)}</p>
          <p className="text-body-sm text-ink-muted">{view.delivery.units_received} accepted, {view.delivery.units_declined} declined</p>
        </section>
      )}

      {view.status === "disputed" && <p className={CARD}>Our team is looking at this delivery. We decide within 48 hours.</p>}

      {view.settlement && view.status === "settled" && view.role === "farmer" && (
        <section className={CARD}>
          <h2 className="font-semibold text-ink">{view.payout_status === "paid" ? "Paid" : "Your payout is on its way"}</h2>
          <dl className="mt-2 grid grid-cols-2 gap-3">
            <Fact label="For this delivery"><span className="font-num">{money(view.settlement.gross_kobo)}</span></Fact>
            <Fact label="Fees"><span className="font-num">{money(view.settlement.fees_kobo)}</span></Fact>
            <Fact label="You get"><span className="font-num font-medium">{money(view.settlement.net_kobo)}</span></Fact>
          </dl>
        </section>
      )}

      {can.keepWaiting && (
        <section className={CARD}>
          <h2 className="font-semibold text-ink">{view.farmer} hasn&apos;t arrived yet</h2>
          <p className="mt-1 text-ink-muted">Find someone else, or give them more time. They have until {clock(view.no_show_at)}.</p>
          <Button variant="outline" className="mt-3 h-12 text-base" disabled={busy} onClick={() => act("keep_waiting", {}, "Okay. We'll let you know when they arrive.")}>Keep waiting</Button>
        </section>
      )}

      {can.findBackup && (
        <section className={CARD}>
          <h2 className="font-semibold text-ink">Find backup farmers</h2>
          <p className="mt-1 text-ink-muted">We email nearby farmers with stock. If {view.farmer} arrives first, we close the request and release any backups, with no penalty.</p>
          {!backupOpen ? (
            <Button
              className="mt-3 h-12 text-base"
              onClick={() => {
                setBackupPrice(String(view.price_kobo / 100));
                setBackupTime(LATER_TODAY(view.no_show_at));
                setBackupOpen(true);
              }}
            >
              Find backup farmers
            </Button>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-ink"><span className="font-num">{backupNeed}</span> {view.goods}</p>
              <label className={LABEL}>
                Price for every {view.price_unit}, in naira
                <input className={cn(FIELD, "font-num")} inputMode="decimal" value={backupPrice} onChange={(event) => setBackupPrice(event.target.value)} />
              </label>
              <label className={LABEL}>
                They must arrive by
                <input className={cn(FIELD, "font-num")} type="time" value={backupTime} onChange={(event) => setBackupTime(event.target.value)} />
              </label>
              <Button
                className="h-12 text-base"
                disabled={busy || nairaToKobo(backupPrice) === null || !backupTime}
                onClick={() => act("find_backup", { priceKobo: nairaToKobo(backupPrice), deadline: atLagosTime(view.window_start, backupTime) }, "We've asked nearby farmers. You'll hear when they book.")}
              >
                Ask nearby farmers
              </Button>
            </div>
          )}
        </section>
      )}

      {view.backup && (
        <section className={CARD}>
          <h2 className="font-semibold text-ink">Backup request</h2>
          <p className="mt-1 text-ink-muted">
            {view.backup.status === "open" && <>Needs <span className="font-num">{view.backup.remaining}</span> more by {clock(view.backup.deadline_at)} at <span className="font-num">{pricePer(view.backup.price_kobo, view.price_unit)}</span>.</>}
            {view.backup.status === "filled" && "Backup farmers have booked everything you asked for."}
            {view.backup.status === "closed" && "This request is closed."}
          </p>
        </section>
      )}

      {(view.contact.ok && (view.contact.phone || view.contact.address)) && (
        <section className={CARD} aria-label="Contact">
          {view.role === "farmer" && <p className="font-medium text-ink">{view.contact.name}</p>}
          {view.contact.phone && (
            <a href={`tel:${view.contact.phone}`} className="font-num mt-1 flex min-h-12 items-center gap-2 underline underline-offset-4 md:min-h-0">
              <Phone aria-hidden="true" strokeWidth={1.5} className="size-4" />
              {view.contact.phone}
            </a>
          )}
          {view.contact.address && (
            <p className="mt-1 flex items-start gap-2 text-ink">
              <MapPin aria-hidden="true" strokeWidth={1.5} className="mt-1 size-4 shrink-0" />
              {view.contact.address}
            </p>
          )}
        </section>
      )}

      {(can.runningLate || can.noCode || can.cancel) && (
        <section className={cn(CARD, "space-y-3")} aria-label="Other options">
          {can.runningLate && (
            <div>
              <Button variant="outline" className="h-12 w-full text-base sm:w-auto" onClick={() => setLateOpen((open) => !open)}>I&apos;m running late</Button>
              {lateOpen && (
                <div className="mt-3 space-y-3">
                  <label className={LABEL}>
                    When will you arrive? (optional)
                    <input className={cn(FIELD, "font-num")} type="time" value={lateTime} onChange={(event) => setLateTime(event.target.value)} />
                  </label>
                  <p className="text-body-sm text-ink-muted">This tells the buyer. It doesn&apos;t change your deadline of {clock(view.no_show_at)}.</p>
                  <Button
                    className="h-12 text-base" disabled={busy}
                    onClick={() => act("running_late", { expectedAt: lateTime ? atLagosTime(view.window_start, lateTime) : undefined }, "We've told the buyer.")}
                  >
                    Tell the buyer
                  </Button>
                </div>
              )}
            </div>
          )}
          {can.noCode && (
            <Button variant="outline" className="h-12 w-full text-base sm:w-auto" disabled={busy} onClick={() => act("report_no_code", {}, "We've told the buyer. They have 30 minutes to answer.")}>
              They won&apos;t give me the code
            </Button>
          )}
          {can.cancel && (
            <div>
              <Button variant="outline" className="h-12 w-full text-base sm:w-auto" onClick={() => setCancelOpen((open) => !open)}>Cancel</Button>
              {cancelOpen && (
                <div className="mt-3 space-y-3">
                  <p className="text-ink">
                    {view.role === "farmer"
                      ? can.cancelCounts ? "It's past the cut-off, so cancelling now counts as a missed delivery." : `This is free until ${dayAndClock(view.cutoff_at)}.`
                      : can.cancelCounts ? "It's past the cut-off, so you pay the farmer a 5% fee and get a strike." : `This is free until ${dayAndClock(view.cutoff_at)}.`}
                  </p>
                  <Button
                    variant="destructive" className="h-12 text-base" disabled={busy}
                    onClick={() => act(view.role === "farmer" ? "cancel_farmer" : "cancel_buyer", {}, "This booking is cancelled.")}
                  >
                    Yes, cancel this booking
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
