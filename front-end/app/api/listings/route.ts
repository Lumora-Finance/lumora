import { connection } from "next/server";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/**
 * GET /api/listings — all active listings (marketplace board).
 * Returns listings directly from the DB, not filtered by slot cutoff,
 * so buyers can see their own posts immediately after creation.
 */
export async function GET(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  try {
    const rows = await db.rpc("logistics_board_rows", { p_now: new Date().toISOString() });
    return Response.json(Array.isArray(rows) ? rows : []);
  } catch {
    return Response.json([]);
  }
}

/**
 * POST /api/listings — create a new demand listing.
 * Validates balance, enforces min 5-hour lead time, escrowed immediately.
 */
export async function POST(request: Request) {
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = ((await request.json().catch(() => null)) ?? {}) as {
    commodity?: string; unitPriceKobo?: number; capacity?: number; minQty?: number;
    minWeight?: number; maxWeight?: number; mode?: string; date?: string;
    windowStart?: string; windowEnd?: string; cutoffHours?: number; address?: string; spec?: string;
    images?: string[];
  };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date ?? "") ||
    !/^\d{2}:\d{2}$/.test(body.windowStart ?? "") ||
    !/^\d{2}:\d{2}$/.test(body.windowEnd ?? "")) {
    return Response.json({ ok: false, code: "invalid_window" }, { status: 400 });
  }
  if (!Number.isSafeInteger(body.unitPriceKobo) || !body.unitPriceKobo) {
    return Response.json({ ok: false, code: "invalid_numbers" }, { status: 400 });
  }

  // Enforce minimum 5-hour lead time from now
  const windowStart = new Date(`${body.date}T${body.windowStart}:00`);
  const fiveHoursFromNow = new Date(Date.now() + 5 * 60 * 60 * 1000);
  if (windowStart < fiveHoursFromNow) {
    return Response.json({
      ok: false,
      code: "too_soon",
      message: "Delivery window must be at least 5 hours from now.",
    }, { status: 400 });
  }

  // Check buyer has sufficient balance for the full listing
  const balanceCheck = await db.rpc("logistics_check_buyer_balance", {
    p_buyer: user.id,
    p_price_kobo: body.unitPriceKobo,
    p_capacity: body.capacity ?? 1,
  });

  if (!balanceCheck?.ok) {
    const required = ((body.unitPriceKobo ?? 0) * (body.capacity ?? 1)) / 100;
    const balance = (Number(balanceCheck?.balance_kobo ?? 0)) / 100;
    return Response.json({
      ok: false,
      code: "insufficient_balance",
      message: `You need ₦${required.toLocaleString("en-NG")} to post this demand. Your balance is ₦${balance.toLocaleString("en-NG")}. Fund your wallet first.`,
    }, { status: 400 });
  }

  // Create the listing
  const result = await db.rpc("logistics_create_listing", {
    p_buyer: user.id,
    p_commodity: body.commodity ?? "",
    p_unit_price_kobo: body.unitPriceKobo,
    p_capacity: body.capacity ?? null,
    p_min_qty: body.minQty ?? 1,
    p_min_weight: body.minWeight ?? null,
    p_max_weight: body.maxWeight ?? null,
    p_mode: body.mode ?? "farmer_delivers",
    p_date: body.date,
    p_window_start: body.windowStart,
    p_window_end: body.windowEnd,
    p_cutoff_hours: body.cutoffHours ?? 24,
    p_address: body.address ?? null,
    p_spec: body.spec ?? null,
    p_images: body.images ?? [],
  });

  if (!result.ok) {
    return Response.json(result, { status: 400 });
  }

  // Escrow the full amount immediately
  const escrowResult = await db.rpc("logistics_escrow_listing", {
    p_buyer: user.id,
    p_listing: result.listing_id,
    p_price_kobo: body.unitPriceKobo,
    p_capacity: body.capacity ?? 1,
  });

  if (!escrowResult.ok) {
    // This shouldn't happen since we checked balance above, but handle gracefully
    return Response.json({
      ...result,
      escrow_warning: "Listing created but escrow failed. Contact support.",
    });
  }

  return Response.json({ ...result, escrowed_kobo: escrowResult.escrowed_kobo });
}
