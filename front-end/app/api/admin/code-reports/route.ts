import { connection } from "next/server";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

const DECISIONS = new Set(["buyer_fault", "farmer_fault", "no_fault"]);

export async function GET(request: Request) {
  // Personal to each request, so it must never be prerendered at build time.
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (user?.role !== "admin") return new Response("Forbidden", { status: 403 });
  return Response.json(await db.rpc("money_admin_code_reports"));
}

export async function POST(request: Request) {
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (user?.role !== "admin") return new Response("Forbidden", { status: 403 });

  const body = (await request.json().catch(() => null)) as { reportId?: string; decision?: string } | null;
  if (!body?.reportId || !body.decision || !DECISIONS.has(body.decision)) {
    return Response.json({ ok: false, code: "invalid_decision" }, { status: 400 });
  }
  const result = await db.rpc("money_resolve_code_report", {
    p_report: body.reportId, p_decision: body.decision, p_actor: user.id,
  });
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
