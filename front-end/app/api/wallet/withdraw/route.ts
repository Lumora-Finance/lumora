import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/**
 * POST /api/wallet/withdraw
 * Body: { amountKobo, bankName, accountNumber, accountName }
 *
 * Saves a pending withdrawal request to the database.
 * An admin reviews and approves it from /admin/withdrawals.
 */
export async function POST(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    amountKobo?: number;
    bankName?: string;
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
  if (!body.bankName || !body.accountNumber || !body.accountName) {
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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase
    .from("withdrawal_requests")
    .insert({
      user_id: user.id,
      amount_kobo: body.amountKobo,
      bank_name: body.bankName,
      account_number: body.accountNumber,
      account_name: body.accountName,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    requestId: data.id,
    status: "pending",
    message: `Withdrawal of ₦${(body.amountKobo / 100).toLocaleString("en-NG")} submitted. Admin will process within 24 hours.`,
  });
}
