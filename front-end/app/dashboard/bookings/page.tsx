"use client";

import { useEffect, useState } from "react";
import { Calendar, Check, MapPin, Truck, X, KeyRound } from "lucide-react";
import Link from "next/link";


import { getToken } from "@/lib/firebase/auth";
import { Reveal } from "@/components/motion/reveal";
import { TransactionPinModal } from "@/components/dashboard/transaction-pin-modal";
import { cn } from "@/lib/utils";
import { BusyBar } from "@/components/loader/busy-bar";
import { CardsSkeleton } from "@/components/loader/skeletons";
import { HillsCard, HillsStats } from "@/components/profile/hills-card";
import { trackTask } from "@/lib/loading/progress";

type Tab = "upcoming" | "past" | "cancelled";

type Booking = {
  id: string;
  code: string;
  qty: number;
  status: string;
  reserve_kobo: number;
  unit_price_kobo: number;
  is_buyer: boolean;
  arrived: boolean;
  window_start: string;
  window_end: string;
  slot_date: string;
  commodity: string;
  spec: string | null;
  delivery_address: string | null;
  buyer: { id: string; name: string };
  farmer: { id: string; name: string };
  listing_id: string;
};

const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-sage-soft text-green",
  booked: "bg-amber-soft text-amber",
  settled: "bg-sage-soft text-green",
  cancelled: "bg-danger/10 text-danger",
  no_show: "bg-danger/10 text-danger",
  released: "bg-line text-ink-muted",
};

function formatKobo(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
}

