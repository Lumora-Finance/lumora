import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { RULES } from "../../lib/money/rules";
import {
  arrive, available, balance, book, call, CONFIRM_BY, CONFIRM_DEADLINE, confirmedBooking, db, fund, hold, hours,
  ledgerTotal, makeSlot, makeUser, pool, PRICE, q, record, resetDb, status, sweep, WINDOW_END, WINDOW_START,
} from "./helpers";

beforeEach(resetDb);
afterAll(() => pool.end());

const RESERVE = 12_250_000; // 10 x 3.5kg x ₦3,500

describe("confirmation", () => {
  it("asks the farmer at confirm_by, once", async () => {
    const slot = await makeSlot();
    await fund(slot.buyer.id, 50_000_000);
    const farmer = await makeUser("farmer");
    await book(slot.slotId, farmer.id, 10);

    await sweep(hours(47));
    expect((await q(`select 1 from sms_outbox where phone = $1`, [farmer.phone])).length).toBe(0);

    await sweep(CONFIRM_BY);
    await sweep(hours(49));
    const sent = await q<{ body: string }>(`select body from sms_outbox where phone = $1`, [farmer.phone]);
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toMatch(/^Reply YES to confirm 10 /);
  });

  it("releases the full reserve and reopens capacity when there's no YES", async () => {
    const slot = await makeSlot();
    await fund(slot.buyer.id, 50_000_000);
    const farmer = await makeUser("farmer");
    const booked = await book(slot.slotId, farmer.id, 10);

    await sweep(hours(53));
    expect(await status(booked.booking_id)).toBe("booked");

    await sweep(CONFIRM_DEADLINE);
    expect(await status(booked.booking_id)).toBe("released");
    expect(await available(slot.buyer.id)).toBe(50_000_000);
    expect(await hold(booked.booking_id)).toBe(0);
    const [row] = await q<{ capacity_remaining: number }>(`select capacity_remaining from slots where id = $1`, [slot.slotId]);
    expect(row.capacity_remaining).toBe(80);
  });

  it("tells at most 10 followers about freed capacity", async () => {
    const slot = await makeSlot();
    await fund(slot.buyer.id, 50_000_000);
    const farmer = await makeUser("farmer");
    const followers = await Promise.all(Array.from({ length: 12 }, () => makeUser("farmer")));
    const elsewhere = await makeUser("farmer", "Far away", "Abuja");
    for (const follower of [...followers, elsewhere]) {
      await q(`insert into commodity_follows values ($1, $2)`, [follower.id, slot.commodityId]);
    }
    await book(slot.slotId, farmer.id, 10);
    await sweep(CONFIRM_DEADLINE);

    const offers = await q<{ phone: string }>(`select phone from sms_outbox where body like '%freed up%'`);
    expect(offers).toHaveLength(RULES.FREED_SMS_MAX_FARMERS);
    expect(offers.map((offer) => offer.phone)).not.toContain(elsewhere.phone);
  });
});

