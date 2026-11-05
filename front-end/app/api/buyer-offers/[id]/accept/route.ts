import { connection } from "next/server";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/** POST /api/buyer-offers/[id]/accept — farmer accepts a buyer's offer on their supply listing. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const result = await db.rpc("logistics_accept_buyer_offer", {
    p_farmer: user.id,
    p_offer: id,
    p_now: new Date().toISOString(),
  });

  return Response.json(result, { status: result.ok ? 200 : 400 });
}
