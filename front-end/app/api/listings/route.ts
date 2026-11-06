import { connection } from "next/server";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

const CUTOFF_HOURS = 24;

/** GET /api/listings — board rows for the marketplace */
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

/** POST /api/listings — create a new demand listing */
export async function POST(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = ((await request.json().catch(() => null)) ?? {}) as {
    commodity?: string;
    unitPriceKobo?: number;
    unitPriceMinKobo?: number;
    unitPriceMaxKobo?: number;
    capacity?: number;
    minQty?: number;
    minWeight?: number;
    maxWeight?: number;
    mode?: string;
    date?: string;
    windowStart?: string;
    windowEnd?: string;
    cutoffHours?: number;
    address?: string;
    spec?: string;
    images?: string[];
  };

  // Basic format checks (the DB re-validates these too, but gives clearer errors up front)
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(body.date ?? "") ||
    !/^\d{2}:\d{2}$/.test(body.windowStart ?? "") ||
    !/^\d{2}:\d{2}$/.test(body.windowEnd ?? "")
  ) {
    return Response.json({ ok: false, code: "invalid_window" }, { status: 400 });
  }

  // Accept either unitPriceKobo (the primary field sent by listingBody) or unitPriceMaxKobo as fallback
  const priceMaxKobo = body.unitPriceKobo ?? body.unitPriceMaxKobo;
  if (!Number.isSafeInteger(priceMaxKobo) || !priceMaxKobo || priceMaxKobo <= 0) {
    return Response.json({ ok: false, code: "invalid_numbers", message: "Enter a valid price." }, { status: 400 });
  }

  // Min price: buyers post a range (min–max). If no min is given, min = max (fixed price).
  const priceMinKobo = body.unitPriceMinKobo ?? priceMaxKobo;
  if (!Number.isSafeInteger(priceMinKobo) || priceMinKobo <= 0 || priceMinKobo > priceMaxKobo) {
    return Response.json({ ok: false, code: "invalid_numbers", message: "Minimum price must be between 1 and the maximum price." }, { status: 400 });
  }

  const result = await db.rpc("logistics_create_listing", {
    p_buyer: user.id,
    p_commodity: body.commodity ?? "",
    p_unit_price_kobo: priceMaxKobo,
    p_unit_price_min_kobo: priceMinKobo,
    p_capacity: body.capacity ?? null,
    p_min_qty: body.minQty ?? 1,
    p_min_weight: body.minWeight ?? null,
    p_max_weight: body.maxWeight ?? null,
    p_mode: body.mode ?? "farmer_delivers",
    p_date: body.date,
    p_window_start: body.windowStart,
    p_window_end: body.windowEnd,
    p_cutoff_hours: body.cutoffHours ?? CUTOFF_HOURS,
    p_address: body.address ?? null,
    p_spec: body.spec ?? null,
    p_now: new Date().toISOString(),
    p_images: body.images && body.images.length > 0 ? body.images : null,
  }).catch((err: Error) => ({ ok: false, code: "db_error", message: err.message } as { ok: false; code: string; message: string }));

  if (!result.ok) {
    return Response.json(result, { status: 400 });
  }

  const listingId = (result as { listing_id?: string }).listing_id;

  const escrowResult = await db.rpc("logistics_escrow_listing", {
    p_buyer: user.id,
    p_listing: listingId,
    p_price_kobo: priceMaxKobo,
    p_capacity: body.capacity ?? 1,
  }).catch((err: Error) => ({ ok: false, message: err.message } as { ok: false; message: string }));

  if (!escrowResult.ok) {
    return Response.json({
      ...result,
      escrow_warning: "Listing created but escrow failed. Contact support if funds are not held.",
    });
  }

  return Response.json({ ...result, escrowed_kobo: (escrowResult as { escrowed_kobo?: number }).escrowed_kobo });
}
