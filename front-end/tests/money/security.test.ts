import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { arrive, book, call, confirmedBooking, fund, hours, makeSlot, makeUser, pool, q, record, resetDb, T0, WINDOW_START } from "./helpers";

beforeEach(resetDb);
afterAll(() => pool.end());

/** Runs a query as a signed-in client would, with row-level security applying. */
async function asUser(firebaseUid: string | null, sql: string, params: unknown[] = []) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [firebaseUid ? JSON.stringify({ sub: firebaseUid }) : ""]);
    await client.query(`set local role ${firebaseUid ? "authenticated" : "anon"}`);
    return (await client.query(sql, params)).rows;
  } finally {
    await client.query("rollback");
    client.release();
  }
}

async function twoBookings() {
  const mine = await confirmedBooking();
  const theirs = await confirmedBooking();
  await arrive(mine, WINDOW_START);
  await record(mine, 30, hours(1, WINDOW_START));
  await arrive(theirs, WINDOW_START);
  await record(theirs, 30, hours(1, WINDOW_START));
  const fb = async (id: string) => (await q<{ firebase_uid: string }>(`select firebase_uid from users where id = $1`, [id]))[0].firebase_uid;
  return { mine, theirs, farmerUid: await fb(mine.farmer.id), buyerUid: await fb(mine.buyer.id) };
}

const BOOKING_COLUMNS = "id, farmer_id, buyer_id, status";

describe("row-level security", () => {
  it("shows farmers only their bookings", async () => {
    const { mine, farmerUid } = await twoBookings();
    const rows = await asUser(farmerUid, `select ${BOOKING_COLUMNS} from bookings`);
    expect(rows.map((row) => row.id)).toEqual([mine.booking.booking_id]);
  });

  it("shows buyers only their bookings and deliveries", async () => {
    const { mine, buyerUid } = await twoBookings();
    expect((await asUser(buyerUid, `select ${BOOKING_COLUMNS} from bookings`)).map((row) => row.id)).toEqual([mine.booking.booking_id]);
    expect((await asUser(buyerUid, `select booking_id from deliveries`)).map((row) => row.booking_id)).toEqual([mine.booking.booking_id]);
  });

  it("never lets a client read the delivery code hash", async () => {
    const { farmerUid } = await twoBookings();
    await expect(asUser(farmerUid, `select delivery_code_hash from bookings`)).rejects.toThrow(/permission denied/);
    await expect(asUser(farmerUid, `select * from bookings`)).rejects.toThrow(/permission denied/);
  });

  it("shows clients their own balance only, and nothing from the ledger or audit log", async () => {
    const { mine, buyerUid } = await twoBookings();
    const balances = await asUser(buyerUid, `select owner_id from money_balances`);
    expect(new Set(balances.map((row) => row.owner_id))).toEqual(new Set([mine.buyer.id]));
    await expect(asUser(buyerUid, `select * from money_ledger`)).rejects.toThrow(/permission denied/);
    await expect(asUser(buyerUid, `select * from money_events`)).rejects.toThrow(/permission denied/);
    await expect(asUser(buyerUid, `select * from money_alerts`)).rejects.toThrow(/permission denied/);
  });

  it("doesn't let clients write", async () => {
    const { mine, farmerUid } = await twoBookings();
    await expect(asUser(farmerUid, `update bookings set status = 'settled' where id = $1`, [mine.booking.booking_id])).rejects.toThrow(/permission denied/);
    await expect(asUser(farmerUid, `insert into strikes (kind, buyer_id) values ('no_show', $1)`, [mine.buyer.id])).rejects.toThrow(/permission denied/);
  });

  it("doesn't let clients call money functions", async () => {
    const { mine, farmerUid } = await twoBookings();
    await expect(asUser(farmerUid, `select money_mark_paid($1, 1)`, [mine.booking.booking_id])).rejects.toThrow(/permission denied/);
    await expect(asUser(farmerUid, `select money_credit_deposit(1, 'x', 1, 0, 'bank')`)).rejects.toThrow(/permission denied/);
    await expect(asUser(farmerUid, `select book_slot($1, $2, 1)`, [mine.slotId, mine.farmer.id])).rejects.toThrow(/permission denied/);
  });

  it("gives anonymous visitors the board and nothing else", async () => {
    const slot = await makeSlot();
    await fund(slot.buyer.id, 50_000_000);
    const farmer = await makeUser("farmer");
    await book(slot.slotId, farmer.id, 5, T0);
    expect(await asUser(null, `select id from slots`)).toHaveLength(1);
    await expect(asUser(null, `select ${BOOKING_COLUMNS} from bookings`)).rejects.toThrow(/permission denied/);
    await expect(asUser(null, `select * from users`)).rejects.toThrow(/permission denied/);
  });

  it("refuses one account per phone number at the database", async () => {
    const user = await makeUser("farmer");
    await expect(q(`insert into users (phone, name, role) values ($1, 'x', 'farmer')`, [user.phone])).rejects.toThrow(/unique/);
  });
});

describe("pair flagging", () => {
  it("flags a pair past 5 trades and 80%, once", async () => {
    const farmer = await makeUser("farmer");
    const buyer = await makeUser("buyer");
    const slot = await makeSlot({ buyer });
    for (let i = 0; i < 5; i++) {
      await q(`insert into bookings (slot_id, farmer_id, buyer_id, qty, code, status) values ($1, $2, $3, 1, $4, 'settled')`, [slot.slotId, farmer.id, buyer.id, `LM-1000${i}`]);
    }
    expect(await call("money_flag_pairs" as string)).toBe(1);
    expect(await call("money_flag_pairs" as string)).toBe(0);
    expect(await q(`select 1 from money_alerts where kind = 'pair_concentration'`)).toHaveLength(1);
  });

  it("leaves a farmer who sells widely alone", async () => {
    const farmer = await makeUser("farmer");
    const buyers = await Promise.all(Array.from({ length: 3 }, () => makeUser("buyer")));
    let n = 0;
    for (const buyer of buyers) {
      const slot = await makeSlot({ buyer });
      const other = await makeUser("farmer");
      for (let i = 0; i < 2; i++) {
        await q(`insert into bookings (slot_id, farmer_id, buyer_id, qty, code, status) values ($1, $2, $3, 1, $4, 'settled')`, [slot.slotId, farmer.id, buyer.id, `LM-2${n++}`]);
        await q(`insert into bookings (slot_id, farmer_id, buyer_id, qty, code, status) values ($1, $2, $3, 1, $4, 'settled')`, [slot.slotId, other.id, buyer.id, `LM-2${n++}`]);
      }
    }
    expect(await call("money_flag_pairs" as string)).toBe(0);
  });
});
