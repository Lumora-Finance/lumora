import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { serverMoneyDb } from "@/lib/money/db";
import { createPaystackClient, verifyWebhookSignature } from "@/lib/money/paystack";
import { handlePaystackWebhook } from "@/lib/money/webhooks";


/**
 * Paystack webhook endpoint — register this URL in Paystack dashboard:
 * https://dashboard.paystack.com/#/settings/developer → Webhooks
 *
 * URL: https://your-domain.com/api/webhooks/paystack
 *
 * Events: charge.success, transfer.success, transfer.failed, transfer.reversed
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!verifyWebhookSignature(signature, rawBody, secretKey)) {
    return Response.json({ result: "bad_signature" }, { status: 401 });
  }

  let body: { event?: string; data?: Record<string, unknown> };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ result: "bad_json" }, { status: 400 });
  }

  // Process withdrawal transfer webhooks that aren't settlement payouts
  const ref = String(body.data?.reference ?? "");
  if (ref.startsWith("LUMORA-WD-")) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const event = body.event;
    const transferCode = String(body.data?.transfer_code ?? "");

    if (event === "transfer.success") {
      await supabase
        .from("withdrawal_requests")
        .update({ status: "paid", transfer_code: transferCode, resolved_at: new Date().toISOString() })
        .eq("transfer_reference", ref);
    } else if (event === "transfer.failed" || event === "transfer.reversed") {
      await supabase
        .from("withdrawal_requests")
        .update({ status: "failed", transfer_code: transferCode, admin_note: `Transfer ${event}`, resolved_at: new Date().toISOString() })
        .eq("transfer_reference", ref);
    }

    return Response.json({ result: "withdrawal_updated" });
  }

  const { httpStatus, result } = await handlePaystackWebhook(
    { signature, rawBody, body, secretKey },
    { db: serverMoneyDb(), paystack: createPaystackClient() },
  );

  return Response.json({ result }, { status: httpStatus });
}
