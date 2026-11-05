import { connection } from "next/server";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/**
 * The current user's demand listings (posts), most recent first.
 * Returns the fields the MyPosts component renders:
 *   id, spec, unit_price_kobo, capacity_per_day, status, commodity { id, name, unit }
 */
export async function GET(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  try {
    const rows = await db.rpc("logistics_my_listings", { p_user: user.id });
    return Response.json(rows ?? []);
  } catch {
    return Response.json([]);
  }
}
