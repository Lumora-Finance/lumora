import { connection } from "next/server";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/**
 * The current user's recent settled deliveries (transactions), newest first.
 * Returns the fields the RecentTransactions component renders:
 *   id, gross_kobo, fees_kobo, net_kobo, kind, created_at,
 *   booking { code, slot { listing { spec, commodity { name, unit }, buyer { id, name } } }, farmer { id, name } }
 */
export async function GET(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  try {
    const rows = await db.rpc("logistics_my_transactions", { p_user: user.id });
    return Response.json(rows ?? []);
  } catch {
    return Response.json([]);
  }
}
