import { connection } from "next/server";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/** The viewer's bookings. Phone and address come from a function that checks they're on the booking. */
export async function GET(request: Request) {
  // Personal to each request, so it must never be prerendered at build time.
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });
  return Response.json(await db.rpc("logistics_my_bookings", { p_viewer: user.id }));
}
