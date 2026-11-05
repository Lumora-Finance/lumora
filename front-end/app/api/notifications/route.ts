import { connection } from "next/server";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/**
 * GET /api/notifications — get all notifications for the current user
 * PATCH /api/notifications — mark notifications as read
 * Body for PATCH: { ids: string[] }
 */
export async function GET(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  try {
    const notifications = await db.rpc("logistics_my_notifications", { p_user: user.id });
    return Response.json(Array.isArray(notifications) ? notifications : []);
  } catch {
    return Response.json([]);
  }
}

export async function PATCH(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => null)) as { ids?: string[] } | null;
  if (!body?.ids?.length) return Response.json({ ok: true });

  await db.rpc("logistics_mark_notifications_read", {
    p_user: user.id,
    p_ids: body.ids,
  }).catch(() => null);

  return Response.json({ ok: true });
}
