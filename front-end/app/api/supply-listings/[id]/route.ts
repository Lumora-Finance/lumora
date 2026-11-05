import { connection } from "next/server";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/** GET /api/supply-listings/[id] — full supply listing detail. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const data = await db.rpc("logistics_get_supply_listing", { p_listing: id });
  if (!data) return Response.json({ ok: false, code: "not_found" }, { status: 404 });
  return Response.json(data);
}

/** PATCH /api/supply-listings/[id] — pause/unpause or delete a supply listing. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { action?: "pause" | "delete" } | null;
  if (!body?.action) return Response.json({ ok: false, code: "missing_action" }, { status: 400 });

  if (body.action === "pause") {
    const result = await db.rpc("logistics_pause_supply_listing", { p_listing: id, p_farmer: user.id });
    return Response.json(result, { status: result.ok ? 200 : 403 });
  }

  if (body.action === "delete") {
    const result = await db.rpc("logistics_delete_supply_listing", { p_listing: id, p_farmer: user.id });
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }

  return Response.json({ ok: false, code: "unknown_action" }, { status: 400 });
}
