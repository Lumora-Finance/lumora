import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

const DECISIONS = new Set(["pay_recorded", "pay_booked_minimum", "custom"]);

export async function GET(request: Request) {
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (user?.role !== "admin") return new Response("Forbidden", { status: 403 });
  return Response.json(await db.rpc("money_admin_disputes"));
}

export async function POST(request: Request) {
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (user?.role !== "admin") return new Response("Forbidden", { status: 403 });

  const body = (await request.json().catch(() => null)) as
    | { disputeId?: string; decision?: string; customKobo?: number }
    | null;
  if (!body?.disputeId || !body.decision || !DECISIONS.has(body.decision)) {
    return Response.json({ ok: false, code: "invalid_decision" }, { status: 400 });
  }
  if (body.decision === "custom" && !Number.isSafeInteger(body.customKobo)) {
    return Response.json({ ok: false, code: "custom_out_of_range" }, { status: 400 });
  }

  const result = await db.rpc("money_resolve_dispute", {
    p_dispute: body.disputeId,
    p_decision: body.decision,
    p_custom_kobo: body.customKobo ?? null,
    p_actor: user.id,
  });
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
