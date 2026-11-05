import { requestUser } from "@/lib/money/auth";
import { addPayoutAccount } from "@/lib/money/booking";
import { serverMoneyDb } from "@/lib/money/db";
import { createPaystackClient, PaystackRejected } from "@/lib/money/paystack";


/**
 * Adds or verifies a farmer's bank account for payouts.
 * POST body: { bankCode: string, accountNumber: string }
 *
 * bankCode is the Paystack bank code (e.g. "058" for GTBank).
 * Get the full list from GET https://api.paystack.co/bank?currency=NGN
 */
export async function POST(request: Request) {
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    bankCode?: string;
    accountNumber?: string;
  } | null;

  if (!body?.bankCode || !/^\d{10}$/.test(body.accountNumber ?? "")) {
    return Response.json({ ok: false, code: "invalid_account" }, { status: 400 });
  }

  try {
    const result = await addPayoutAccount(
      {
        farmerId: user.id,
        bankCode: body.bankCode,
        accountNumber: body.accountNumber as string,
      },
      { db, paystack: createPaystackClient() },
    );
    return Response.json(result, { status: result.ok ? 200 : 409 });
  } catch (error) {
    if (error instanceof PaystackRejected) {
      return Response.json({ ok: false, code: "account_not_found" }, { status: 400 });
    }
    throw error;
  }
}
