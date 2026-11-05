import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

export async function POST(request: Request) {
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });
  const body = (await request.json().catch(() => null)) as { commodity?: string } | null;
  const result = await db.rpc("logistics_follow_commodity", { p_farmer: user.id, p_commodity: body?.commodity ?? "" });
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
