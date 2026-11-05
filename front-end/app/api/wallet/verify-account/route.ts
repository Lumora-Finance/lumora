import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";
import { createPaystackClient } from "@/lib/money/paystack";

/**
 * GET /api/wallet/verify-account?bankCode=058&accountNumber=0123456789
 * Resolves the account name from Paystack.
 * Requires auth so it can't be used as an open lookup tool.
 */
export async function GET(request: Request) {
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(request.url);
  const bankCode = searchParams.get("bankCode")?.trim() ?? "";
  const accountNumber = searchParams.get("accountNumber")?.trim() ?? "";

  if (!/^\d{10}$/.test(accountNumber)) {
    return Response.json({ ok: false, message: "Account number must be 10 digits" }, { status: 400 });
  }
  if (!bankCode) {
    return Response.json({ ok: false, message: "Bank code is required" }, { status: 400 });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    // Demo mode
    return Response.json({ ok: true, accountName: "Demo Account Name (no Paystack key)" });
  }

  try {
    const paystack = createPaystackClient(secretKey);
    const accountName = await paystack.resolveAccount(bankCode, accountNumber);
    return Response.json({ ok: true, accountName });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not verify account";
    return Response.json({ ok: false, message }, { status: 400 });
  }
}