describe("no-show", () => {
  it("fires only after window end + grace: full release, strike, fee queued", async () => {
    const b = await confirmedBooking();

    await sweep(hours(1, WINDOW_END));
    expect(await status(b.booking.booking_id)).toBe("confirmed");

    await sweep(hours(RULES.NO_SHOW_GRACE_HOURS, WINDOW_END));
    expect(await status(b.booking.booking_id)).toBe("no_show");
    expect(await available(b.buyer.id)).toBe(50_000_000);

    const strikes = await q(`select 1 from strikes where farmer_id = $1 and kind = 'no_show'`, [b.farmer.id]);
    expect(strikes).toHaveLength(1);
    const [fee] = await q<{ amount_kobo: string }>(`select amount_kobo from money_pending_fees where farmer_id = $1`, [b.farmer.id]);
    expect(Number(fee.amount_kobo)).toBe(RESERVE * 0.05);
    // It's only queued. Nothing was charged upfront.
    expect(await balance("lumora_revenue")).toBe(0);
  });

  it("collects the fee from the next payout and credits part of it to the buyer", async () => {
    const missed = await confirmedBooking();
    await sweep(hours(2, WINDOW_END));
    const fee = RESERVE * 0.05; // ₦6,125

    const slot = await makeSlot();
    await q(`update slots set cutoff_at = $1 where id = $2`, [hours(200), slot.slotId]);
    await fund(slot.buyer.id, 50_000_000);
    const next = await book(slot.slotId, missed.farmer.id, 10, hours(100));
    const later = { booking: next, buyer: slot.buyer, farmer: missed.farmer };
    await q(`update bookings set status = 'confirmed' where id = $1`, [next.booking_id]);
    await arrive(later, hours(101));
    await record(later, 30, hours(102));
    await call("money_farmer_reply", { p_booking: later.booking.booking_id, p_farmer: missed.farmer.id, p_reply: "yes", p_now: hours(103).toISOString() });

    const gross = 30 * PRICE;
    expect(await balance("farmer_pending", missed.farmer.id)).toBe(gross - fee);
    expect(await available(missed.buyer.id)).toBe(50_000_000 + fee / 2);
    const [row] = await q<{ collected_kobo: string }>(`select collected_kobo from money_pending_fees where farmer_id = $1`, [missed.farmer.id]);
    expect(Number(row.collected_kobo)).toBe(fee);
    expect(await ledgerTotal()).toBe(0);
  });

  it("counts a farmer's cancellation after the cut-off as a no-show, and before it as free", async () => {
    const late = await confirmedBooking();
    await call("money_cancel_farmer", { p_booking: late.booking.booking_id, p_farmer: late.farmer.id, p_now: hours(50).toISOString() });
    expect(await status(late.booking.booking_id)).toBe("no_show");

    const early = await confirmedBooking();
    await call("money_cancel_farmer", { p_booking: early.booking.booking_id, p_farmer: early.farmer.id, p_now: hours(10).toISOString() });
    expect(await status(early.booking.booking_id)).toBe("cancelled");
    expect(await q(`select 1 from strikes where farmer_id = $1`, [early.farmer.id])).toHaveLength(0);
    expect(await q(`select 1 from money_pending_fees where farmer_id = $1`, [early.farmer.id])).toHaveLength(0);
  });
});

describe("buyer doesn't record", () => {
  it("settles booked qty x minimum weight and strikes the buyer", async () => {
    const b = await confirmedBooking();
    const arrived = hours(0, WINDOW_START);
    await arrive(b, arrived);

    await sweep(hours(1, arrived));
    expect(await status(b.booking.booking_id)).toBe("confirmed");

    await sweep(hours(RULES.BUYER_RECORD_HOURS, arrived));
    expect(await status(b.booking.booking_id)).toBe("settled");
    const gross = 10 * 2.5 * PRICE;
    expect(await balance("farmer_pending", b.farmer.id)).toBe(gross);
    expect(await q(`select 1 from strikes where buyer_id = $1 and kind = 'no_record'`, [b.buyer.id])).toHaveLength(1);
    expect(await ledgerTotal()).toBe(0);
  });

  it("refuses a record after the deadline", async () => {
    const b = await confirmedBooking();
    await arrive(b, WINDOW_START);
    expect(await record(b, 30, hours(RULES.BUYER_RECORD_HOURS, WINDOW_START))).toMatchObject({ code: "record_deadline_passed" });
  });
});

describe("farmer doesn't reply", () => {
  it("auto-confirms and settles after FARMER_REPLY_HOURS", async () => {
    const b = await confirmedBooking();
    await arrive(b, WINDOW_START);
    const recorded = hours(1, WINDOW_START);
    await record(b, 30, recorded);

    await sweep(hours(1, recorded));
    expect(await status(b.booking.booking_id)).toBe("delivered");

    await sweep(hours(RULES.FARMER_REPLY_HOURS, recorded));
    expect(await status(b.booking.booking_id)).toBe("settled");
    const [delivery] = await q<{ auto_confirmed: boolean }>(`select auto_confirmed from deliveries where booking_id = $1`, [b.booking.booking_id]);
    expect(delivery.auto_confirmed).toBe(true);
  });
});

