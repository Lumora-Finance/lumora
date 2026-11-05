import { verifyActionToken } from "@/lib/email/action-tokens";
import { requestUser } from "@/lib/money/auth";
import { type MoneyResult, serverMoneyDb } from "@/lib/money/db";

type Body = { token?: string; perform?: boolean; claimKg?: number };

/**
 * Email action links. POST and a signed-in user are both required, so nothing that merely fetches a
 * link, such as a mail scanner, can reach this. Without `perform` it only reads what the link is for.
 */
export async function POST(request: Request) {
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = ((await request.json().catch(() => null)) ?? {}) as Body;
  const verified = verifyActionToken(body.token ?? "", process.env.EMAIL_ACTION_SECRET);
  if (!verified.ok) return Response.json({ ok: false, code: verified.code }, { status: 410 });

  const result = await db.rpc<MoneyResult>(body.perform ? "money_action_perform" : "money_action_preview", {
    p_token: verified.id,
    p_user: user.id,
    ...(body.perform ? { p_claim_kg: body.claimKg ?? null } : {}),
  });
  return Response.json(result, { status: result.ok ? 200 : 409 });
}
