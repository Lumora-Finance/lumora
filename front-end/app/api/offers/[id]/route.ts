import { connection } from "next/server";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/**
 * POST /api/offers/[id]/accept — buyer accepts a farmer's offer
 * Requires PIN verification on the client side before calling.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const result = await db.rpc("logistics_accept_offer", {
    p_buyer: user.id,
    p_offer: id,
    p_now: new Date().toISOString(),
  });

  return Response.json(result, { status: result.ok ? 200 : 400 });
}
