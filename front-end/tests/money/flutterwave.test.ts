import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { addPayoutAccount } from "../../lib/money/booking";
import { createFlutterwaveClient, verifyWebhookSignature } from "../../lib/money/flutterwave";
import { runMoneyJob, runReconciliation, sendOutbox, sendPayouts, sendRefunds } from "../../lib/money/jobs";
import { handleFlutterwaveWebhook } from "../../lib/money/webhooks";
import {
  arrive, available, balance, call, confirmedBooking, db, FakeFlutterwave, FakeSms, hours, ledgerTotal, makeUser, pool,
  q, record, resetDb, T0, WINDOW_START,
} from "./helpers";

beforeEach(resetDb);
afterAll(() => pool.end());

const SECRET = "test-hash";
const webhook = (flutterwave: FakeFlutterwave, body: object, signature: string | null = SECRET) =>
  handleFlutterwaveWebhook({ signature, body, secretHash: SECRET }, { db, flutterwave, now: T0 });

async function buyerWithAccount() {
  const buyer = await makeUser("buyer");
  await q(`insert into money_funding_accounts (buyer_id, tx_ref) values ($1, $2)`, [buyer.id, `ref-${buyer.id}`]);
  return { ...buyer, ref: `ref-${buyer.id}` };
}

function deposit(flutterwave: FakeFlutterwave, id: number, ref: string, naira: number, overrides: Record<string, unknown> = {}) {
  flutterwave.transactions.set(id, {
    id, status: "successful", amountKobo: naira * 100, currency: "NGN", txRef: ref, paymentType: "bank_transfer", feeKobo: 0,
    ...overrides,
  });
  return { event: "charge.completed", data: { id, status: "successful", amount: naira, currency: "NGN", tx_ref: ref } };
}

/** A settled booking with a payout waiting, and a farmer whose account matches. */
async function settledWithPayout() {
  const b = await confirmedBooking();
  await arrive(b, WINDOW_START);
  await record(b, 30, hours(1, WINDOW_START));
  await call("money_farmer_reply", { p_booking: b.booking.booking_id, p_farmer: b.farmer.id, p_reply: "yes", p_now: hours(2, WINDOW_START).toISOString() });
  await q(`insert into payout_accounts (farmer_id, bank_code, account_number, resolved_name, name_match) values ($1, '044', $2, 'X', true)`, [b.farmer.id, b.farmer.phone.slice(-10)]);
  const [payout] = await q<{ id: string; settlement_id: string; amount_kobo: string }>(`select id, settlement_id, amount_kobo from money_payouts where farmer_id = $1`, [b.farmer.id]);
  return { b, payout: { ...payout, amount_kobo: Number(payout.amount_kobo) } };
}

const transferEvent = (id: number, reference: string, status = "SUCCESSFUL") => ({
  event: "transfer.completed",
  data: { id, reference, status },
});

describe("webhook signature", () => {
  it("fails closed", () => {
    expect(verifyWebhookSignature("x", undefined)).toBe(false);
    expect(verifyWebhookSignature(null, "x")).toBe(false);
    expect(verifyWebhookSignature("wrong", "right")).toBe(false);
    expect(verifyWebhookSignature("right", "right")).toBe(true);
  });

  it("credits nothing on a bad signature", async () => {
    const fw = new FakeFlutterwave();
    const buyer = await buyerWithAccount();
    const outcome = await webhook(fw, deposit(fw, 1, buyer.ref, 1000), "forged");
    expect(outcome.httpStatus).toBe(401);
    expect(await available(buyer.id)).toBe(0);
  });
});

