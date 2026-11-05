import { connection } from "next/server";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/**
 * GET /api/listings/[id] — full listing detail by ID.
 * PATCH /api/listings/[id] — edit, pause/unpause, or delete a listing.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const data = await db.rpc("logistics_get_listing", { p_listing: id });
  if (!data) return Response.json({ ok: false, code: "not_found" }, { status: 404 });
  return Response.json(data);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;

  const body = (await request.json().catch(() => null)) as {
    action?: "pause" | "delete" | "edit";
    spec?: string;
    unitPriceKobo?: number;
    capacity?: number;
  } | null;

  if (!body?.action) return Response.json({ ok: false, code: "missing_action" }, { status: 400 });

  if (body.action === "pause") {
    const result = await db.rpc("logistics_pause_listing", { p_listing: id, p_buyer: user.id });
    return Response.json(result, { status: result.ok ? 200 : 403 });
  }

  if (body.action === "delete") {
    const result = await db.rpc("logistics_delete_listing", { p_listing: id, p_buyer: user.id });
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }

  if (body.action === "edit") {
    if (!body.unitPriceKobo || !body.capacity) {
      return Response.json({ ok: false, code: "missing_fields" }, { status: 400 });
    }
    const result = await db.rpc("logistics_edit_listing", {
      p_listing: id,
      p_buyer: user.id,
      p_spec: body.spec ?? "",
      p_unit_price_kobo: body.unitPriceKobo,
      p_capacity: body.capacity,
    });
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }

  return Response.json({ ok: false, code: "unknown_action" }, { status: 400 });
}
