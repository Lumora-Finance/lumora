import { deliverCodeToBuyer } from "./booking";
import type { MoneyDb, MoneyResult } from "./db";
import type { SmsSender } from "./jobs";
import { formatKobo } from "./rules";

export type SmsCommand =
  | { name: "YES"; code: string | null }
  | { name: "DELIVERED"; code: string; digits: string }
  | { name: "DISPUTE"; code: string | null; claimKg: number | null }
  | { name: "CANCEL"; code: string }
  | { name: "BOOK"; position: number; qty: number; day: string }
  | { name: "BUYERS"; commodity: string }
  | { name: "UNKNOWN" };

const BOOKING_CODE = /^LM-\d{4,6}$/;
const HELP = "Commands: BUYERS <crop>, BOOK <n> <qty> <day>, YES, DELIVERED <code> <digits>, DISPUTE <code> <kg>, CANCEL <code>.";

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
    case "BOOK": {
      const [position, qty, day] = rest;
      return /^\d+$/.test(position ?? "") && /^\d+$/.test(qty ?? "") && /^[A-Z]{3,9}$/.test(day ?? "")
        ? { name: "BOOK", position: Number(position), qty: Number(qty), day }
        : { name: "UNKNOWN" };
    }
    case "BUYERS":
      return rest.length > 0 ? { name: "BUYERS", commodity: rest.join(" ") } : { name: "UNKNOWN" };
    default:
      return { name: "UNKNOWN" };
  }
}

function failureMessage(result: MoneyResult, command: SmsCommand): string {
  switch (result.code) {
    case "only_n_left":
      return command.name === "BOOK"
        ? `Only ${String(result.remaining)} left. Reply BOOK ${command.position} ${String(result.remaining)} ${command.day}.`
        : `Only ${String(result.remaining)} left.`;
    case "wrong_code":
      return `Wrong code. ${String(result.attempts_left)} tries left.`;
    case "code_locked":
      return "This code is locked after too many wrong tries. Lumora will contact you.";
    case "ambiguous":
      return `You have more than one open booking. Add the code, for example YES ${String((result.codes as string[] | undefined)?.[0] ?? "LM-12345")}.`;
    case "past_cutoff":
      return "Booking has closed for that day.";
    case "below_minimum":
      return `The minimum for this buyer is ${String(result.min_qty)}.`;
    case "over_declared_stock":
      return `You only have ${String(result.remaining)} left in your declared stock for that day.`;
    case "new_farmer_cap":
      return `Your first booking can be up to ${String(result.cap)}.`;
    case "farmer_banned":
      return "You can't book right now because of recent no-shows.";
    case "insufficient_funds":
    case "slot_closed":
      return "This buyer isn't taking bookings right now.";
    case "no_such_choice":
      return "Send BUYERS <crop> first, then BOOK using a number from the list.";
    case "no_slot_that_day":
      return "This buyer has no slot on that day.";
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
  if (access.code === "unknown_phone") return "This number isn't on Lumora yet. Sign up at lumora.ng.";

  const phone = input.phone;
  const command = parseCommand(input.text);
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
        : `Booking ${command.code} cancelled. The slot has been reopened.`;
    case "BOOK":
      result = await deliverCodeToBuyer(
        await db.rpc("money_sms_book", {
          p_phone: phone, p_position: command.position, p_qty: command.qty, p_day: command.day, p_now: at,
        }),
        deps,
      );
      if (!result.ok) return failureMessage(result, command);
      return `Booked ${command.qty} for ${command.day}. Code ${String(result.code)}. Reply CANCEL ${String(result.code)} to cancel.`;
    case "BUYERS": {
      const list = await db.rpc<{ rows: { n: number; buyer: string; price: string; left: number; day: string }[] }>(
        "money_sms_buyers",
        { p_phone: phone, p_commodity: command.commodity, p_now: at },
      );
      if (list.rows.length === 0) return `No buyers for ${command.commodity} right now.`;
      const lines = list.rows.map((row) => `${row.n}) ${row.buyer} ${row.price}/kg, ${row.left} left ${row.day}`);
      return `${lines.join(" ")} Reply BOOK <n> <qty> <day>.`;
    }
    default:
      return HELP;
  }
}
