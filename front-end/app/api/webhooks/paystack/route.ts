import { serverMoneyDb } from "@/lib/money/db";
import { createPaystackClient, verifyWebhookSignature } from "@/lib/money/paystack";
import { handlePaystackWebhook } from "@/lib/money/webhooks";

export const runtime = "nodejs";

/**
 * Paystack webhook endpoint — register this URL in Paystack dashboard:
 * https://dashboard.paystack.com/#/settings/developer → Webhooks
 *
 * URL: https://your-domain.com/api/webhooks/paystack
 *
 * Events to enable: charge.success, transfer.success, transfer.failed, transfer.reversed
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

  const { httpStatus, result } = await handlePaystackWebhook(
    { signature, rawBody, body, secretKey },
    { db: serverMoneyDb(), paystack: createPaystackClient() },
  );

  return Response.json({ result }, { status: httpStatus });
}
