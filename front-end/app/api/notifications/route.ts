import { connection } from "next/server";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/**
 * GET /api/notifications — get all notifications for the current user
 * PATCH /api/notifications — mark notifications as read
 * Body for PATCH: { ids: string[] }
 *
 * The DB stores title and body inside the `data` JSONB column
 * (inserted by money_notify via lib/notify.ts). We lift them to
 * top-level fields so the NotificationBell doesn't have to dig into `data`.
 */

type RawNotification = {
  id: string;
  kind: string;
  booking_id: string | null;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

function normalise(raw: RawNotification) {
  // The delivery code stays out of the list. It's shown on the booking page, to the buyer alone.
  const d = { ...raw.data };
  delete d.otp;
  return {
    id: raw.id,
    kind: raw.kind,
    title: String(d.title ?? kindToTitle(raw.kind)),
    body: String(d.body ?? (raw.kind === "delivery_otp" ? "Open this booking to see the code to give the farmer." : "Tap to view details.")),
    booking_id: raw.booking_id ?? (d.booking_id ? String(d.booking_id) : null),
    data: d as Record<string, string>,
    read: raw.read_at !== null,
    created_at: raw.created_at,
  };
}

/** Human-readable fallback title when a notification was created without an explicit title. */
function kindToTitle(kind: string): string {
  const map: Record<string, string> = {
    booking_confirmed: "Booking confirmed",
    booking_revoked: "Booking cancelled",
    delivery_recorded: "Delivery recorded",
    delivery_arrived: "Delivery marked",
    delivery_otp: "Your delivery code",
    demand_listing_posted: "Listing posted",
    offer_accepted: "Offer accepted",
    offer_received: "New offer",
    payout_sent: "Payout sent",
    payment_received: "Wallet funded",
    new_demand: "New buyer near you",
    new_supply_listing: "New supply listing",
    backup_needed: "Urgent: backup needed",
    no_show: "No-show recorded",
  };
  return map[kind] ?? kind.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export async function GET(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  try {
    // Try the preferred RPC first (returns rows directly as an array)
    const rows = await db.rpc<RawNotification[]>("logistics_my_notifications", { p_user: user.id });
    const list = Array.isArray(rows) ? rows : [];
    return Response.json(list.map(normalise));
  } catch {
    // Fall back to money_notifications which returns { unread, items }
    try {
      const result = await db.rpc<{ unread: number; items: RawNotification[] }>(
        "money_notifications", { p_user: user.id },
      );
      const list = Array.isArray(result?.items) ? result.items : [];
      return Response.json(list.map(normalise));
    } catch {
      return Response.json([]);
    }
  }
}

export async function PATCH(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => null)) as { ids?: string[] } | null;
  if (!body?.ids?.length) return Response.json({ ok: true });

  // Try the preferred RPC, fall back to the older one
  const failed = await db.rpc("logistics_mark_notifications_read", {
    p_user: user.id,
    p_ids: body.ids,
  }).catch(() => "fallback");

  if (failed === "fallback") {
    // money_notifications_read accepts a single id or marks all; call once per id
    await Promise.all(
      body.ids.map((id) =>
        db.rpc("money_notifications_read", { p_user: user.id, p_id: id }).catch(() => null),
      ),
    );
  }

  return Response.json({ ok: true });
}
