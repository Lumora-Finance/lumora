import { Pool } from "pg";

import type { MoneyDb, MoneyResult } from "../../lib/money/db";
import type { FlutterwaveClient, FlwTransaction, FlwTransfer } from "../../lib/money/flutterwave";
import type { SmsSender } from "../../lib/money/jobs";

export const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 30 });

export const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  (await pool.query(sql, params)).rows as T[];

/** The app's db interface, over a real connection, so tests run the real functions. */
export const db: MoneyDb = {
  async rpc<T>(fn: string, args: Record<string, unknown> = {}) {
    const names = Object.keys(args);
    const placeholders = names.map((name, index) => `${name} => $${index + 1}`).join(", ");
    const values = names.map((name) => {
      const value = args[name];
      // text[] parameters go as Postgres arrays, and everything else structured as JSON.
      const isTextArray = name === "p_scale_photos";
      return value !== null && typeof value === "object" && !isTextArray ? JSON.stringify(value) : value;
    });
    const { rows } = await pool.query(`select ${fn}(${placeholders}) as result`, values);
    return rows[0].result as T;
  },
};

export const call = (fn: string, args: Record<string, unknown> = {}) => db.rpc<MoneyResult>(fn, args);

export async function resetDb() {
  await pool.query(`truncate money_ledger, money_balances, money_holds, money_events, money_pending_fees,
    money_receivables, money_payouts, money_settlements, money_funding_accounts, money_deposits, money_alerts,
    email_outbox, action_tokens, notifications, backup_notified, backup_requests, code_reports, booking_codes,
    sms_outbox, sms_inbound, sms_menus, strikes, disputes, payout_accounts, deliveries, bookings, slots,
    demand_listings, commodity_follows, producer_stock, user_locations, listing_private, sms_onboarding, users cascade`);
  // The seeded commodities stay. Only the ones tests made go.
  await pool.query(`delete from commodities where name like 'broiler-%'`);
  await pool.query(`update money_flags set value = false`);
}

let phoneCounter = 0;
export async function makeUser(role: string, name = `${role} ${++phoneCounter}`, area = "Jos") {
  const phone = `+234800${String(++phoneCounter).padStart(7, "0")}`;
  const [row] = await q<{ id: string }>(
    `insert into users (phone, name, role, area, firebase_uid, email) values ($1, $2, $3, $4, $5, $6) returning id`,
    [phone, name, role, area, `fb-${phone}`, `user${phoneCounter}@example.test`],
  );
  return { id: row.id, phone, name, firebaseUid: `fb-${phone}` };
}

export const T0 = new Date("2026-12-07T08:00:00Z");
export const hours = (n: number, from: Date = T0) => new Date(from.getTime() + n * 3_600_000);

export const WINDOW_START = hours(72);
export const WINDOW_END = hours(76);
export const CUTOFF = hours(48);
export const CONFIRM_BY = hours(36); // cut-off - 12h
export const CONFIRM_DEADLINE = CUTOFF;
export const PRICE = 350_000; // ₦3,500/kg

let txCounter = 1000;
export async function fund(buyerId: string, kobo: number, now: Date = T0) {
  const ref = `ref-${buyerId}`;
  await q(`insert into money_funding_accounts (buyer_id, tx_ref) values ($1, $2) on conflict do nothing`, [buyerId, ref]);
  return call("money_credit_deposit", {
    p_tx_id: ++txCounter, p_tx_ref: ref, p_amount: kobo, p_provider_fee: 0,
    p_payment_type: "bank_transfer", p_now: now.toISOString(),
  });
}

export async function makeSlot(options: { capacity?: number; minQty?: number; buyer?: { id: string; phone: string; name: string } } = {}) {
  const buyer = options.buyer ?? (await makeUser("buyer"));
  const [area] = await q<{ id: string }>(`select id from areas where name = 'Angwan Rukuba'`);
  const [commodity] = await q<{ id: string }>(
    `insert into commodities (name) values ($1) returning id`,
    [`broiler-${++phoneCounter}`],
  );
  const capacity = options.capacity ?? 80;
  const [listing] = await q<{ id: string }>(
    `insert into demand_listings (buyer_id, commodity_id, unit_price_kobo, capacity_per_day, min_qty,
       min_unit_weight_kg, max_unit_weight_kg, area_id) values ($1, $2, $3, $4, $5, 2.5, 3.5, $6) returning id`,
    [buyer.id, commodity.id, PRICE, capacity, options.minQty ?? 1, area.id],
  );
  const [slot] = await q<{ id: string }>(
    `insert into slots (listing_id, date, window_start, window_end, cutoff_at, capacity_total, capacity_remaining)
     values ($1, $2, $3, $4, $5, $6, $6) returning id`,
    [listing.id, "2026-12-10", WINDOW_START, WINDOW_END, CUTOFF, capacity],
  );
  return { buyer, commodityId: commodity.id, listingId: listing.id, slotId: slot.id };
}

export const available = async (id: string) => Number(await db.rpc("wallet_get_available", { p_buyer: id }));

export async function balance(bucket: string, owner?: string) {
  const [row] = await q<{ balance_kobo: string }>(
    `select balance_kobo from money_balances where bucket = $1 and owner_id = coalesce($2::uuid, '00000000-0000-0000-0000-000000000000')`,
    [bucket, owner ?? null],
  );
  return Number(row?.balance_kobo ?? 0);
}

