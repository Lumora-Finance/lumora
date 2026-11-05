import type { MoneyDb } from "./db";
import { type PaystackClient, PaystackRejected } from "./paystack";

export type SmsSender = { send(phone: string, body: string): Promise<void> };

type ClaimedPayout = {
  payout_id: string;
  reference: string;
  amount_kobo: number;
  attempts: number;
  transfer_id: number | null;
  bank_code: string;
  account_number: string;
  account_name: string | null;
};

/**
 * Sends claimed payouts via Paystack transfers.
 * The check by reference comes first so a run that died after Paystack accepted a transfer
 * cannot create a second one. The database's idempotency key prevents double-pays.
 */
export async function sendPayouts(deps: { db: MoneyDb; paystack: PaystackClient; now?: Date }) {
  const { db, paystack } = deps;
  const at = (deps.now ?? new Date()).toISOString();
  const claimed = await db.rpc<ClaimedPayout[]>("money_claim_payouts", { p_now: at });
  const outcome = { sent: 0, failed: 0, unknown: 0 };

  for (const payout of claimed) {
    try {
      // Check if a transfer for this reference already exists
      const existing = await paystack.findTransferByReference(payout.reference);

      let transfer;
      if (existing && existing.status === "failed") {
        // Retry by creating a new recipient and transfer
        // (Paystack doesn't have a direct retry — resend_otp is for OTP, not failed transfers)
        const recipientCode = await paystack.createTransferRecipient({
          bankCode: payout.bank_code,
          accountNumber: payout.account_number,
          accountName: payout.account_name ?? "Lumora Farmer",
        });
        transfer = await paystack.createTransfer({
          reference: `${payout.reference}-r${payout.attempts}`,
          amountKobo: payout.amount_kobo,
          recipientCode,
          reason: "Lumora payout",
        });
      } else if (existing) {
        transfer = existing;
      } else {
        // First attempt — create recipient then transfer
        const recipientCode = await paystack.createTransferRecipient({
          bankCode: payout.bank_code,
          accountNumber: payout.account_number,
          accountName: payout.account_name ?? "Lumora Farmer",
        });
        transfer = await paystack.createTransfer({
          reference: payout.reference,
          amountKobo: payout.amount_kobo,
          recipientCode,
          reason: "Lumora payout",
        });
      }

      await db.rpc("money_transfer_sent", {
        p_payout: payout.payout_id,
        p_transfer_id: transfer.id,
        p_fee_kobo: transfer.feeKobo,
      });
      outcome.sent += 1;
    } catch (error) {
      if (error instanceof PaystackRejected) {
        await db.rpc("money_payout_failed", {
          p_payout: payout.payout_id,
          p_error: error.message,
          p_now: at,
        });
        outcome.failed += 1;
      } else {
        console.error("Payout outcome unknown", payout.payout_id);
        outcome.unknown += 1;
      }
    }
  }
  return outcome;
}

export async function sendRefunds(deps: { db: MoneyDb; paystack: PaystackClient; now?: Date }) {
  const at = (deps.now ?? new Date()).toISOString();
  const due = await deps.db.rpc<{ tx_id: number; amount_kobo: number }[]>(
    "money_refunds_due",
    { p_now: at },
  );
  let sent = 0;
  for (const refund of due) {
    try {
      await deps.paystack.refund(refund.tx_id, refund.amount_kobo);
      await deps.db.rpc("money_refund_sent", { p_tx_id: refund.tx_id });
      sent += 1;
    } catch (error) {
      await deps.db.rpc("money_alert", {
        p_kind: "refund_failed",
        p_detail: {
          tx_id: refund.tx_id,
          error: error instanceof Error ? error.message : "unknown",
        },
      });
    }
  }
  return { sent };
}

export async function sendOutbox(deps: { db: MoneyDb; sms: SmsSender }) {
  const messages = await deps.db.rpc<{ id: string; phone: string; body: string }[]>(
    "money_outbox_claim",
  );
  let sent = 0;
  for (const message of messages) {
    try {
      await deps.sms.send(message.phone, message.body);
      sent += 1;
    } catch {
      await deps.db.rpc("money_outbox_failed", { p_id: message.id });
    }
  }
  return { sent };
}

/** The 5-minute cron job. */
export async function runMoneyJob(deps: {
  db: MoneyDb;
  paystack: PaystackClient;
  sms: SmsSender;
  now?: Date;
}) {
  const at = (deps.now ?? new Date()).toISOString();
  const sweep = await deps.db.rpc("money_sweep", { p_now: at });
  const payouts = await sendPayouts(deps);
  const refunds = await sendRefunds(deps);
  const outbox = await sendOutbox(deps);
  return { sweep, payouts, refunds, outbox };
}

/** The nightly reconciliation job. */
export async function runReconciliation(deps: {
  db: MoneyDb;
  paystack: PaystackClient;
  now?: Date;
}) {
  const balance = await deps.paystack.ledgerBalanceKobo();
  return deps.db.rpc("money_reconcile", {
    p_flw_balance_kobo: balance,          // column name unchanged in DB
    p_now: (deps.now ?? new Date()).toISOString(),
  });
}
