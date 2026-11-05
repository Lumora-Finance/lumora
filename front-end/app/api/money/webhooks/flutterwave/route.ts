import { serverMoneyDb } from "@/lib/money/db";
import { createFlutterwaveClient, verifyWebhookSignature } from "@/lib/money/flutterwave";
import { handleFlutterwaveWebhook } from "@/lib/money/webhooks";

export async function POST(request: Request) {
  const signature = request.headers.get("verif-hash");
  const secretHash = process.env.FLUTTERWAVE_WEBHOOK_HASH;
  // Forged requests stop here, before anything touches the database.
  if (!verifyWebhookSignature(signature, secretHash)) {
    return Response.json({ result: "bad_signature" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { httpStatus, result } = await handleFlutterwaveWebhook(
    { signature, body, secretHash },
    { db: serverMoneyDb(), flutterwave: createFlutterwaveClient() },
  );
  return Response.json({ result }, { status: httpStatus });
}