describe("deposits", () => {
  it("credits a verified deposit, and a duplicate webhook doesn't credit twice", async () => {
    const fw = new FakeFlutterwave();
    const buyer = await buyerWithAccount();
    const body = deposit(fw, 1, buyer.ref, 1000);

    expect(await webhook(fw, body)).toMatchObject({ result: "credited" });
    expect(await available(buyer.id)).toBe(100_000);
    expect(await webhook(fw, body)).toMatchObject({ result: "duplicate" });
    expect(await available(buyer.id)).toBe(100_000);
  });

  it("doesn't double-credit parallel duplicates", async () => {
    const fw = new FakeFlutterwave();
    const buyer = await buyerWithAccount();
    const body = deposit(fw, 1, buyer.ref, 1000);
    await Promise.all(Array.from({ length: 8 }, () => webhook(fw, body)));
    expect(await available(buyer.id)).toBe(100_000);
    expect(await q(`select 1 from money_deposits`)).toHaveLength(1);
  });

  it.each([
    ["amount", { amountKobo: 1 }],
    ["currency", { currency: "USD" }],
    ["reference", { txRef: "someone-else" }],
    ["status", { status: "failed" }],
  ])("refuses a deposit whose verified %s doesn't match", async (_, overrides) => {
    const fw = new FakeFlutterwave();
    const buyer = await buyerWithAccount();
    expect(await webhook(fw, deposit(fw, 1, buyer.ref, 1000, overrides))).toMatchObject({ result: "verification_failed" });
    expect(await available(buyer.id)).toBe(0);
    expect(await q(`select 1 from money_alerts where kind = 'deposit_verification_failed'`)).toHaveLength(1);
  });

  it("asks Flutterwave to send again if verification can't be reached", async () => {
    const fw = new FakeFlutterwave();
    const buyer = await buyerWithAccount();
    const body = { event: "charge.completed", data: { id: 99, status: "successful", amount: 1000, currency: "NGN", tx_ref: buyer.ref } };
    expect(await webhook(fw, body)).toMatchObject({ httpStatus: 500 });
    expect(await available(buyer.id)).toBe(0);
  });

  it("refuses card funding and raises an alert", async () => {
    const fw = new FakeFlutterwave();
    const buyer = await buyerWithAccount();
    expect(await webhook(fw, deposit(fw, 1, buyer.ref, 1000, { paymentType: "card" }))).toMatchObject({ result: "not_bank_transfer" });
    expect(await available(buyer.id)).toBe(0);
    expect(await q(`select 1 from money_alerts where kind = 'deposit_not_bank_transfer'`)).toHaveLength(1);
  });

  it("holds funding over ₦500,000 for a new buyer, then refunds the excess", async () => {
    const fw = new FakeFlutterwave();
    const buyer = await buyerWithAccount();
    await webhook(fw, deposit(fw, 1, buyer.ref, 600_000));

    expect(await available(buyer.id)).toBe(50_000_000);
    expect(await balance("buyer_over_cap", buyer.id)).toBe(10_000_000);

    await sendRefunds({ db, flutterwave: fw, now: hours(47) });
    expect(fw.refunds).toEqual([]);
    await sendRefunds({ db, flutterwave: fw, now: hours(48) });
    expect(fw.refunds).toEqual([[1, 10_000_000]]);
    expect(await balance("buyer_over_cap", buyer.id)).toBe(0);
    await sendRefunds({ db, flutterwave: fw, now: hours(49) });
    expect(fw.refunds).toHaveLength(1);
    expect(await ledgerTotal()).toBe(0);
  });
});

