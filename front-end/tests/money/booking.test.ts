import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { bookSlot } from "../../lib/money/booking";
import { RULES } from "../../lib/money/rules";
import {
  available, book, call, CUTOFF, FakeSms, fund, hold, hours, makeSlot, makeUser, pool, q, resetDb, status, sweep, T0,
} from "./helpers";

beforeEach(resetDb);
afterAll(() => pool.end());

describe("book_slot", () => {
  it("never books more than capacity with 20 parallel bookings against 50 left", async () => {
    const slot = await makeSlot({ capacity: 50 });
    // Cheap enough that capacity is the limit here, not the buyer's balance.
    await q(`update demand_listings set unit_price_kobo = 100000 where id = $1`, [slot.listingId]);
    await fund(slot.buyer.id, 50_000_000);
    const farmers = await Promise.all(Array.from({ length: 20 }, () => makeUser("farmer")));

    const results = await Promise.all(farmers.map((farmer) => book(slot.slotId, farmer.id, 5)));

    const won = results.filter((result) => result.ok);
    expect(won.length).toBe(10);
    expect(results.filter((result) => result.code === "only_n_left").length).toBe(10);
    const [row] = await q<{ capacity_remaining: number }>(`select capacity_remaining from slots where id = $1`, [slot.slotId]);
    expect(row.capacity_remaining).toBe(0);
    const [sum] = await q<{ total: string }>(`select sum(qty) as total from bookings where slot_id = $1`, [slot.slotId]);
    expect(Number(sum.total)).toBe(50);
  });

  it("never reserves more than the balance across parallel bookings on two slots", async () => {
    const first = await makeSlot();
    const second = await makeSlot({ buyer: first.buyer });
    // Enough for exactly one booking of 10: 10 x 3.5kg x ₦3,500.
    await fund(first.buyer.id, 12_250_000);
    const farmers = await Promise.all(Array.from({ length: 6 }, () => makeUser("farmer")));

    const results = await Promise.all(
      farmers.map((farmer, index) => book(index % 2 ? first.slotId : second.slotId, farmer.id, 10)),
    );

    expect(results.filter((result) => result.ok).length).toBe(1);
    expect(await available(first.buyer.id)).toBe(0);
  });

  it("works out the reserve from the maximum weight, rounded up to the kobo", async () => {
    const slot = await makeSlot();
    await q(`update demand_listings set max_unit_weight_kg = 2.333, unit_price_kobo = 100001 where id = $1`, [slot.listingId]);
    await fund(slot.buyer.id, 50_000_000);
    const farmer = await makeUser("farmer");
    const result = await book(slot.slotId, farmer.id, 1);
    expect(result.reserve_kobo).toBe(233_303); // 2.333 x 100001 = 233302.333
    expect(await hold(result.booking_id)).toBe(233_303);
  });

  it("rejects a booking when the balance is short, and pauses the listing", async () => {
    const slot = await makeSlot();
    await fund(slot.buyer.id, 1_000);
    const farmer = await makeUser("farmer");

    const result = await book(slot.slotId, farmer.id, 10);

    expect(result).toMatchObject({ ok: false, code: "insufficient_funds" });
    const [listing] = await q<{ status: string }>(`select status from demand_listings where id = $1`, [slot.listingId]);
    expect(listing.status).toBe("paused");
    expect(await available(slot.buyer.id)).toBe(1_000);
    expect((await q(`select 1 from bookings`)).length).toBe(0);

    // Funding brings it back, so a pause isn't permanent.
    await fund(slot.buyer.id, 50_000_000);
    const [after] = await q<{ status: string }>(`select status from demand_listings where id = $1`, [slot.listingId]);
    expect(after.status).toBe("active");
  });

  it.each([
    ["below the listing minimum", { minQty: 10 }, 5, "below_minimum"],
    ["over what's left", { capacity: 4 }, 5, "only_n_left"],
  ])("rejects a booking %s", async (_, options, qty, code) => {
    const slot = await makeSlot(options);
    await fund(slot.buyer.id, 50_000_000);
    const farmer = await makeUser("farmer");
    expect(await book(slot.slotId, farmer.id, qty)).toMatchObject({ ok: false, code });
  });

  it("rejects after the cut-off", async () => {
    const slot = await makeSlot();
    await fund(slot.buyer.id, 50_000_000);
    const farmer = await makeUser("farmer");
    expect(await book(slot.slotId, farmer.id, 5, CUTOFF)).toMatchObject({ code: "past_cutoff" });
  });

  it("holds a declared stock limit, across bookings", async () => {
    const slot = await makeSlot();
    const other = await makeSlot();
    await q(`update demand_listings set commodity_id = $1 where id = $2`, [slot.commodityId, other.listingId]);
    await fund(slot.buyer.id, 50_000_000);
    await fund(other.buyer.id, 50_000_000);
    const farmer = await makeUser("farmer");
    await q(`insert into producer_stock (farmer_id, commodity_id, date, qty_declared) values ($1, $2, '2026-12-10', 8)`, [farmer.id, slot.commodityId]);

    expect((await book(slot.slotId, farmer.id, 5)).ok).toBe(true);
    expect(await book(other.slotId, farmer.id, 5)).toMatchObject({ code: "over_declared_stock", remaining: 3 });
  });

  it("caps a new farmer's first booking, even split across two", async () => {
    const slot = await makeSlot();
    await fund(slot.buyer.id, 500_000_00);
    const farmer = await makeUser("farmer");
    expect(await book(slot.slotId, farmer.id, RULES.NEW_FARMER_FIRST_BOOKING_CAP + 1)).toMatchObject({ code: "new_farmer_cap" });
    expect((await book(slot.slotId, farmer.id, 15)).ok).toBe(true);
    expect(await book(slot.slotId, farmer.id, 6)).toMatchObject({ code: "new_farmer_cap" });
  });

  it("stores only a hash of the delivery code", async () => {
    const slot = await makeSlot();
    await fund(slot.buyer.id, 50_000_000);
    const farmer = await makeUser("farmer");
    const result = await book(slot.slotId, farmer.id, 5);
    expect(result.delivery_code).toMatch(/^\d{4}$/);
    const [row] = await q<{ delivery_code_hash: string }>(`select delivery_code_hash from bookings where id = $1`, [result.booking_id]);
    expect(row.delivery_code_hash).not.toContain(result.delivery_code);
    expect(row.delivery_code_hash).toMatch(/^\$2/);
    const logged = await q(`select 1 from money_events where after::text like '%' || $1 || '%' and entity = 'booking'`, [`"delivery_code"`]);
    expect(logged.length).toBe(0);
  });

  it("sends the code to the buyer and never returns it to the farmer", async () => {
    const slot = await makeSlot();
    await fund(slot.buyer.id, 50_000_000);
    const farmer = await makeUser("farmer");
    const sms = new FakeSms();
    const { db } = await import("./helpers");

    const result = await bookSlot({ slotId: slot.slotId, farmerId: farmer.id, qty: 5, now: T0 }, { db, sms });

    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/delivery_code|buyer_phone/);
    expect(sms.sent).toHaveLength(1);
    expect(sms.sent[0].phone).toBe(slot.buyer.phone);
    expect(sms.sent[0].body).toMatch(/\d{4}$/);
  });

  it("doesn't let a buyer reduce capacity below what's booked", async () => {
    const slot = await makeSlot({ capacity: 50 });
    await fund(slot.buyer.id, 50_000_000);
    const farmer = await makeUser("farmer");
    await book(slot.slotId, farmer.id, 20);
    expect(await call("money_set_capacity", { p_slot: slot.slotId, p_buyer: slot.buyer.id, p_total: 10 })).toMatchObject({ code: "below_booked", booked: 20 });
    expect(await call("money_set_capacity", { p_slot: slot.slotId, p_buyer: slot.buyer.id, p_total: 25 })).toMatchObject({ ok: true, capacity_remaining: 5 });
  });

  it("bars a farmer for 14 days after two no-shows in 30 days", async () => {
    const farmer = await makeUser("farmer");
    for (const day of [0, 10]) {
      const slot = await makeSlot();
      const [b] = await q<{ id: string }>(
        `insert into bookings (slot_id, farmer_id, buyer_id, qty, code) values ($1, $2, $3, 1, $4) returning id`,
        [slot.slotId, farmer.id, slot.buyer.id, `LM-9${day}`],
      );
      await q(`insert into strikes (farmer_id, booking_id, kind, created_at) values ($1, $2, 'no_show', $3)`, [farmer.id, b.id, hours(day * 24)]);
    }
    const slot = await makeSlot();
    await q(`update slots set cutoff_at = $1, window_start = $1, window_end = $1 where id = $2`, [hours(24 * 60), slot.slotId]);
    await fund(slot.buyer.id, 50_000_000);

    expect(await book(slot.slotId, farmer.id, 1, hours(24 * 23))).toMatchObject({ code: "farmer_banned" });
    expect((await book(slot.slotId, farmer.id, 1, hours(24 * 25))).ok).toBe(true);
  });

  it("releases capacity and keeps it bookable after the cut-off", async () => {
    const slot = await makeSlot();
    await fund(slot.buyer.id, 50_000_000);
    const farmer = await makeUser("farmer");
    const other = await makeUser("farmer");
    await q(`insert into commodity_follows values ($1, $2)`, [other.id, slot.commodityId]);
    const booked = await book(slot.slotId, farmer.id, 10);

    await sweep(hours(54));

    expect(await status(booked.booking_id)).toBe("released");
    const outbox = await q<{ phone: string; body: string }>(`select phone, body from sms_outbox where phone = $1`, [other.phone]);
    expect(outbox[0].body).toContain("freed up");
    // Past the normal cut-off, but before reopened_until.
    expect((await book(slot.slotId, other.id, 5, hours(60))).ok).toBe(true);
  });
});
