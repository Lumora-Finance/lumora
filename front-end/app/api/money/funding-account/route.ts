import { randomUUID } from "node:crypto";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";
import { createFlutterwaveClient } from "@/lib/money/flutterwave";

/** A buyer's permanent bank transfer account. Bank transfer is the only way to fund in the pilot. */
export async function POST(request: Request) {
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const existing = await db.rpc("money_get_funding_account", { p_buyer: user.id });
  if (existing) return Response.json(existing);

  const body = (await request.json().catch(() => null)) as { bvn?: string; email?: string } | null;
  if (!/^\d{11}$/.test(body?.bvn ?? "") || !body?.email) {
    return Response.json({ ok: false, code: "bvn_and_email_required" }, { status: 400 });
  }
  const txRef = `LUMORA-${randomUUID()}`;
  const account = await createFlutterwaveClient().createVirtualAccount({
    txRef,
    email: body.email,
    bvn: body.bvn as string,
    name: user.name,
  });
  return Response.json(
    await db.rpc("money_save_funding_account", {
      p_buyer: user.id,
      p_tx_ref: txRef,
      p_account_number: account.accountNumber,
      p_bank_name: account.bankName,
      p_order_ref: account.orderRef,
    }),
  );
}
