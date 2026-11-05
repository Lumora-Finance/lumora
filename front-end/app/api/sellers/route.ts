import { connection } from "next/server";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/**
 * GET /api/sellers?area=Bukuru
 * Returns farmers and agents, optionally filtered by area.
 */
export async function GET(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const area = new URL(request.url).searchParams.get("area") ?? null;

  try {
    const rows = await db.rpc("logistics_sellers", { p_area: area });
    return Response.json(Array.isArray(rows) ? rows : []);
  } catch {
    return Response.json([]);
  }
}
