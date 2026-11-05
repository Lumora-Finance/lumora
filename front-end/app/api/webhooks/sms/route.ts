import { serverMoneyDb } from "@/lib/money/db";
import { secretMatches } from "@/lib/money/secret";
import { handleInboundSms } from "@/lib/money/sms-commands";
import { createSmsSender } from "@/lib/money/sms-sender";

/** Africa's Talking posts form fields. Its callbacks are unsigned, so the URL carries a secret. */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!secretMatches(token, process.env.SMS_WEBHOOK_TOKEN)) {
    return new Response("Forbidden", { status: 403 });
  }

  const form = await request.formData();
  const phone = String(form.get("from") ?? "");
  const text = String(form.get("text") ?? "");
  if (!phone) return new Response("OK");

  const db = serverMoneyDb();
  const sms = createSmsSender();
  const reply = await handleInboundSms({ phone, text }, { db, sms });
  if (reply) {
    try {
      await sms.send(phone, reply);
    } catch {
      await db.rpc("money_sms", { p_phone: phone, p_body: reply });
    }
  }
  return new Response("OK");
}
