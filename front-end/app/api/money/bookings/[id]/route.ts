import { requestUser } from "@/lib/money/auth";
import { regenerateCode } from "@/lib/money/booking";
import { type MoneyResult, serverMoneyDb } from "@/lib/money/db";
import { createSmsSender } from "@/lib/money/sms-sender";

type Body = {
  action?: string;
  digits?: string;
  reply?: string;
  claimKg?: number;
  unitsReceived?: number;
  unitsDeclined?: number;
  declineReasons?: unknown[];
  measuredKg?: number;
  scalePhotos?: string[];
};

/** The app's version of what farmers can do by SMS, plus recording, which needs photos. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const body = ((await request.json().catch(() => null)) ?? {}) as Body;
  let result: MoneyResult;

  switch (body.action) {
    case "confirm":
      result = await db.rpc("money_confirm_booking", { p_booking: id, p_farmer: user.id });
      break;
    case "cancel_farmer":
      result = await db.rpc("money_cancel_farmer", { p_booking: id, p_farmer: user.id });
      break;
    case "cancel_buyer":
      result = await db.rpc("money_cancel_buyer", { p_booking: id, p_buyer: user.id });
      break;
    case "submit_code":
      result = await db.rpc("money_submit_code", { p_booking: id, p_farmer: user.id, p_digits: String(body.digits ?? "") });
      break;
    case "reply":
      result = await db.rpc("money_farmer_reply", {
        p_booking: id, p_farmer: user.id, p_reply: String(body.reply ?? ""), p_claim_kg: body.claimKg ?? null,
      });
      break;
    case "record":
      result = await db.rpc("money_record_delivery", {
        p_booking: id,
        p_buyer: user.id,
        p_units_received: body.unitsReceived ?? 0,
        p_units_declined: body.unitsDeclined ?? 0,
        p_decline_reasons: body.declineReasons ?? [],
        p_measured_kg: body.measuredKg ?? 0,
        p_scale_photos: body.scalePhotos ?? [],
      });
      break;
    case "regenerate_code":
      result = await regenerateCode({ bookingId: id, buyerId: user.id, phone: user.phone }, { db, sms: createSmsSender() });
      break;
    default:
      result = { ok: false, code: "unknown_action" };
  }
  return Response.json(result, { status: result.ok ? 200 : 409 });
}