function formatWindow(start: string, end: string) {
  const fmt = (s: string) => new Date(s).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function tabOf(b: Booking): Tab {
  if (["cancelled", "no_show", "released"].includes(b.status)) return "cancelled";
  if (b.status === "settled") return "past";
  return "upcoming";
}

/** Always answers, so a failed request can't leave a button waiting forever. */
async function postBookingAction(bookingId: string, endpoint: string, body: object = {}) {
  try {
    const token = await getToken();
    const res = await fetch(`/api/bookings/${bookingId}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    return (await res.json().catch(() => null)) ?? { ok: false, message: "That didn't work. Please try again." };
  } catch {
    return { ok: false, message: "We couldn't reach Lumora. Check your connection and try again." };
  }
}

function BookingCard({
  booking,
  onRefresh,
}: {
  booking: Booking;
  onRefresh: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [pinOpen, setPinOpen] = useState<"revoke" | "otp" | null>(null);
  const [pendingAction, setPendingAction] = useState<() => Promise<void>>(() => async () => {});

  async function handleRevoke() {
    setSaving(true);
    const result = await postBookingAction(booking.id, "revoke");
    setSaving(false);
    if (result.ok) onRefresh();
    else alert(result.message ?? result.code ?? "Could not revoke booking.");
  }

  async function handleMarkDelivered() {
    setSaving(true);
    const result = await postBookingAction(booking.id, "deliver");
    setSaving(false);
    if (result.ok) { onRefresh(); }
    else alert(result.message ?? result.code ?? "Could not mark as delivered.");
  }

  async function handleOtpSubmit() {
    if (!/^\d{6}$/.test(otpInput)) { setOtpError("Enter a 6-digit code"); return; }
    setSaving(true);
    setOtpError(null);
    const result = await postBookingAction(booking.id, "otp", { otp: otpInput });
    setSaving(false);
    if (result.ok) { setShowOtp(false); onRefresh(); }
    else {
      setOtpError(result.code === "wrong_otp"
        ? `Wrong code. ${result.attempts_left} attempt${result.attempts_left === 1 ? "" : "s"} left.`
        : result.message ?? "Invalid OTP.");
    }
  }

  function requirePin(action: () => Promise<void>) {
    setPendingAction(() => action);
    setPinOpen("revoke");
  }

  const canRevoke = ["booked", "confirmed"].includes(booking.status) && !booking.arrived;
  const canDeliver = !booking.is_buyer && ["booked", "confirmed"].includes(booking.status) && !booking.arrived;
  const canEnterOtp = !booking.is_buyer && booking.arrived && booking.status !== "settled";

  return (
    <>
      <div className={cn(
        "overflow-hidden rounded-xl border border-line bg-white p-5 shadow-sm transition-shadow hover:shadow-md",
        booking.status === "settled" && "opacity-80",
      )}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-num font-medium text-ink">{booking.code}</span>
              <span className={cn("rounded-full px-2.5 py-0.5 text-label font-medium capitalize", STATUS_STYLE[booking.status] ?? "bg-line text-ink-muted")}>
                {booking.status.replace(/_/g, " ")}
              </span>
            </div>
            <p className="mt-1 font-medium text-ink">{booking.commodity}</p>
            {booking.spec && <p className="text-body-sm text-ink-muted">{booking.spec}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="font-num text-number font-medium text-amber">{formatKobo(booking.reserve_kobo)}</p>
            <p className="text-body-sm text-ink-muted">{booking.qty} units</p>
          </div>
        </div>

        {/* Details */}
        <div className="mt-4 grid grid-cols-2 gap-3 text-body-sm">
          <div>
            <p className="text-ink-muted">Date</p>
            <p className="font-medium text-ink flex items-center gap-1">
              <Calendar strokeWidth={1.5} className="size-3.5 text-ink-muted" />
              {formatDate(booking.slot_date)}
            </p>
          </div>
          <div>
            <p className="text-ink-muted">Window</p>
            <p className="font-medium text-ink">
              {formatWindow(booking.window_start, booking.window_end)}
            </p>
          </div>
          <div>
            <p className="text-ink-muted">{booking.is_buyer ? "Farmer" : "Buyer"}</p>
            <p className="font-medium text-ink">
              {booking.is_buyer ? booking.farmer.name : booking.buyer.name}
            </p>
          </div>
          {booking.delivery_address && (
            <div className="col-span-2">
              <p className="text-ink-muted">Delivery address</p>
              <p className="mt-0.5 flex items-start gap-1.5 font-medium text-ink">
                <MapPin strokeWidth={1.5} className="mt-0.5 size-3.5 shrink-0 text-ink-muted" />
                {booking.delivery_address}
              </p>
            </div>
          )}
        </div>

        {/* Arrived badge */}
        {booking.arrived && booking.status !== "settled" && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-soft/50 px-3 py-2">
            <Truck strokeWidth={1.5} className="size-4 text-amber" />
            <p className="text-body-sm text-ink">
              {booking.is_buyer
                ? "Farmer has marked delivery. Check your notifications for the OTP to give them."
                : "You marked as delivered. Ask the buyer for the 6-digit OTP."}
            </p>
          </div>
        )}

        {/* Actions */}
        {(canRevoke || canDeliver || canEnterOtp) && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
            {canDeliver && !showOtp && (
              <button
                onClick={() => requirePin(handleMarkDelivered)}
                disabled={saving}
                aria-busy={saving}
                className="relative flex items-center gap-1.5 overflow-hidden rounded-lg bg-green px-4 py-2 text-body-sm font-medium text-paper hover:bg-green-hover disabled:opacity-50"
              >
                <Check strokeWidth={2} className="size-3.5" />
                Mark delivered
                <BusyBar active={saving} />
              </button>
            )}
            {canEnterOtp && (
              <button
                onClick={() => setShowOtp(true)}
                className="flex items-center gap-1.5 rounded-lg bg-amber px-4 py-2 text-body-sm font-medium text-ink hover:bg-amber/90"
              >
                <KeyRound strokeWidth={2} className="size-3.5" /> Enter OTP
              </button>
            )}
            {canRevoke && (
              <button
                onClick={() => requirePin(handleRevoke)}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-body-sm font-medium text-ink-muted hover:border-danger hover:bg-danger/10 hover:text-danger disabled:opacity-50"
              >
                <X strokeWidth={2} className="size-3.5" /> Revoke
              </button>
            )}
          </div>
        )}

        {/* OTP input panel */}
        {showOtp && (
          <div className="mt-3 rounded-lg border border-amber/30 bg-amber-soft/30 p-4">
            <p className="text-body-sm font-medium text-ink">Enter the 6-digit OTP from the buyer:</p>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpInput}
                onChange={(e) => { setOtpInput(e.target.value.replace(/\D/g, "")); setOtpError(null); }}
                placeholder="000000"
                className="w-32 rounded-lg border border-line bg-white px-3 py-2 font-num text-xl text-center text-ink tracking-widest outline-none focus:border-green"
              />
              <button
                onClick={() => requirePin(handleOtpSubmit)}
                disabled={otpInput.length !== 6 || saving}
                aria-busy={saving}
                className="relative overflow-hidden rounded-lg bg-green px-4 py-2 text-body-sm font-medium text-paper hover:bg-green-hover disabled:opacity-50"
              >
                Confirm
                <BusyBar active={saving} />
              </button>
              <button onClick={() => { setShowOtp(false); setOtpInput(""); setOtpError(null); }}
                className="rounded-lg border border-line px-3 py-2 text-body-sm text-ink-muted hover:text-ink">
                Cancel
              </button>
            </div>
            {otpError && <p className="mt-1.5 text-body-sm text-danger">{otpError}</p>}
          </div>
        )}
      </div>

      {/* PIN modal */}
      {pinOpen && (
        <TransactionPinModal
          mode="verify"
          onSuccess={async () => {
            setPinOpen(null);
            await pendingAction();
          }}
          onClose={() => setPinOpen(null)}
        />
      )}
    </>
  );
}

export default function BookingsPage() {
  const [tab, setTab] = useState<Tab>("upcoming");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const finished = trackTask("bookings");
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/bookings", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as Booking[];
      setBookings(Array.isArray(data) ? data : []);
    } catch {
      setError("Couldn't load bookings. Please refresh.");
    } finally {
      finished();
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const items = bookings.filter((b) => tabOf(b) === tab);
  const upcoming = bookings.filter((b) => tabOf(b) === "upcoming");
  const confirmed = upcoming.filter((b) => b.status === "confirmed");

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-6 lg:px-8">

      <HillsCard className="mb-8">
        <div className="px-5 pt-24 pb-6 sm:px-10 sm:pt-28 sm:pb-9 lg:px-14 lg:pt-32 lg:pb-11">
          <p data-card="rise" className="text-body-sm font-medium text-ink/70">My activity</p>
          <h1 data-card="rise" className="mt-1 text-[26px] leading-tight font-medium tracking-tight text-ink sm:text-[34px]">My bookings</h1>
          <div className="mt-6 sm:mt-8">
            <HillsStats
              stats={[
                { value: loading ? null : confirmed.length, label: "confirmed" },
                { value: loading ? null : upcoming.length, label: "upcoming" },
                { value: loading ? null : bookings.length, label: "total" },
              ]}
            />
          </div>
        </div>
      </HillsCard>

      {/* Tabs */}
      <Reveal effect="riseIn">
        <div className="mb-6 flex w-fit gap-1 rounded-xl border border-line bg-white p-1">
          {(["upcoming", "past", "cancelled"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("rounded-lg px-4 py-2 text-body-sm font-medium capitalize transition-all duration-150",
                tab === t ? "bg-sage-soft text-green shadow-sm" : "text-ink-muted hover:text-ink")}>
              {t}
            </button>
          ))}
        </div>
      </Reveal>

      {loading ? (
        <CardsSkeleton label="Loading your bookings" />
      ) : error ? (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-6 text-center text-danger">{error}</div>
      ) : items.length === 0 ? (
        <Reveal effect="riseIn">
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-field px-8 py-16 text-center text-paper">
            <Calendar strokeWidth={1} className="size-10 text-sage/40" />
            <p className="font-display text-title font-medium text-paper">No {tab} bookings</p>
            <p className="text-body text-paper/60">Browse the marketplace to find buyers near you.</p>
            <Link href="/dashboard/marketplace" className="mt-2 rounded-full bg-paper px-5 py-2.5 text-body-sm font-medium text-field hover:bg-sage-soft">
              Go to marketplace →
            </Link>
          </div>
        </Reveal>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((b) => (
            <Reveal key={b.id} effect="riseIn" config={{ stagger: 0 }}>
              <BookingCard booking={b} onRefresh={load} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