describe("payouts", () => {
  it("creates one transfer for one settlement, with the settlement id as reference", async () => {
    const fw = new FakeFlutterwave();
    const { payout } = await settledWithPayout();

    await sendPayouts({ db, flutterwave: fw, now: hours(3, WINDOW_START) });
    await sendPayouts({ db, flutterwave: fw, now: hours(4, WINDOW_START) });

    expect(fw.createCalls).toBe(1);
    expect([...fw.transfers.values()][0].reference).toBe(payout.settlement_id);
  });

  it("doesn't let parallel job runs create two transfers", async () => {
    const fw = new FakeFlutterwave();
    await settledWithPayout();
    const at = hours(3, WINDOW_START);
    await Promise.all(Array.from({ length: 6 }, () => sendPayouts({ db, flutterwave: fw, now: at })));
    expect(fw.createCalls).toBe(1);
  });

  it("recovers from a crash after Flutterwave accepted, without a second transfer", async () => {
    const fw = new FakeFlutterwave();
    const { payout } = await settledWithPayout();
    fw.failAfterCreate = true;
    const first = await sendPayouts({ db, flutterwave: fw, now: hours(3, WINDOW_START) });
    expect(first.unknown).toBe(1);

    // Still claimed, so it's left alone until the 15-minute claim expires.
    await sendPayouts({ db, flutterwave: fw, now: hours(3.1, WINDOW_START) });
    expect(fw.createCalls).toBe(1);

    await sendPayouts({ db, flutterwave: fw, now: hours(4, WINDOW_START) });
    expect(fw.createCalls).toBe(1);
    const [row] = await q<{ status: string }>(`select status from money_payouts where id = $1`, [payout.id]);
    expect(row.status).toBe("in_flight");
  });

  it("marks paid only on a verified webhook, and a duplicate doesn't pay twice", async () => {
    const fw = new FakeFlutterwave();
    const { b, payout } = await settledWithPayout();
    await sendPayouts({ db, flutterwave: fw, now: hours(3, WINDOW_START) });
    const transfer = [...fw.transfers.values()][0];

    expect(await balance("farmer_paid", b.farmer.id)).toBe(0);

    // Flutterwave's own record still says pending, so the webhook's word isn't taken for it.
    expect(await webhook(fw, transferEvent(transfer.id, payout.settlement_id))).toMatchObject({ result: "pending" });
    expect(await balance("farmer_paid", b.farmer.id)).toBe(0);

    transfer.status = "SUCCESSFUL";
    expect(await webhook(fw, transferEvent(transfer.id, payout.settlement_id))).toMatchObject({ result: "paid" });
    expect(await balance("farmer_paid", b.farmer.id)).toBe(payout.amount_kobo);
    expect(await balance("farmer_pending", b.farmer.id)).toBe(0);

    expect(await webhook(fw, transferEvent(transfer.id, payout.settlement_id))).toMatchObject({ result: "duplicate" });
    await Promise.all(Array.from({ length: 5 }, () => webhook(fw, transferEvent(transfer.id, payout.settlement_id))));
    expect(await balance("farmer_paid", b.farmer.id)).toBe(payout.amount_kobo);
    expect(await ledgerTotal()).toBe(0);
  });

  it("refuses a webhook whose transfer doesn't match the payout", async () => {
    const fw = new FakeFlutterwave();
    const { b, payout } = await settledWithPayout();
    await sendPayouts({ db, flutterwave: fw, now: hours(3, WINDOW_START) });
    const transfer = [...fw.transfers.values()][0];
    transfer.status = "SUCCESSFUL";
    transfer.amountKobo = 1;
    expect(await webhook(fw, transferEvent(transfer.id, payout.settlement_id))).toMatchObject({ result: "verification_failed" });
    expect(await balance("farmer_paid", b.farmer.id)).toBe(0);
  });

  it("on failure keeps the money pending, tells the farmer, and retries the next day", async () => {
    const fw = new FakeFlutterwave();
    const { b, payout } = await settledWithPayout();
    await sendPayouts({ db, flutterwave: fw, now: hours(3, WINDOW_START) });
    const transfer = [...fw.transfers.values()][0];
    transfer.status = "FAILED";

    expect(await webhook(fw, transferEvent(transfer.id, payout.settlement_id, "FAILED"))).toMatchObject({ result: "failed" });
    expect(await balance("farmer_pending", b.farmer.id)).toBe(payout.amount_kobo);
    expect(await q(`select 1 from sms_outbox where phone = $1 and body like '%check your account details%'`, [b.farmer.phone])).toHaveLength(1);

    const [row] = await q<{ next_attempt_at: Date }>(`select next_attempt_at from money_payouts where id = $1`, [payout.id]);
    await sendPayouts({ db, flutterwave: fw, now: new Date(row.next_attempt_at.getTime() - 60_000) });
    expect(fw.retryCalls).toBe(0);

    await sendPayouts({ db, flutterwave: fw, now: new Date(row.next_attempt_at.getTime() + 60_000) });
    expect(fw.retryCalls).toBe(1);
    expect(fw.createCalls).toBe(1);

    // A retry's reference has a suffix. It still has to find its way back to the payout.
    const retried = [...fw.transfers.values()].at(-1)!;
    retried.status = "SUCCESSFUL";
    expect(await webhook(fw, transferEvent(retried.id, retried.reference))).toMatchObject({ result: "paid" });
    expect(await balance("farmer_paid", b.farmer.id)).toBe(payout.amount_kobo);
  });

  it("treats a rejection from Flutterwave as a failure", async () => {
    const fw = new FakeFlutterwave();
    const { payout } = await settledWithPayout();
    fw.rejectNextCreate = "Account is invalid";
    const outcome = await sendPayouts({ db, flutterwave: fw, now: hours(3, WINDOW_START) });
    expect(outcome.failed).toBe(1);
    const [row] = await q<{ status: string; last_error: string }>(`select status, last_error from money_payouts where id = $1`, [payout.id]);
    expect(row).toMatchObject({ status: "failed", last_error: "Account is invalid" });
  });

  it("only pays name-matched accounts, and reminds the farmer daily", async () => {
    const fw = new FakeFlutterwave();
    const { b } = await settledWithPayout();
    await q(`update payout_accounts set name_match = false where farmer_id = $1`, [b.farmer.id]);

    await sendPayouts({ db, flutterwave: fw, now: hours(3, WINDOW_START) });
    expect(fw.createCalls).toBe(0);

    await call("money_sweep", { p_now: hours(3, WINDOW_START).toISOString() });
    expect(await q(`select 1 from sms_outbox where body like '%Add a bank account%'`)).toHaveLength(1);
  });

  it("stores a mismatched account as unmatched, and refuses one already on another farmer", async () => {
    const fw = new FakeFlutterwave();
    const amina = await makeUser("farmer", "Amina Bello");
    const other = await makeUser("farmer", "Chidi Obi");
    const add = (farmerId: string, accountNumber: string) =>
      addPayoutAccount({ farmerId, bankCode: "044", accountNumber }, { db, flutterwave: fw });

    expect(await add(amina.id, "0690000032")).toMatchObject({ ok: true, name_match: true });
    expect(await add(other.id, "0690000032")).toMatchObject({ code: "bank_account_in_use" });
    expect(await add(other.id, "0690000033")).toMatchObject({ ok: true, name_match: false });
  });
});

