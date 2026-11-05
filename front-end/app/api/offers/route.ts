import { connection } from "next/server";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/**
 * POST /api/offers — farmer makes an offer on a listing
 * Body: { listingId, qty, note? }
 * Requires PIN verification on the client side before calling.
 */
export async function POST(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    listingId?: string;
    qty?: number;
    note?: string;
  } | null;

  if (!body?.listingId || !body?.qty || body.qty < 1) {
    return Response.json({ ok: false, code: "invalid_input" }, { status: 400 });
  }

  const result = await db.rpc("logistics_make_offer", {
    p_farmer: user.id,
    p_listing: body.listingId,
    p_qty: body.qty,
    p_note: body.note ?? null,
  });

  return Response.json(result, { status: result.ok ? 200 : 400 });
}
