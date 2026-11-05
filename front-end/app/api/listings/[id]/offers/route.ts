import { connection } from "next/server";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/** GET /api/listings/[id]/offers — all offers on a listing (buyer sees all, farmer sees own) */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  try {
    const offers = await db.rpc("logistics_listing_offers", {
      p_listing: id,
      p_viewer: user.id,
    });
    return Response.json(Array.isArray(offers) ? offers : []);
  } catch {
    return Response.json([]);
  }
}