describe("reconciliation", () => {
  it("matches when buckets equal Flutterwave's balance plus in-flight payouts", async () => {
    const fw = new FakeFlutterwave();
    const { b, payout } = await settledWithPayout();
    await sendPayouts({ db, flutterwave: fw, now: hours(3, WINDOW_START) });

    fw.balance = 50_000_000 - payout.amount_kobo; // Flutterwave has already sent it.
    expect(await runReconciliation({ db, flutterwave: fw })).toMatchObject({ matched: true });

    const transfer = [...fw.transfers.values()][0];
    transfer.status = "SUCCESSFUL";
    await webhook(fw, transferEvent(transfer.id, payout.settlement_id));
    expect(await balance("farmer_paid", b.farmer.id)).toBe(payout.amount_kobo);
    expect(await runReconciliation({ db, flutterwave: fw })).toMatchObject({ matched: true });
    expect(await q(`select 1 from money_alerts where kind = 'reconciliation_mismatch'`)).toHaveLength(0);
  });

  it("detects a mismatch, writes an alert, and stops new payouts until resolved", async () => {
    const fw = new FakeFlutterwave();
    await settledWithPayout();
    fw.balance = 123;

    const result = await runReconciliation({ db, flutterwave: fw });
    expect(result).toMatchObject({ matched: false, difference_kobo: 50_000_000 - 123 });
    const alerts = await q<{ id: string }>(`select id from money_alerts where kind = 'reconciliation_mismatch'`);
    expect(alerts).toHaveLength(1);

    await sendPayouts({ db, flutterwave: fw, now: hours(3, WINDOW_START) });
    expect(fw.createCalls).toBe(0);

    const admin = await makeUser("admin");
    await call("money_resolve_alert", { p_alert: alerts[0].id, p_actor: admin.id });
    await sendPayouts({ db, flutterwave: fw, now: hours(3, WINDOW_START) });
    expect(fw.createCalls).toBe(1);
  });

  it("accounts for provider fees on deposits and transfers", async () => {
    const fw = new FakeFlutterwave();
    const buyer = await buyerWithAccount();
    await webhook(fw, deposit(fw, 1, buyer.ref, 1000, { feeKobo: 1_400 }));
    fw.balance = 100_000 - 1_400;
    expect(await runReconciliation({ db, flutterwave: fw })).toMatchObject({ matched: true });
    expect(await ledgerTotal()).toBe(0);
  });
});