export const hold = async (bookingId: string) =>
  Number((await q<{ amount_kobo: string }>(`select amount_kobo from money_holds where booking_id = $1`, [bookingId]))[0]?.amount_kobo ?? 0);

export const status = async (bookingId: string) =>
  (await q<{ status: string }>(`select status from bookings where id = $1`, [bookingId]))[0].status;

export const sweep = (now: Date) => call("money_sweep", { p_now: now.toISOString() });

export async function book(slotId: string, farmerId: string, qty: number, now: Date = T0) {
  const result = await call("book_slot", { p_slot: slotId, p_farmer: farmerId, p_qty: qty, p_now: now.toISOString() });
  return result as MoneyResult & { booking_id: string; delivery_code: string; code: string; reserve_kobo: number };
}

/** A funded, confirmed booking of 10 birds, reserve 10 x 3.5kg x ₦3,500 = ₦122,500. */
export async function confirmedBooking(options: { qty?: number; fundKobo?: number } = {}) {
  const slot = await makeSlot();
  const farmer = await makeUser("farmer");
  await fund(slot.buyer.id, options.fundKobo ?? 50_000_000);
  const booked = await book(slot.slotId, farmer.id, options.qty ?? 10);
  await call("money_confirm_booking", { p_booking: booked.booking_id, p_farmer: farmer.id, p_now: hours(1).toISOString() });
  return { ...slot, farmer, booking: booked };
}

export async function arrive(b: { booking: { booking_id: string; delivery_code: string }; farmer: { id: string } }, now: Date) {
  return call("money_submit_code", {
    p_booking: b.booking.booking_id, p_farmer: b.farmer.id, p_digits: b.booking.delivery_code, p_now: now.toISOString(),
  });
}

export async function record(b: { booking: { booking_id: string }; buyer: { id: string } }, kg: number, now: Date, units = 10) {
  return call("money_record_delivery", {
    p_booking: b.booking.booking_id, p_buyer: b.buyer.id, p_units_received: units, p_units_declined: 0,
    p_decline_reasons: [] as unknown as object, p_measured_kg: kg, p_scale_photos: ["https://x/scale.jpg"], p_now: now.toISOString(),
  });
}

/** What one person has been told, oldest first. */
export const notices = (userId: string, kind?: string) =>
  q<{ kind: string; data: Record<string, unknown>; booking_id: string | null }>(
    `select kind, data, booking_id from notifications where user_id = $1 and ($2::text is null or kind = $2) order by created_at, id`,
    [userId, kind ?? null],
  );

/** Every entry moves money from somewhere to somewhere, so the buckets must always net to zero. */
export async function ledgerTotal() {
  const [row] = await q<{ total: string }>(`select coalesce(sum(balance_kobo), 0) as total from money_balances`);
  return Number(row.total);
}

export class FakeFlutterwave implements FlutterwaveClient {
  transactions = new Map<number, FlwTransaction>();
  transfers = new Map<number, FlwTransfer>();
  createCalls = 0;
  retryCalls = 0;
  balance = 0;
  refunds: [number, number][] = [];
  rejectNextCreate: string | null = null;
  failAfterCreate = false;
  private nextId = 5000;

  async verifyTransaction(id: number) {
    const found = this.transactions.get(id);
    if (!found) throw new Error("not found");
    return found;
  }
  async getTransfer(id: number) {
    const found = this.transfers.get(id);
    if (!found) throw new Error("not found");
    return found;
  }
  async findTransferByReference(reference: string) {
    return [...this.transfers.values()].find((transfer) => transfer.reference === reference) ?? null;
  }
  async createTransfer(input: { reference: string; amountKobo: number }) {
    this.createCalls += 1;
    if (this.rejectNextCreate) {
      const { FlutterwaveRejected } = await import("../../lib/money/flutterwave");
      const message = this.rejectNextCreate;
      this.rejectNextCreate = null;
      throw new FlutterwaveRejected(message);
    }
    const transfer: FlwTransfer = { id: ++this.nextId, status: "NEW", reference: input.reference, amountKobo: input.amountKobo, feeKobo: 0 };
    this.transfers.set(transfer.id, transfer);
    if (this.failAfterCreate) {
      this.failAfterCreate = false;
      throw new Error("network dropped after Flutterwave accepted");
    }
    return transfer;
  }
  async retryTransfer(id: number) {
    this.retryCalls += 1;
    const old = await this.getTransfer(id);
    const transfer: FlwTransfer = { ...old, id: ++this.nextId, status: "NEW", reference: `${old.reference}_PMCK_1` };
    this.transfers.set(transfer.id, transfer);
    return transfer;
  }
  async resolveAccount() {
    return "AMINA BELLO";
  }
  async ledgerBalanceKobo() {
    return this.balance;
  }
  async refund(id: number, kobo: number) {
    this.refunds.push([id, kobo]);
  }
  async createVirtualAccount() {
    return { accountNumber: "0000000000", bankName: "Test", orderRef: null };
  }
}

export class FakeMailer {
  sent: { id: string; to: string; subject: string; html: string; text: string }[] = [];
  failing = false;
  async send(email: { id: string; to: string; subject: string; html: string; text: string }) {
    if (this.failing) throw new Error("Email down");
    this.sent.push(email);
  }
}

export class FakeSms implements SmsSender {
  sent: { phone: string; body: string }[] = [];
  failing = false;
  async send(phone: string, body: string) {
    if (this.failing) throw new Error("SMS down");
    this.sent.push({ phone, body });
  }
}
