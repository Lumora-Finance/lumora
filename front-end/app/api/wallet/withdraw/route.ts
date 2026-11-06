import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";
import { notify } from "@/lib/notify";

/**
 * POST /api/wallet/withdraw
 * Body: { amountKobo, bankName, bankCode, accountNumber, accountName }
 *
 * Queues a withdrawal as "pending". Admin reviews in the admin panel,
 * manually sends the money, then approves or rejects.
 *
 * Fee: 1.5% of amountKobo — the user receives (amountKobo − fee).
 * The full amountKobo is debited from the wallet immediately via
 * money_record_withdrawal() and held until the admin resolves it.
 */

const WITHDRAWAL_FEE_PCT = 0.015; // 1.5%
const MIN_WITHDRAWAL_KOBO = 50_000; // ₦500

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

  // ── Validate ─────────────────────────────────────────────────────────────
  if (!body?.amountKobo || body.amountKobo < MIN_WITHDRAWAL_KOBO) {
    return Response.json(
      { ok: false, code: "minimum_amount", error: "Minimum withdrawal is ₦500" },
      { status: 400 },
    );
  }
  if (!body.bankName || !body.accountNumber || !body.accountName || !body.bankCode) {
    return Response.json(
      { ok: false, code: "missing_fields", error: "All bank details are required" },
      { status: 400 },
    );
  }
  if (!/^\d{10}$/.test(body.accountNumber)) {
    return Response.json(
      { ok: false, code: "invalid_account", error: "Account number must be 10 digits" },
      { status: 400 },
    );
  }

  // ── Compute fee ───────────────────────────────────────────────────────────
  const feeKobo = Math.floor(body.amountKobo * WITHDRAWAL_FEE_PCT);
  const netKobo = body.amountKobo - feeKobo;

  // ── Debit wallet + create withdrawal_requests row atomically ─────────────
  const result = await db.rpc<{ ok: boolean; code?: string; withdrawal_id?: string }>(
    "money_record_withdrawal",
    {
      p_user_id: user.id,
      p_amount_kobo: body.amountKobo,
      p_fee_kobo: feeKobo,
      p_net_kobo: netKobo,
      p_bank_name: body.bankName,
      p_bank_code: body.bankCode,
      p_account_number: body.accountNumber,
      p_account_name: body.accountName,
      p_transfer_reference: null,
    },
  );

  if (!result?.ok) {
    const code = result?.code ?? "ledger_failed";
    const msg = code === "insufficient_funds"
      ? "Insufficient balance for this withdrawal."
      : "Could not record withdrawal. Please try again.";
    return Response.json({ ok: false, code, error: msg }, { status: code === "insufficient_funds" ? 400 : 500 });
  }

  const wrId = result.withdrawal_id ?? null;

  // ── In-app notification to the user ──────────────────────────────────────
  const gross = `₦${(body.amountKobo / 100).toLocaleString("en-NG")}`;
  const net = `₦${(netKobo / 100).toLocaleString("en-NG")}`;
  void notify(db, {
    userId: user.id,
    kind: "payment_pending",
    title: "Withdrawal submitted",
    body: `Your request to withdraw ${gross} is pending admin review. After the 1.5% fee you will receive ${net}.`,
    data: { withdrawal_id: wrId ?? "" },
  }).catch(() => null);

  return Response.json({
    ok: true,
    status: "pending",
    amountKobo: body.amountKobo,
    feeKobo,
    netKobo,
    withdrawalId: wrId,
    message: `Withdrawal of ${gross} submitted. After the 1.5% processing fee you will receive ${net} once an admin approves your request.`,
  });
}
