import type { MoneyDb } from "./db";
import { type FlutterwaveClient, verifyWebhookSignature } from "./flutterwave";
import { nairaToKobo } from "./rules";

type WebhookData = {
  id?: number;
  status?: string;
  amount?: unknown;
  currency?: string;
  tx_ref?: string;
  reference?: string;
};

export type WebhookOutcome = { httpStatus: number; result: string };

const UUID_PREFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * The webhook is only a hint that something happened. Nothing moves until the same facts come back
 * from Flutterwave's API. Anything that fails part way answers 500, so Flutterwave sends it again,
 * and the database's own guards make the repeat harmless.
 */
export async function handleFlutterwaveWebhook(
  input: { signature: string | null; body: { event?: string; data?: WebhookData }; secretHash: string | undefined },
  deps: { db: MoneyDb; flutterwave: FlutterwaveClient; now?: Date },
): Promise<WebhookOutcome> {
  if (!verifyWebhookSignature(input.signature, input.secretHash)) {
    return { httpStatus: 401, result: "bad_signature" };
  }

  const { event, data } = input.body;
  if (!data || typeof data.id !== "number") return { httpStatus: 200, result: "ignored" };

  try {
    if (event === "charge.completed") return await handleDeposit(data as WebhookData & { id: number }, deps);
    if (event === "transfer.completed") return await handleTransfer(data as WebhookData & { id: number }, deps);
    return { httpStatus: 200, result: "ignored" };
  } catch (error) {
    console.error("Flutterwave webhook failed", error instanceof Error ? error.message : error);
    return { httpStatus: 500, result: "retry" };
  }
}

async function handleDeposit(
  data: WebhookData & { id: number },
  { db, flutterwave, now }: { db: MoneyDb; flutterwave: FlutterwaveClient; now?: Date },
): Promise<WebhookOutcome> {
  if (String(data.status).toLowerCase() !== "successful") return { httpStatus: 200, result: "not_successful" };

  const verified = await flutterwave.verifyTransaction(data.id);
  const webhookKobo = nairaToKobo(data.amount as string);
  const matches =
    verified.status === "successful" &&
    verified.currency === "NGN" &&
    data.currency === "NGN" &&
    verified.amountKobo !== null &&
    verified.amountKobo > 0 &&
    verified.amountKobo === webhookKobo &&
    verified.txRef === data.tx_ref;

  if (!matches) {
    await db.rpc("money_alert", {
      p_kind: "deposit_verification_failed",
      p_detail: { tx_id: data.id, tx_ref: data.tx_ref ?? null },
    });
    return { httpStatus: 200, result: "verification_failed" };
  }

  const result = await db.rpc("money_credit_deposit", {
    p_tx_id: verified.id,
    p_tx_ref: verified.txRef,
    p_amount: verified.amountKobo,
    p_provider_fee: verified.feeKobo,
    p_payment_type: verified.paymentType,
    p_now: (now ?? new Date()).toISOString(),
  });
  if (result.duplicate) return { httpStatus: 200, result: "duplicate" };
  return { httpStatus: 200, result: result.ok ? "credited" : String(result.code) };
}

async function handleTransfer(
  data: WebhookData & { id: number },
  { db, flutterwave, now }: { db: MoneyDb; flutterwave: FlutterwaveClient; now?: Date },
): Promise<WebhookOutcome> {
  // A retried transfer may carry a suffix on the reference, so the settlement id is read from the front.
  const settlementId = UUID_PREFIX.exec(data.reference ?? "")?.[0];
  if (!settlementId) return { httpStatus: 200, result: "not_ours" };

  const payout = await db.rpc<{ id: string; amount_kobo: number; status: string } | null>(
    "money_payout_by_reference",
    { p_reference: settlementId },
  );
  if (!payout) return { httpStatus: 200, result: "not_ours" };

  const transfer = await flutterwave.getTransfer(data.id);
  if (!transfer.reference.startsWith(settlementId) || transfer.amountKobo !== payout.amount_kobo) {
    await db.rpc("money_alert", {
      p_kind: "transfer_verification_failed",
      p_detail: { transfer_id: data.id, payout_id: payout.id },
    });
    return { httpStatus: 200, result: "verification_failed" };
  }

  const at = (now ?? new Date()).toISOString();
  if (transfer.status === "SUCCESSFUL") {
    const result = await db.rpc("money_mark_paid", {
      p_payout: payout.id,
      p_transfer_id: transfer.id,
      p_fee_kobo: transfer.feeKobo,
      p_now: at,
    });
    return { httpStatus: 200, result: result.duplicate ? "duplicate" : "paid" };
  }
  if (transfer.status === "FAILED") {
    await db.rpc("money_payout_failed", { p_payout: payout.id, p_error: "Transfer failed", p_now: at });
    return { httpStatus: 200, result: "failed" };
  }
  return { httpStatus: 200, result: "pending" };
}
