/**
 * notify.ts — server-side helper for firing in-app notifications.
 *
 * Usage in any API route:
 *   import { notify } from "@/lib/notify";
 *   await notify(db, {
 *     userId: user.id,
 *     kind: "booking_confirmed",
 *     title: "Booking confirmed",
 *     body: "Your slot for 30 broilers at Rayfield Restaurant is confirmed.",
 *     bookingId: result.booking_id ?? null,
 *     data: { listing_id: listingId },
 *   });
 *
 * Every notification kind maps to an icon in the NotificationBell component.
 * Supported kinds and their display icons:
 *
 *   booking_*         → green check (booking)
 *   payout_*          → green dollar (payout)
 *   payment_*         → green dollar (payment)
 *   receipt_*         → green dollar (receipt)
 *   delivery_*        → amber truck (delivery)
 *   weigh_*           → amber truck (weigh)
 *   record_*          → amber truck (record)
 *   dispute_*         → red shield (alert)
 *   no_show           → red shield (alert)
 *   paused_*          → red shield (alert)
 *   failed_*          → red shield (alert)
 *   declined_*        → red shield (alert)
 *   demand_*          → green package (demand)
 *   supply_*          → green package (supply)
 *   offer_*           → green package (offer)
 *   capacity_*        → green package (capacity)
 *   freed_*           → green package (freed)
 *   rating_*          → amber star (rating)
 *   review_*          → amber star (review)
 *   (anything else)   → neutral bell
 */

import type { MoneyDb } from "@/lib/money/db";

export type NotifyInput = {
  userId: string;
  kind: string;
  /** Short headline shown bold in the bell panel. */
  title: string;
  /** Supporting sentence. */
  body: string;
  bookingId?: string | null;
  /** Any extra key/value data the UI needs (listing_id, commodity, etc.). */
  data?: Record<string, string | number | boolean | null>;
};

/**
 * Inserts a notification row into the database.
 * Fires and forgets — the caller should not await this if they don't want
 * a notification failure to break the main action.
 *
 * Example (non-blocking):
 *   void notify(db, { userId, kind: "booking_confirmed", title, body }).catch(() => null);
 */
export async function notify(db: MoneyDb, input: NotifyInput): Promise<void> {
  const { userId, kind, title, body, bookingId = null, data = {} } = input;
  await db.rpc("money_notify", {
    p_user: userId,
    p_kind: kind,
    p_booking: bookingId,
    p_data: { title, body, ...data },
    p_now: new Date().toISOString(),
    p_email: false, // In-app only; email is handled separately by the email outbox job
  }).catch(() => null);
}

// ─── Pre-built notification templates ────────────────────────────────────────

export function notifyBookingCreated(db: MoneyDb, userId: string, opts: {
  bookingId: string; code: string; qty: number; unit: string; buyer: string; area: string;
}) {
  return notify(db, {
    userId,
    kind: "booking_confirmed",
    title: "Booking confirmed",
    body: `${opts.qty} ${opts.unit} for ${opts.buyer} in ${opts.area}. Code: ${opts.code}.`,
    bookingId: opts.bookingId,
    data: { booking_id: opts.bookingId, code: opts.code },
  });
}

export function notifyBookingRevoked(db: MoneyDb, userId: string, opts: {
  bookingId: string; code: string; revokedBy: "farmer" | "buyer" | "system";
}) {
  const by = opts.revokedBy === "farmer" ? "You cancelled" : opts.revokedBy === "buyer" ? "The buyer cancelled" : "Cancelled";
  return notify(db, {
    userId,
    kind: "booking_revoked",
    title: "Booking cancelled",
    body: `${by} booking ${opts.code}.`,
    bookingId: opts.bookingId,
    data: { booking_id: opts.bookingId },
  });
}

export function notifyDeliveryRecorded(db: MoneyDb, userId: string, opts: {
  bookingId: string; code: string; accepted: number; unit: string; kg: number;
}) {
  return notify(db, {
    userId,
    kind: "delivery_recorded",
    title: "Delivery recorded",
    body: `${opts.accepted} ${opts.unit} accepted (${opts.kg} kg) for booking ${opts.code}.`,
    bookingId: opts.bookingId,
    data: { booking_id: opts.bookingId },
  });
}

export function notifyDeliveryMarked(db: MoneyDb, userId: string, opts: {
  bookingId: string; code: string;
}) {
  return notify(db, {
    userId,
    kind: "delivery_arrived",
    title: "Delivery marked",
    body: `Booking ${opts.code} marked as delivered. Waiting for weight record.`,
    bookingId: opts.bookingId,
    data: { booking_id: opts.bookingId },
  });
}

export function notifyListingCreated(db: MoneyDb, userId: string, opts: {
  listingId: string; commodity: string; priceKobo: number; capacity: number;
}) {
  const price = `₦${(opts.priceKobo / 100).toLocaleString("en-NG")}`;
  return notify(db, {
    userId,
    kind: "demand_listing_posted",
    title: "Demand listing posted",
    body: `${opts.commodity} at ${price}/unit — capacity ${opts.capacity}. Farmers near you can now book.`,
    bookingId: null,
    data: { listing_id: opts.listingId },
  });
}

export function notifyOfferAccepted(db: MoneyDb, userId: string, opts: {
  offerId: string; commodity: string; qty: number; unit: string;
}) {
  return notify(db, {
    userId,
    kind: "offer_accepted",
    title: "Offer accepted",
    body: `Your offer for ${opts.qty} ${opts.unit} of ${opts.commodity} was accepted.`,
    bookingId: null,
    data: { offer_id: opts.offerId },
  });
}

export function notifyOfferReceived(db: MoneyDb, userId: string, opts: {
  offerId: string; commodity: string; qty: number; unit: string; farmerName: string;
}) {
  return notify(db, {
    userId,
    kind: "offer_received",
    title: "New offer",
    body: `${opts.farmerName} offered ${opts.qty} ${opts.unit} of ${opts.commodity}.`,
    bookingId: null,
    data: { offer_id: opts.offerId },
  });
}

export function notifyPayoutSent(db: MoneyDb, userId: string, opts: {
  bookingId: string; amountKobo: number; code: string;
}) {
  const amount = `₦${(opts.amountKobo / 100).toLocaleString("en-NG")}`;
  return notify(db, {
    userId,
    kind: "payout_sent",
    title: "Payout sent",
    body: `${amount} for booking ${opts.code} is on its way to your account.`,
    bookingId: opts.bookingId,
    data: { booking_id: opts.bookingId },
  });
}

export function notifyWalletFunded(db: MoneyDb, userId: string, opts: {
  amountKobo: number;
}) {
  const amount = `₦${(opts.amountKobo / 100).toLocaleString("en-NG")}`;
  return notify(db, {
    userId,
    kind: "payment_received",
    title: "Wallet funded",
    body: `${amount} added to your Lumora wallet.`,
    bookingId: null,
    data: {},
  });
}
