import { connection } from "next/server";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/** One booking, as this viewer's side sees it. The database checks they're on it. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Personal to each request, so it must never be prerendered at build time.
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const view = await db.rpc("money_booking_view", { p_booking: id, p_viewer: user.id });
  return Response.json(view, { status: view.ok ? 200 : 404 });
}