describe("the job", () => {
  it("runs the sweep, payouts and SMS together", async () => {
    const fw = new FakeFlutterwave();
    const sms = new FakeSms();
    await settledWithPayout();
    const result = await runMoneyJob({ db, flutterwave: fw, sms, now: hours(3, WINDOW_START) });
    expect(result.payouts.sent).toBe(1);
    expect(sms.sent.length).toBeGreaterThan(0);
  });

  it("requeues an SMS that fails to send", async () => {
    const sms = new FakeSms();
    const b = await makeUser("farmer");
    await call("money_sms", { p_phone: b.phone, p_body: "hello" });
    sms.failing = true;
    await sendOutbox({ db, sms });
    sms.failing = false;
    await sendOutbox({ db, sms });
    expect(sms.sent).toEqual([{ phone: b.phone, body: "hello" }]);
  });
});

describe("the Flutterwave client", () => {
  const fakeFetch = (handler: (url: string, init: RequestInit) => unknown, status = 200) =>
    (async (url: string, init: RequestInit) => {
      const body = handler(url, init);
      return new Response(JSON.stringify(body), { status });
    }) as unknown as typeof fetch;

  it("resolves accounts with POST and a JSON body, as documented", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const client = createFlutterwaveClient("key", fakeFetch((url, init) => {
      seen = { url, init };
      return { status: "success", data: { account_name: "AMINA BELLO" } };
    }));
    expect(await client.resolveAccount("044", "0690000032")).toBe("AMINA BELLO");
    expect(seen?.url).toMatch(/\/accounts\/resolve$/);
    expect(seen?.init.method).toBe("POST");
    expect(JSON.parse(String(seen?.init.body))).toEqual({ account_number: "0690000032", account_bank: "044" });
  });

  it("sends transfers in naira, with the reference", async () => {
    let sent: Record<string, unknown> = {};
    const client = createFlutterwaveClient("key", fakeFetch((_, init) => {
      sent = JSON.parse(String(init.body));
      return { status: "success", data: { id: 1, status: "NEW", reference: "r", amount: 323400.5 } };
    }));
    const transfer = await client.createTransfer({ reference: "r", amountKobo: 32_340_050, bankCode: "044", accountNumber: "1", accountName: null });
    expect(sent).toMatchObject({ amount: 323400.5, reference: "r", currency: "NGN" });
    expect(transfer.amountKobo).toBe(32_340_050);
  });

  it("only trusts a filtered list after checking each row's reference", async () => {
    const client = createFlutterwaveClient("key", fakeFetch(() => ({
      status: "success",
      data: [{ id: 1, status: "SUCCESSFUL", reference: "other", amount: 1 }],
    })));
    expect(await client.findTransferByReference("mine")).toBeNull();
  });
});
