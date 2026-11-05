import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

export async function POST(request: Request) {
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });
  const body = (await request.json().catch(() => null)) as { commodity?: string; qty?: number } | null;
  const result = await db.rpc("logistics_declare_stock", {
    p_farmer: user.id, p_commodity: body?.commodity ?? "", p_qty: body?.qty ?? null,
  });
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
