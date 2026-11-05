import type { MoneyDb, MoneyResult } from "./db";
import type { PaystackClient } from "./paystack";
import type { SmsSender } from "./jobs";
import { namesMatch } from "./rules";

export type BookingResult = MoneyResult & { booking_id?: string; capacity_remaining?: number };

/**
 * Books a slot for a farmer. `book_slot` returns the plain delivery code once, for the buyer. It's
 * sent to them here and never returned, because the farmer is the one calling this.
 */
export async function bookSlot(
  input: { slotId: string; farmerId: string; qty: number; now?: Date },
  deps: { db: MoneyDb; sms: SmsSender },
): Promise<BookingResult> {
  const result = await deps.db.rpc<MoneyResult>("book_slot", {
    p_slot: input.slotId,
    p_farmer: input.farmerId,
    p_qty: input.qty,
    p_now: (input.now ?? new Date()).toISOString(),
  });
  return deliverCodeToBuyer(result, deps);
}

/** Sends the buyer their code and removes it, and their number, from what the caller gets back. */
export async function deliverCodeToBuyer(
  result: MoneyResult,
  deps: { db: MoneyDb; sms: SmsSender },
): Promise<BookingResult> {
  const { delivery_code: code, buyer_phone: phone, ...safe } = result;
  if (result.ok && code && phone) {
    try {
      await deps.sms.send(
        String(phone),
        `Booking ${String(result.code)}. Give the farmer this code when they arrive: ${String(code)}`,
      );
    } catch {
      // The code isn't stored anywhere, so ops are told and the buyer can issue a new one.
      await deps.db.rpc("money_alert", {
        p_kind: "delivery_code_sms_failed",
        p_detail: { booking_id: result.booking_id },
      });
    }
  }
  return safe;
}

export async function regenerateCode(
  input: { bookingId: string; buyerId: string; phone: string },
  deps: { db: MoneyDb; sms: SmsSender },
): Promise<MoneyResult> {
  const result = await deps.db.rpc<MoneyResult>("money_regenerate_code", {
    p_booking: input.bookingId,
    p_buyer: input.buyerId,
  });
  if (!result.ok) return result;
  await deps.sms.send(input.phone, `Your new delivery code is ${String(result.delivery_code)}`);
  return { ok: true };
}

/** Payouts only go to accounts in the farmer's registered name. */
export async function addPayoutAccount(
  input: { farmerId: string; bankCode: string; accountNumber: string },
  deps: { db: MoneyDb; paystack: PaystackClient; now?: Date },
): Promise<MoneyResult> {
  const farmer = await deps.db.rpc<{ name: string } | null>("money_get_user", { p_user: input.farmerId });
  if (!farmer) return { ok: false, code: "user_not_found" };
  const resolved = await deps.paystack.resolveAccount(input.bankCode, input.accountNumber);
  return deps.db.rpc("money_save_payout_account", {
    p_farmer: input.farmerId,
    p_bank_code: input.bankCode,
    p_account_number: input.accountNumber,
    p_resolved_name: resolved,
    p_name_match: namesMatch(farmer.name, resolved),
    p_now: (deps.now ?? new Date()).toISOString(),
  });
}
