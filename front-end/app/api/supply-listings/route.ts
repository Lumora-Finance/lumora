import { connection } from "next/server";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/** GET /api/supply-listings — all active supply listings (marketplace). */
export async function GET(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  try {
    const rows = await db.rpc("logistics_supply_board", {});
    return Response.json(Array.isArray(rows) ? rows : []);
  } catch {
    return Response.json([]);
  }
}

/** POST /api/supply-listings — create a new supply listing. */
export async function POST(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = ((await request.json().catch(() => null)) ?? {}) as {
    title?: string; description?: string; commodity?: string;
    unitPriceKobo?: number; qty?: number; unit?: string; images?: string[];
  };

  if (!body.title?.trim()) return Response.json({ ok: false, code: "title_required" }, { status: 400 });
  if (!body.unitPriceKobo || body.unitPriceKobo <= 0) return Response.json({ ok: false, code: "invalid_numbers" }, { status: 400 });
  if (!body.qty || body.qty <= 0) return Response.json({ ok: false, code: "invalid_numbers" }, { status: 400 });
  if (!body.images || body.images.length < 1 || body.images.length > 4) {
    return Response.json({ ok: false, code: "images_required", message: "Add 1 to 4 photos." }, { status: 400 });
  }

  try {
    const result = await db.rpc("logistics_create_supply_listing", {
      p_farmer: user.id,
      p_title: body.title.trim(),
      p_description: body.description ?? null,
      p_commodity: body.commodity ?? null,
      p_unit_price_kobo: body.unitPriceKobo,
      p_qty: body.qty,
      p_unit: body.unit ?? "kg",
      p_images: body.images,
    }) as { ok: boolean; code?: string; listing_id?: string };

    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("supply-listings POST failed:", message);
    return Response.json({ ok: false, code: "db_error", message }, { status: 500 });
  }
}