describe("dispute deadline", () => {
  it("pays the recorded weight and raises an alert if ops don't decide", async () => {
    const b = await confirmedBooking();
    await arrive(b, WINDOW_START);
    const recorded = hours(1, WINDOW_START);
    await record(b, 30, recorded);
    await call("money_farmer_reply", { p_booking: b.booking.booking_id, p_farmer: b.farmer.id, p_reply: "dispute", p_claim_kg: 34, p_now: recorded.toISOString() });
    expect(await status(b.booking.booking_id)).toBe("disputed");

    await sweep(hours(47, recorded));
    expect(await status(b.booking.booking_id)).toBe("disputed");

    await sweep(hours(RULES.DISPUTE_DECISION_HOURS, recorded));
    expect(await status(b.booking.booking_id)).toBe("settled");
    expect(await balance("farmer_pending", b.farmer.id)).toBe(30 * PRICE);
    expect(await q(`select 1 from money_alerts where kind = 'dispute_deadline_missed'`)).toHaveLength(1);
    const [dispute] = await q<{ decision: string }>(`select decision from disputes where booking_id = $1`, [b.booking.booking_id]);
    expect(dispute.decision).toBe("deadline_default");
  });
});

describe("the sweep", () => {
  it("does nothing the second time", async () => {
    const b = await confirmedBooking();
    await sweep(hours(2, WINDOW_END));
    const entries = await q(`select 1 from money_ledger`);
    const again = await sweep(hours(3, WINDOW_END));
    expect(again).toMatchObject({ no_show: 0, released: 0 });
    expect(await q(`select 1 from money_ledger`)).toHaveLength(entries.length);
    expect(await q(`select 1 from strikes where farmer_id = $1`, [b.farmer.id])).toHaveLength(1);
  });

  it("leaves no waiting state holding money once every deadline has passed", async () => {
    const a = await confirmedBooking();
    const c = await confirmedBooking();
    await arrive(c, WINDOW_START);
    const d = await confirmedBooking();
    await arrive(d, WINDOW_START);
    await record(d, 30, WINDOW_START);
    const e = await confirmedBooking();
    await arrive(e, WINDOW_START);
    await record(e, 30, WINDOW_START);
    await call("money_farmer_reply", { p_booking: e.booking.booking_id, p_farmer: e.farmer.id, p_reply: "dispute", p_now: WINDOW_START.toISOString() });

    await sweep(hours(24 * 30, WINDOW_END));

    const [held] = await q<{ total: string }>(`select coalesce(sum(amount_kobo), 0) as total from money_holds`);
    expect(Number(held.total)).toBe(0);
    expect(await balance("buyer_reserved", a.buyer.id)).toBe(0);
    expect(await ledgerTotal()).toBe(0);
    // What's left is buyers' money, farmers' money and fees, and all of it was deposited.
    expect(Number(await db.rpc("money_liabilities"))).toBe(4 * 50_000_000);
  });
});

describe("strikes against buyers", () => {
  it("pauses listings after two refused-code strikes", async () => {
    const slot = await makeSlot();
    await fund(slot.buyer.id, 50_000_000);
    const admin = await makeUser("admin");
    for (let i = 0; i < 2; i++) {
      const farmer = await makeUser("farmer");
      const booked = await book(slot.slotId, farmer.id, 5);
      await call("money_confirm_booking", { p_booking: booked.booking_id, p_farmer: farmer.id, p_now: hours(1).toISOString() });
      await call("money_report_refused_code", { p_booking: booked.booking_id, p_actor: admin.id, p_now: WINDOW_START.toISOString() });
    }
    const [listing] = await q<{ status: string; paused_reason: string }>(`select status, paused_reason from demand_listings where id = $1`, [slot.listingId]);
    expect(listing).toMatchObject({ status: "paused", paused_reason: "review" });
    expect(await available(slot.buyer.id)).toBe(50_000_000);
  });

  it("charges a late-cancelling buyer a fee to the farmer, with a strike", async () => {
    const b = await confirmedBooking();
    const result = await call("money_cancel_buyer", { p_booking: b.booking.booking_id, p_buyer: b.buyer.id, p_now: hours(50).toISOString() });
    const fee = RESERVE * 0.05;
    expect(result).toMatchObject({ ok: true, late_fee_kobo: fee });
    expect(await balance("farmer_pending", b.farmer.id)).toBe(fee);
    expect(await available(b.buyer.id)).toBe(50_000_000 - fee);
    expect(await q(`select 1 from strikes where buyer_id = $1 and kind = 'late_cancel'`, [b.buyer.id])).toHaveLength(1);
    expect(await ledgerTotal()).toBe(0);
  });
});
