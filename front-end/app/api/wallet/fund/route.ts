import { randomUUID } from "node:crypto";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";
import { createPaystackClient } from "@/lib/money/paystack";


/**
 * Initialises a Paystack payment to fund the wallet.
 * Returns a payment URL the client redirects to.
 *
 * POST body: { amountKobo: number, email: string }
 *
 * After payment Paystack fires charge.success → /api/webhooks/paystack
 * which calls money_credit_deposit() and credits the wallet.
 */
export async function POST(request: Request) {
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    amountKobo?: number;
    email?: string;
  } | null;

  // Minimum ₦100 = 10000 kobo
  if (!body?.amountKobo || body.amountKobo < 10_000) {
    return Response.json(
      { ok: false, code: "minimum_amount", message: "Minimum funding amount is ₦100" },
      { status: 400 },
    );
  }
  if (!body.email) {
    return Response.json(
      { ok: false, code: "email_required" },
      { status: 400 },
    );
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    // Demo mode — no real payment
    return Response.json({
      ok: true,
      demo: true,
      message: "Funding successful (demo mode — no PAYSTACK_SECRET_KEY set)",
      amountKobo: body.amountKobo,
      reference: `DEMO-${Date.now()}`,
    });
  }

  const reference = `LUMORA-FUND-${randomUUID()}`;

  // Save the funding account reference so money_credit_deposit can find the buyer.
  // The webhook handler also falls back to metadata.user_id if this lookup fails.
  try {
    await db.rpc("money_save_funding_account", {
      p_buyer: user.id,
      p_tx_ref: reference,
      p_account_number: null,
      p_bank_name: null,
      p_order_ref: null,
    });
  } catch {
    // money_save_funding_account may reject a duplicate — that's fine, the ref is unique.
  }

  const paystack = createPaystackClient(secretKey);

  const { authorizationUrl, accessCode } = await paystack.initializeTransaction({
    reference,
    amountKobo: body.amountKobo,
    email: body.email,
    callbackUrl:
      process.env.PAYSTACK_REDIRECT_URL ??
      `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/dashboard/wallet`,
    channels: ["card", "bank", "ussd", "qr", "mobile_money", "bank_transfer"],
    metadata: {
      user_id: user.id,
      custom_fields: [
        { display_name: "User", variable_name: "user_id", value: user.id },
      ],
    },
  });

  return Response.json({ ok: true, authorizationUrl, accessCode, reference });
}
