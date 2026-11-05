import { requestUser } from "@/lib/money/auth";
import { type MoneyResult, serverMoneyDb } from "@/lib/money/db";

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
  expectedAt?: string;
  decision?: string;
  deadline?: string;
  priceKobo?: number;
  reason?: string;
  photoUrl?: string;
  note?: string;
};

/** Everything either side can do from a booking page. The rules are in the database functions. */
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
      // The buyer's page reads the new code from the booking, so it isn't passed back here.
      result = await db.rpc<MoneyResult>("money_regenerate_code", { p_booking: id, p_buyer: user.id });
      delete result.delivery_code;
      break;
    case "running_late":
      result = await db.rpc("money_running_late", { p_booking: id, p_farmer: user.id, p_expected: body.expectedAt ?? null });
      break;
    case "report_no_code":
      result = await db.rpc("money_report_no_code", { p_booking: id, p_farmer: user.id });
      break;
    case "nocode_decline":
      result = await db.rpc("money_nocode_decline", {
        p_booking: id, p_buyer: user.id, p_reason: body.reason ?? "", p_photo_url: body.photoUrl ?? "", p_note: body.note ?? null,
      });
      break;
    case "approval":
      result = await db.rpc("money_answer_approval", { p_booking: id, p_buyer: user.id, p_decision: body.decision ?? "" });
      break;
    case "find_backup":
      result = await db.rpc("money_request_backup", {
        p_booking: id, p_buyer: user.id, p_deadline: body.deadline ?? null, p_price_kobo: body.priceKobo ?? null,
      });
      break;
    case "keep_waiting":
      result = await db.rpc("money_keep_waiting", { p_booking: id, p_buyer: user.id });
      break;
    default:
      result = { ok: false, code: "unknown_action" };
  }
  return Response.json(result, { status: result.ok ? 200 : 409 });
}
