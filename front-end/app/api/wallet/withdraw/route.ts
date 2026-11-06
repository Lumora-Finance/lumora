import { connection } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";
import { createPaystackClient } from "@/lib/money/paystack";

/**
 * POST /api/wallet/withdraw
 * Body: { amountKobo, bankName, bankCode, accountNumber, accountName }
 *
 * Creates a real Paystack transfer to the user's bank account.
 * The withdrawal request is saved to withdrawal_requests for audit.
 * The transfer webhook updates the status when Paystack confirms it.
 */
export async function POST(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    amountKobo?: number;
    bankName?: string;
    bankCode?: string;
    accountNumber?: string;
    accountName?: string;
  } | null;

  // Minimum ₦500 = 50_000 kobo
  if (!body?.amountKobo || body.amountKobo < 50_000) {
    return Response.json(
      { ok: false, code: "minimum_amount", error: "Minimum withdrawal is ₦500" },
      { status: 400 },
    );
  }
  if (!body.bankName || !body.accountNumber || !body.accountName || !body.bankCode) {
    return Response.json(
      { ok: false, code: "missing_fields", error: "All bank details are required (bank name, bank code, account number, account name)" },
      { status: 400 },
    );
  }
  if (!/^\d{10}$/.test(body.accountNumber)) {
    return Response.json(
      { ok: false, code: "invalid_account", error: "Account number must be 10 digits" },
      { status: 400 },
    );
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return Response.json(
      { ok: false, code: "no_paystack_key", error: "Paystack is not configured. Set PAYSTACK_SECRET_KEY." },
      { status: 500 },
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // Check the user has enough balance
  const { data: balances } = await supabase
    .from("money_balances")
    .select("bucket, balance_kobo")
    .eq("owner_id", user.id);

  const balanceMap = Object.fromEntries(
    (balances ?? []).map((b: { bucket: string; balance_kobo: number }) => [b.bucket, b.balance_kobo]),
  );
  const available = balanceMap["buyer_available"] ?? balanceMap["farmer_pending"] ?? 0;

  if (body.amountKobo > available) {
    return Response.json(
      { ok: false, code: "insufficient_funds", error: `Insufficient balance. You have ₦${(available / 100).toLocaleString("en-NG")}.` },
      { status: 400 },
    );
  }

  const paystack = createPaystackClient(secretKey);
  const reference = `LUMORA-WD-${randomUUID()}`;

  try {
    // 1. Create a transfer recipient on Paystack
    const recipientCode = await paystack.createTransferRecipient({
      bankCode: body.bankCode,
      accountNumber: body.accountNumber,
      accountName: body.accountName,
    });

    // 2. Initiate the transfer on Paystack
    const transfer = await paystack.createTransfer({
      reference,
      amountKobo: body.amountKobo,
      recipientCode,
      reason: `Lumora withdrawal — ${user.name ?? user.phone}`,
    });

    // 3. Record the withdrawal atomically in money_ledger + withdrawal_requests.
    //    money_record_withdrawal debits buyer_available/farmer_pending → external
    //    and inserts the withdrawal_requests row in one transaction.
    const result = await db.rpc<{ ok: boolean; code?: string; withdrawal_id?: string }>(
      "money_record_withdrawal",
      {
        p_user_id: user.id,
        p_amount_kobo: body.amountKobo,
        p_bank_name: body.bankName,
        p_bank_code: body.bankCode,
        p_account_number: body.accountNumber,
        p_account_name: body.accountName,
        p_transfer_reference: reference,
      },
    );

    if (!result?.ok) {
      return Response.json(
        { ok: false, code: result?.code ?? "ledger_failed", error: "Could not record withdrawal" },
        { status: 500 },
      );
    }

    // 4. Update the withdrawal request with the Paystack transfer code
    await supabase
      .from("withdrawal_requests")
      .update({ transfer_code: transfer.id?.toString() ?? null })
      .eq("transfer_reference", reference);

    return Response.json({
      ok: true,
      reference,
      status: "pending",
      transferStatus: transfer.status,
      message: `Withdrawal of ₦${(body.amountKobo / 100).toLocaleString("en-NG")} to ${body.bankName} (${body.accountName}) is being processed.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Withdrawal failed";
    // Save the failed attempt for audit (best-effort)
    await supabase.from("withdrawal_requests").insert({
      user_id: user.id,
      amount_kobo: body.amountKobo,
      bank_name: body.bankName,
      bank_code: body.bankCode,
      account_number: body.accountNumber,
      account_name: body.accountName,
      status: "failed",
      transfer_reference: reference,
      admin_note: `Paystack error: ${message}`,
    }).then(() => {});

    return Response.json(
      { ok: false, code: "transfer_failed", error: message },
      { status: 500 },
    );
  }
}
