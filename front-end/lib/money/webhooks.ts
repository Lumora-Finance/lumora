import type { MoneyDb } from "./db";
import { type FlutterwaveClient, verifyWebhookSignature as verifyFlwSignature } from "./flutterwave";
import { type PaystackClient, verifyWebhookSignature } from "./paystack";

type WebhookData = {
  id?: number;
  status?: string;
  amount?: unknown;
  currency?: string;
  reference?: string;
  transfer_code?: string;
  tx_ref?: string;
  [key: string]: unknown;
};

export type WebhookOutcome = { httpStatus: number; result: string };

const UUID_PREFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * The webhook is only a hint that something happened. Nothing moves until the same facts
 * come back from Paystack's API. Anything that fails part way answers 500, so Paystack
 * retries it, and the database's own idempotency guards make the repeat harmless.
 */
export async function handlePaystackWebhook(
  input: {
    signature: string | null;
    rawBody: string;
    body: { event?: string; data?: WebhookData };
    secretKey: string | undefined;
  },
  deps: { db: MoneyDb; paystack: PaystackClient; now?: Date },
): Promise<WebhookOutcome> {
  if (!verifyWebhookSignature(input.signature, input.rawBody, input.secretKey)) {
    return { httpStatus: 401, result: "bad_signature" };
  }

  const { event, data } = input.body;
  if (!data) return { httpStatus: 200, result: "ignored" };

  try {
    if (event === "charge.success") {
      return await handleDeposit(data, deps);
    }
    if (event === "transfer.success") {
      return await handleTransferSuccess(data, deps);
    }
    if (event === "transfer.failed" || event === "transfer.reversed") {
      return await handleTransferFailed(data, deps);
    }
    return { httpStatus: 200, result: "ignored" };
  } catch (error) {
    console.error("Paystack webhook failed", error instanceof Error ? error.message : error);
    return { httpStatus: 500, result: "retry" };
  }
}

// ── Deposit (wallet funding via charge.success) ────────────────────────────────

async function handleDeposit(
  data: WebhookData,
  { db, paystack, now }: { db: MoneyDb; paystack: PaystackClient; now?: Date },
): Promise<WebhookOutcome> {
  if (String(data.status).toLowerCase() !== "success") {
    return { httpStatus: 200, result: "not_successful" };
  }
  if (!data.reference) return { httpStatus: 200, result: "no_reference" };

  // Re-verify with Paystack — never trust webhook data alone
  const verified = await paystack.verifyTransaction(data.reference);

  const matches =
    verified.status === "success" &&
    verified.currency === "NGN" &&
    verified.amountKobo !== null &&
    verified.amountKobo > 0 &&
    verified.reference === data.reference;

  if (!matches) {
    await db.rpc("money_alert", {
      p_kind: "deposit_verification_failed",
      p_detail: { reference: data.reference },
    });
    return { httpStatus: 200, result: "verification_failed" };
  }

  const result = await db.rpc("money_credit_deposit", {
    p_tx_id: verified.id,
    p_tx_ref: verified.reference,
    p_amount: verified.amountKobo,
    p_provider_fee: verified.feeKobo,
    p_payment_type: verified.paymentChannel,
    p_now: (now ?? new Date()).toISOString(),
  });

  if (result.duplicate) return { httpStatus: 200, result: "duplicate" };
  return { httpStatus: 200, result: result.ok ? "credited" : String(result.code) };
}

// ── Transfer success (payout confirmed) ───────────────────────────────────────

async function handleTransferSuccess(
  data: WebhookData,
  { db, paystack, now }: { db: MoneyDb; paystack: PaystackClient; now?: Date },
): Promise<WebhookOutcome> {
  const settlementId = UUID_PREFIX.exec(data.reference ?? "")?.[0];
  if (!settlementId) return { httpStatus: 200, result: "not_ours" };

  const payout = await db.rpc<{ id: string; amount_kobo: number; status: string } | null>(
    "money_payout_by_reference",
    { p_reference: settlementId },
  );
  if (!payout) return { httpStatus: 200, result: "not_ours" };

  if (!data.transfer_code) return { httpStatus: 200, result: "no_transfer_code" };

  // Re-verify with Paystack
  const transfer = await paystack.getTransfer(data.transfer_code);

  if (
    !transfer.reference.startsWith(settlementId) ||
    transfer.amountKobo !== payout.amount_kobo
  ) {
    await db.rpc("money_alert", {
      p_kind: "transfer_verification_failed",
      p_detail: { transfer_code: data.transfer_code, payout_id: payout.id },
    });
    return { httpStatus: 200, result: "verification_failed" };
  }

  const at = (now ?? new Date()).toISOString();

  if (transfer.status === "success") {
    const result = await db.rpc("money_mark_paid", {
      p_payout: payout.id,
      p_transfer_id: transfer.id,
      p_fee_kobo: transfer.feeKobo,
      p_now: at,
    });
    return { httpStatus: 200, result: result.duplicate ? "duplicate" : "paid" };
  }

  return { httpStatus: 200, result: "pending" };
}

// ── Transfer failed / reversed ────────────────────────────────────────────────

async function handleTransferFailed(
  data: WebhookData,
  { db, now }: { db: MoneyDb; paystack: PaystackClient; now?: Date },
): Promise<WebhookOutcome> {
  const settlementId = UUID_PREFIX.exec(data.reference ?? "")?.[0];
  if (!settlementId) return { httpStatus: 200, result: "not_ours" };

  const payout = await db.rpc<{ id: string } | null>("money_payout_by_reference", {
    p_reference: settlementId,
  });
  if (!payout) return { httpStatus: 200, result: "not_ours" };

  await db.rpc("money_payout_failed", {
    p_payout: payout.id,
    p_error: `Transfer ${data.status ?? "failed"}`,
    p_now: (now ?? new Date()).toISOString(),
  });

  return { httpStatus: 200, result: "failed" };
}
