import { serverMoneyDb } from "@/lib/money/db";
import { createPaystackClient, verifyWebhookSignature } from "@/lib/money/paystack";
import { handlePaystackWebhook } from "@/lib/money/webhooks";


/**
 * Paystack webhook handler.
 * Paystack signs with HMAC-SHA512 using PAYSTACK_SECRET_KEY.
 * Header: x-paystack-signature
 *
 * Events handled:
 *   charge.success      → wallet funding credited
 *   transfer.success    → payout confirmed, farmer marked paid
 *   transfer.failed     → payout marked failed, queued for retry
 *   transfer.reversed   → same as failed
 */
export async function POST(request: Request) {
  // Read raw body first — signature verification needs the exact bytes
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  // Reject forged requests before touching the database
  if (!verifyWebhookSignature(signature, rawBody, secretKey)) {
    return Response.json({ result: "bad_signature" }, { status: 401 });
  }

  let body: { event?: string; data?: Record<string, unknown> };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ result: "bad_json" }, { status: 400 });
  }

  const { httpStatus, result } = await handlePaystackWebhook(
    { signature, rawBody, body, secretKey },
    { db: serverMoneyDb(), paystack: createPaystackClient() },
  );

  return Response.json({ result }, { status: httpStatus });
}
