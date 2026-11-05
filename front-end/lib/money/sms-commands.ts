import { roadKm } from "@/lib/geo";
import { smsBoardLine } from "@/lib/logistics/board-copy";
import { continueSmsOnboarding } from "@/lib/logistics/sms-onboarding";

import { deliverCodeToBuyer } from "./booking";
import type { MoneyDb, MoneyResult } from "./db";
import type { SmsSender } from "./jobs";
import { formatKobo } from "./rules";

export type SmsCommand =
  | { name: "YES"; code: string | null }
  | { name: "DELIVERED"; code: string; digits: string }
  | { name: "DISPUTE"; code: string | null; claimKg: number | null }
  | { name: "CANCEL"; code: string }
  | { name: "BOOK"; position: number; qty: number; day: string | null }
  | { name: "BUYERS"; commodity: string | null }
  | { name: "JOIN" }
  | { name: "UNKNOWN" };

const BOOKING_CODE = /^LM-\d{4,6}$/;
const HELP = "Send BUYERS CHICKEN to see who is buying, then SELL 1 20. Other replies: YES, DELIVERED <code> <digits>, DISPUTE <code> <kg>, CANCEL <code>.";

export function parseCommand(text: string): SmsCommand {
  const [verb, ...rest] = text.trim().toUpperCase().split(/\s+/);
  switch (verb) {
    case "YES":
      if (rest.length === 0) return { name: "YES", code: null };
      return BOOKING_CODE.test(rest[0]) ? { name: "YES", code: rest[0] } : { name: "UNKNOWN" };
    case "DELIVERED":
      return BOOKING_CODE.test(rest[0] ?? "") && /^\d{4}$/.test(rest[1] ?? "")
        ? { name: "DELIVERED", code: rest[0], digits: rest[1] }
        : { name: "UNKNOWN" };
    case "DISPUTE": {
      const code = BOOKING_CODE.test(rest[0] ?? "") ? rest[0] : null;
      const kgText = code ? rest[1] : rest[0];
      if (kgText !== undefined && !/^\d+(\.\d{1,3})?$/.test(kgText)) return { name: "UNKNOWN" };
      return { name: "DISPUTE", code, claimKg: kgText === undefined ? null : Number(kgText) };
    }
    case "CANCEL":
      return BOOKING_CODE.test(rest[0] ?? "") ? { name: "CANCEL", code: rest[0] } : { name: "UNKNOWN" };
    // SELL is the word farmers see. BOOK keeps working, for anyone who learned it first.
    case "SELL":
    case "BOOK": {
      const [position, qty, day] = rest;
      return /^\d+$/.test(position ?? "") && /^\d+$/.test(qty ?? "") && (day === undefined || /^[A-Z]{3,9}$/.test(day))
        ? { name: "BOOK", position: Number(position), qty: Number(qty), day: day ?? null }
        : { name: "UNKNOWN" };
    }
    case "BUYERS":
      return { name: "BUYERS", commodity: rest.length > 0 ? rest.join(" ") : null };
    case "JOIN":
      return { name: "JOIN" };
    default:
      return { name: "UNKNOWN" };
  }
}

function failureMessage(result: MoneyResult, command: SmsCommand): string {
  switch (result.code) {
    case "only_n_left":
      return command.name === "BOOK"
        ? `They only need ${String(result.remaining)} more. Reply SELL ${command.position} ${String(result.remaining)}.`
        : `Only ${String(result.remaining)} left.`;
    case "wrong_code":
      return `Wrong code. ${String(result.attempts_left)} tries left.`;
    case "code_locked":
      return "This code is locked after too many wrong tries. Lumora will contact you.";
    case "ambiguous":
      return `You have more than one open booking. Add the code, for example YES ${String((result.codes as string[] | undefined)?.[0] ?? "LM-12345")}.`;
    case "past_cutoff":
      return "It's too late to sell for that day.";
    case "below_minimum":
      return `This buyer needs at least ${String(result.min_qty)}.`;
    case "over_declared_stock":
      return `You told us you have ${String(result.remaining)} left for that day.`;
    case "new_farmer_cap":
      return `Your first sale can be up to ${String(result.cap)}.`;
    case "farmer_banned":
      return "You can't sell right now because you missed recent deliveries.";
    case "insufficient_funds":
    case "slot_closed":
      return "This buyer isn't buying right now.";
    case "no_such_choice":
      return "Send BUYERS CHICKEN first, then SELL using a number from the list.";
    case "no_slot_that_day":
      return "This buyer isn't buying on that day.";
    case "booking_not_found":
    case "not_your_booking":
      return "We couldn't find that booking on your number.";
    case "nothing_to_confirm":
    case "nothing_to_dispute":
      return "You have nothing waiting for a reply.";
    case "confirm_deadline_passed":
      return "The time to confirm has passed, so this booking was released.";
    default:
      return "We couldn't do that. Please check and try again.";
  }
}

