import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

type Body = {
  commodity?: string; unitPriceKobo?: number; capacity?: number; minQty?: number; minWeight?: number; maxWeight?: number;
  mode?: string; date?: string; windowStart?: string; windowEnd?: string; cutoffHours?: number; address?: string; spec?: string;
};

export async function POST(request: Request) {
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = ((await request.json().catch(() => null)) ?? {}) as Body;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date ?? "") || !/^\d{2}:\d{2}$/.test(body.windowStart ?? "") || !/^\d{2}:\d{2}$/.test(body.windowEnd ?? "")) {
    return Response.json({ ok: false, code: "invalid_window" }, { status: 400 });
  }
  if (!Number.isSafeInteger(body.unitPriceKobo)) return Response.json({ ok: false, code: "invalid_numbers" }, { status: 400 });

  const result = await db.rpc("logistics_create_listing", {
    p_buyer: user.id,
    p_commodity: body.commodity ?? "",
    p_unit_price_kobo: body.unitPriceKobo,
    p_capacity: body.capacity ?? null,
    p_min_qty: body.minQty ?? 1,
    p_min_weight: body.minWeight ?? null,
    p_max_weight: body.maxWeight ?? null,
    p_mode: body.mode ?? "farmer_delivers",
    p_date: body.date,
    p_window_start: body.windowStart,
    p_window_end: body.windowEnd,
    p_cutoff_hours: body.cutoffHours ?? 24,
    p_address: body.address ?? null,
    p_spec: body.spec ?? null,
  });
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
