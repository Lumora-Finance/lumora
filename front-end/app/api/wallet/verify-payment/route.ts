import { connection } from "next/server";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";
import { createPaystackClient } from "@/lib/money/paystack";

/**
 * POST /api/wallet/verify-payment
 * Body: { reference: string }
 *
 * Called immediately when Paystack redirects back — verifies and credits
 * the wallet on the spot so balance updates without waiting for a webhook.
 * money_credit_deposit is idempotent, so the webhook calling it again is fine.
 */
export async function POST(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => null)) as { reference?: string } | null;
  const reference = body?.reference?.trim();

  if (!reference?.startsWith("LUMORA-FUND-")) {
    return Response.json({ ok: false, code: "invalid_reference" }, { status: 400 });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return Response.json({ ok: false, code: "no_paystack_key" }, { status: 500 });
  }

  try {
    const paystack = createPaystackClient(secretKey);
    const verified = await paystack.verifyTransaction(reference);

    if (verified.status !== "success") {
      return Response.json({ ok: false, code: "not_successful", status: verified.status });
    }

    const result = await db.rpc("money_credit_deposit", {
      p_tx_id: verified.id,
      p_tx_ref: verified.reference,
      p_amount: verified.amountKobo,
      p_provider_fee: verified.feeKobo ?? 0,
      p_payment_type: verified.paymentChannel ?? "unknown",
      p_now: new Date().toISOString(),
    }) as { ok?: boolean; duplicate?: boolean; code?: string };

    return Response.json({
      ok: true,
      duplicate: result.duplicate ?? false,
      amountKobo: verified.amountKobo,
      message: `Added to your wallet`,
    });
  } catch (err) {
    return Response.json({
      ok: false,
      code: "failed",
      message: err instanceof Error ? err.message : "Could not verify payment",
    }, { status: 500 });
  }
}