/** Handles one inbound text. Returns the reply, or null when nothing should be sent. */
export async function handleInboundSms(
  input: { phone: string; text: string; now?: Date },
  deps: { db: MoneyDb; sms: SmsSender },
): Promise<string | null> {
  const { db } = deps;
  const at = (input.now ?? new Date()).toISOString();
  const access = await db.rpc("money_sms_inbound", { p_phone: input.phone, p_body: input.text, p_now: at });
  // Replying to a flood would cost money and help whoever's sending it.
  if (access.code === "rate_limited") return null;

  const phone = input.phone;
  const now = input.now ?? new Date();
  const command = parseCommand(input.text);

  // An unknown number signs up by text. Someone part way through keeps going, whatever they send.
  if (access.code === "unknown_phone") {
    return continueSmsOnboarding({ phone, text: input.text, existing: null, now }, db);
  }
  const signingUp = await db.rpc<unknown>("logistics_sms_state", { p_phone: phone });
  if (signingUp || command.name === "JOIN") {
    const profile = await db.rpc<{ name: string; area: string | null }>("logistics_my_profile", { p_user: access.user_id });
    if (!signingUp && profile.area) return `You're already on Lumora, near ${profile.area}. Send BUYERS CHICKEN to see who is buying.`;
    return continueSmsOnboarding({ phone, text: input.text, existing: { name: profile.name }, now }, db);
  }

  let result: MoneyResult;

  switch (command.name) {
    case "YES":
      result = await db.rpc("money_sms_yes", { p_phone: phone, p_code: command.code, p_now: at });
      if (!result.ok) return failureMessage(result, command);
      return result.action === "confirmed"
        ? `Confirmed ${String(result.code)}. Get the code from the buyer when you arrive.`
        : "Thank you. Your payout is on its way.";
    case "DELIVERED":
      result = await db.rpc("money_sms_delivered", {
        p_phone: phone, p_code: command.code, p_digits: command.digits, p_now: at,
      });
      return result.ok ? "Code accepted. The buyer will now weigh and record your delivery." : failureMessage(result, command);
    case "DISPUTE":
      result = await db.rpc("money_sms_dispute", {
        p_phone: phone, p_code: command.code, p_claim_kg: command.claimKg, p_now: at,
      });
      if (!result.ok) return failureMessage(result, command);
      return result.auto_resolved
        ? `Resolved in your favour: ${formatKobo(Number(result.gross_kobo))}. Your payout is on its way.`
        : "Thank you. The recorded amount is on its way and we're reviewing the rest.";
    case "CANCEL":
      result = await db.rpc("money_sms_cancel", { p_phone: phone, p_code: command.code, p_now: at });
      if (!result.ok) return failureMessage(result, command);
      return result.status === "no_show"
        ? `Cancelled after the cut-off, so this counts as a no-show.`
        : `Booking ${command.code} cancelled.`;
    case "BOOK":
      result = await deliverCodeToBuyer(
        await db.rpc("money_sms_book", {
          p_phone: phone, p_position: command.position, p_qty: command.qty, p_day: command.day, p_now: at,
        }),
        deps,
      );
      if (!result.ok) return failureMessage(result, command);
      {
        const contact = await db.rpc<MoneyResult>("logistics_booking_contact", {
          p_booking: result.booking_id, p_viewer: access.user_id,
        });
        const where = contact.ok && contact.address ? ` Take them to: ${String(contact.address)}.` : "";
        const phoneLine = contact.ok ? ` Their phone: ${String(contact.phone)}.` : "";
        return `Done. You are selling ${command.qty} to them. Code ${String(result.code)}.${where}${phoneLine} Reply CANCEL ${String(result.code)} to cancel.`;
      }
    case "BUYERS": {
      const list = await db.rpc<{
        farmer_area: { lat: number; lng: number } | null;
        rows: {
          n: number; buyer: string; area: string; area_lat: number; area_lng: number; price_kobo: number;
          price_unit: string; remaining: number; window_start: string; delivery_mode: string;
        }[];
      }>("money_sms_buyers", { p_phone: phone, p_commodity: command.commodity, p_now: at });
      if (list.rows.length === 0) return "Nobody is buying that near you right now.";
      const lines = list.rows.map((row) =>
        smsBoardLine(
          {
            n: row.n,
            buyer: row.buyer,
            area: row.area,
            km: list.farmer_area ? roadKm(list.farmer_area, { lat: row.area_lat, lng: row.area_lng }) : null,
            priceKobo: row.price_kobo,
            priceUnit: row.price_unit,
            remaining: row.remaining,
            windowStart: new Date(row.window_start),
            collects: row.delivery_mode === "buyer_collects",
          },
          now,
        ),
      );
      return `${lines.join(" ")} Reply SELL 1 ${Math.min(20, list.rows[0].remaining)}`;
    }
    default:
      return HELP;
  }
}
