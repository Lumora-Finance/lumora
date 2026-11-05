import { connection } from "next/server";

import { buildBoard, type BoardSort, type RawBoard } from "@/lib/logistics/board";
import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

export async function GET(request: Request) {
  // Personal to each request, so it must never be prerendered at build time.
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const sort: BoardSort = new URL(request.url).searchParams.get("sort") === "nearest" ? "nearest" : "price";
  const raw = await db.rpc<RawBoard>("logistics_board", { p_farmer: user.id });
  return Response.json({
    area: raw.farmer_area?.name ?? null,
    cards: buildBoard(raw, sort),
    stock: raw.stock ?? {},
    follows: raw.follows ?? [],
    reliability: raw.reliability ?? { on_time: 0, total: 0 },
    completedDeliveries: raw.completed_deliveries ?? 0,
  });
}
