import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

export async function POST(request: Request) {
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });
  const body = (await request.json().catch(() => null)) as { approveFirstTimeFarmers?: boolean } | null;
  if (typeof body?.approveFirstTimeFarmers !== "boolean") {
    return Response.json({ ok: false, code: "invalid_setting" }, { status: 400 });
  }
  return Response.json(await db.rpc("money_set_approve_first_time", { p_buyer: user.id, p_on: body.approveFirstTimeFarmers }));
}
