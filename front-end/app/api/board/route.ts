import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { buildBoard, type BoardSort, type RawBoard } from "@/lib/logistics/board";
import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/** Each listing's photos and buyer, which the board's own query leaves out. The board still works without them. */
async function withListingDetails(raw: RawBoard): Promise<RawBoard> {
  const ids = raw.rows.map((row) => row.listing_id);
  if (ids.length === 0) return raw;
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data } = await supabase.from("demand_listings").select("id, images, buyer_id").in("id", ids);
    const details = new Map((data ?? []).map((listing) => [listing.id as string, listing]));
    return {
      ...raw,
      rows: raw.rows.map((row) => ({
        ...row,
        images: (details.get(row.listing_id)?.images as string[] | null) ?? [],
        buyer_id: details.get(row.listing_id)?.buyer_id as string | undefined,
      })),
    };
  } catch {
    return raw;
  }
}

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
    cards: buildBoard(await withListingDetails(raw), sort),
    stock: raw.stock ?? {},
    follows: raw.follows ?? [],
    reliability: raw.reliability ?? { on_time: 0, total: 0 },
    completedDeliveries: raw.completed_deliveries ?? 0,
  });
}
