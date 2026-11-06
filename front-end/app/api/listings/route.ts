import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";
import { ownListingImages } from "@/lib/logistics/listing-draft";
import { formatKobo } from "@/lib/money/rules";

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

  // One transaction: the money moves into escrow and the demand is posted, or neither happens.
  type PostResult = {
    ok: boolean; code?: string; message?: string; listing_id?: string; required_kobo?: number; balance_kobo?: number;
  };
  const result = await db.rpc<PostResult>("logistics_post_demand", {
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
  }).catch((err: Error): PostResult => ({ ok: false, code: "db_error", message: err.message }));

  if (!result.ok) {
    if (result.code === "insufficient_balance") {
      const required = Number(result.required_kobo ?? 0);
      const balance = Number(result.balance_kobo ?? 0);
      return Response.json({
        ...result,
        message: `This demand needs ${formatKobo(required)} in escrow, and your wallet has ${formatKobo(balance)}. Add ${formatKobo(required - balance)} to post it.`,
      }, { status: 400 });
    }
    return Response.json(result, { status: 400 });
  }

  const listingId = result.listing_id;

  // The database function takes the photos but doesn't store them, so they're saved here. A demand
  // that's already posted and funded stays posted if this fails: it just shows without a photo.
  const images = ownListingImages(body.images, process.env.NEXT_PUBLIC_SUPABASE_URL, user.id);
  if (listingId && images.length > 0) {
    const { data: updated, error } = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    }).from("demand_listings").update({ images }).eq("id", listingId).eq("buyer_id", user.id).select("id");
    if (error) {
      console.error("Saving listing photos failed — DB error", listingId, error.message);
    } else if (!updated || updated.length === 0) {
      // 0-row update: listing exists (we just created it) but buyer_id doesn't match — log the mismatch
      console.error("Saving listing photos failed — 0 rows updated (buyer_id mismatch?)", listingId, "user:", user.id);
    }
  }

  // Notify the buyer that their listing is live
  if (listingId) {
    const { notifyListingCreated } = await import("@/lib/notify");
    void notifyListingCreated(db, user.id, {
      listingId: String(listingId),
      commodity: body.commodity ?? "produce",
      priceKobo: priceMaxKobo,
      capacity: body.capacity ?? 0,
    }).catch(() => null);
  }

  return Response.json(result);
}
