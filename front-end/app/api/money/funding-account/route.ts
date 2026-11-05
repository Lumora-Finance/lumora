import { randomUUID } from "node:crypto";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";
import { createPaystackClient } from "@/lib/money/paystack";


/**
 * Creates (or returns the existing) dedicated virtual account for a buyer.
 * The buyer sends money to this account; Paystack fires a charge.success webhook
 * which credits the wallet via money_credit_deposit().
 *
 * POST body: { email: string, firstName: string, lastName: string, phone?: string }
 */
export async function POST(request: Request) {
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Return existing account if already created
  const existing = await db.rpc("money_get_funding_account", { p_buyer: user.id });
  if (existing) return Response.json(existing);

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  } | null;

  if (!body?.email || !body?.firstName || !body?.lastName) {
    return Response.json(
      { ok: false, code: "email_and_name_required" },
      { status: 400 },
    );
  }

  const paystack = createPaystackClient();

  // 1. Create Paystack customer
  const customerCode = await paystack.createCustomer({
    email: body.email,
    firstName: body.firstName,
    lastName: body.lastName,
    phone: body.phone,
  });

  // 2. Assign a dedicated virtual account to the customer
  const account = await paystack.createDedicatedVirtualAccount({
    customerId: customerCode,
  });

  const txRef = `LUMORA-${randomUUID()}`;

  return Response.json(
    await db.rpc("money_save_funding_account", {
      p_buyer: user.id,
      p_tx_ref: txRef,
      p_account_number: account.accountNumber,
      p_bank_name: account.bankName,
      p_order_ref: customerCode,
    }),
  );
}
