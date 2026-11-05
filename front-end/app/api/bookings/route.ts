import { connection } from "next/server";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/** The viewer's bookings with full detail — delivery address, farmer/buyer info, status actions. */
export async function GET(request: Request) {
  // Personal to each request, so it must never be prerendered at build time.
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });
  try {
    const bookings = await db.rpc("logistics_full_bookings", { p_viewer: user.id });
    return Response.json(Array.isArray(bookings) ? bookings : []);
  } catch {
    // Fall back to the simpler logistics_my_bookings
    return Response.json(await db.rpc("logistics_my_bookings", { p_viewer: user.id }).catch(() => []));
  }
}
