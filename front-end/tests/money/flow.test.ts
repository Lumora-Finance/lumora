import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { signActionToken, verifyActionToken } from "../../lib/email/action-tokens";
import { sendEmails } from "../../lib/email/send";
import { roadKm } from "../../lib/geo";
import { RULES } from "../../lib/money/rules";
import {
  arrive, available, balance, book, call, confirmedBooking, CUTOFF, db, FakeMailer, fund, hold, hours, ledgerTotal, makeSlot,
  makeUser, notices, pool, PRICE, q, record, resetDb, status, sweep, T0, WINDOW_END, WINDOW_START,
} from "./helpers";

beforeEach(resetDb);
afterAll(() => pool.end());

const FUNDS = 50_000_000;
const MIN_10 = 10 * 2.5 * PRICE; // Booked qty x minimum weight x price.
const RESERVE_10 = 10 * 3.5 * PRICE;
const MID_WINDOW = hours(74);

const capacityLeft = async (slotId: string) =>
  (await q<{ capacity_remaining: number }>(`select capacity_remaining from slots where id = $1`, [slotId]))[0].capacity_remaining;

const iso = (date: Date) => date.toISOString();

/** A confirmed 10-unit booking for this farmer, with its dates moved `days` later. */
async function confirmedFor(farmer: { id: string }, days = 0, options: { fundKobo?: number } = {}) {
  const slot = await makeSlot();
  await fund(slot.buyer.id, options.fundKobo ?? FUNDS);
  const shift = `${days} days`;
  await q(
    `update slots set window_start = window_start + $2::interval, window_end = window_end + $2::interval,
       cutoff_at = cutoff_at + $2::interval, date = date + $3::int where id = $1`,
    [slot.slotId, shift, days],
  );
  const at = hours(days * 24 + 1);
  const booking = await book(slot.slotId, farmer.id, 10, at);
  await call("money_confirm_booking", { p_booking: booking.booking_id, p_farmer: farmer.id, p_now: iso(at) });
  return {
    ...slot, farmer, booking,
    start: hours(days * 24, WINDOW_START),
    end: hours(days * 24, WINDOW_END),
  };
}

/** Delivers and settles at the given weight. */
async function deliver(b: Awaited<ReturnType<typeof confirmedFor>>, kg = 30) {
  await arrive(b, b.start);
  await record(b, kg, hours(1, b.start));
  return call("money_farmer_reply", { p_booking: b.booking.booking_id, p_farmer: b.farmer.id, p_reply: "yes", p_now: iso(hours(2, b.start)) });
}

describe("partial bookings", () => {
  it("20 and 10 fill 30, and a third farmer can't book more", async () => {
    const slot = await makeSlot({ capacity: 30 });
    await fund(slot.buyer.id, FUNDS);
    const [amina, bala, chidi] = await Promise.all([makeUser("farmer", "Amina"), makeUser("farmer"), makeUser("farmer")]);

    expect((await book(slot.slotId, amina.id, 20)).ok).toBe(true);
    expect(await capacityLeft(slot.slotId)).toBe(10);
    expect((await book(slot.slotId, bala.id, 10)).ok).toBe(true);
    expect(await capacityLeft(slot.slotId)).toBe(0);
    expect(await book(slot.slotId, chidi.id, 1)).toMatchObject({ code: "only_n_left", remaining: 0 });
    expect(await ledgerTotal()).toBe(0);
  });
});

describe("first-time approval", () => {
  it("books instantly with approval off", async () => {
    const slot = await makeSlot();
    await fund(slot.buyer.id, FUNDS);
    const farmer = await makeUser("farmer");
    const booked = await book(slot.slotId, farmer.id, 10);
    expect(await status(booked.booking_id)).toBe("booked");
    expect(await notices(farmer.id, "booking_confirmed")).toHaveLength(1);
    expect(await notices(slot.buyer.id, "booking_received")).toHaveLength(1);
    expect(await notices(slot.buyer.id, "approval_request")).toHaveLength(0);
  });

  it("holds the place and the money while pending, then auto-approves after 2 hours", async () => {
    const slot = await makeSlot({ capacity: 30 });
    await fund(slot.buyer.id, FUNDS);
    await call("money_set_approve_first_time", { p_buyer: slot.buyer.id, p_on: true });
    const farmer = await makeUser("farmer");
    const booked = await book(slot.slotId, farmer.id, 10);

    expect(await status(booked.booking_id)).toBe("pending_approval");
    expect(await capacityLeft(slot.slotId)).toBe(20);
    expect(await hold(booked.booking_id)).toBe(RESERVE_10);
    expect(await notices(slot.buyer.id, "approval_request")).toHaveLength(1);

    await sweep(hours(1));
    expect(await status(booked.booking_id)).toBe("pending_approval");
    await sweep(hours(RULES.FIRST_TIME_APPROVAL_HOURS));
    expect(await status(booked.booking_id)).toBe("booked");
    expect(await notices(farmer.id, "booking_confirmed")).toHaveLength(1);
  });

  it("releases the money and the quantity on a decline, and tells the farmer", async () => {
    const slot = await makeSlot({ capacity: 30 });
    await fund(slot.buyer.id, FUNDS);
    await call("money_set_approve_first_time", { p_buyer: slot.buyer.id, p_on: true });
    const farmer = await makeUser("farmer");
    const booked = await book(slot.slotId, farmer.id, 10);

    await call("money_answer_approval", { p_booking: booked.booking_id, p_buyer: slot.buyer.id, p_decision: "decline", p_now: iso(hours(1)) });
    expect(await status(booked.booking_id)).toBe("declined");
    expect(await available(slot.buyer.id)).toBe(FUNDS);
    expect(await capacityLeft(slot.slotId)).toBe(30);
    expect(await notices(farmer.id, "booking_declined")).toHaveLength(1);
  });

  it("skips approval once a farmer has completed a delivery with that buyer", async () => {
    const farmer = await makeUser("farmer");
    const first = await confirmedFor(farmer);
    await deliver(first);
    await call("money_set_approve_first_time", { p_buyer: first.buyer.id, p_on: true });

    const slot = await makeSlot({ buyer: first.buyer });
    const again = await book(slot.slotId, farmer.id, 5);
    expect(await status(again.booking_id)).toBe("booked");

    const stranger = await makeUser("farmer");
    expect(await status((await book(slot.slotId, stranger.id, 5)).booking_id)).toBe("pending_approval");
  });
});

describe("confirmation before the day", () => {
  it("counts a booking made within 12 hours of the cut-off as confirmed", async () => {
    const slot = await makeSlot();
    await fund(slot.buyer.id, FUNDS);
    const farmer = await makeUser("farmer");
    const booked = await book(slot.slotId, farmer.id, 5, hours(-RULES.CONFIRM_REQUEST_HOURS_BEFORE_CUTOFF, CUTOFF));
    expect(await status(booked.booking_id)).toBe("confirmed");
  });

  it("asks at 12 hours and reminds at 2, once each", async () => {
    const slot = await makeSlot();
    await fund(slot.buyer.id, FUNDS);
    const farmer = await makeUser("farmer");
    await book(slot.slotId, farmer.id, 5);

    await sweep(hours(-12, CUTOFF));
    await sweep(hours(-11, CUTOFF));
    expect(await notices(farmer.id, "confirm_request")).toHaveLength(1);
    expect(await notices(farmer.id, "confirm_reminder")).toHaveLength(0);

    await sweep(hours(-2, CUTOFF));
    await sweep(hours(-1, CUTOFF));
    expect(await notices(farmer.id, "confirm_reminder")).toHaveLength(1);
  });

  it("releases funds and reopens the quantity when not confirmed by the cut-off", async () => {
    const slot = await makeSlot({ capacity: 30 });
    await fund(slot.buyer.id, FUNDS);
    const farmer = await makeUser("farmer");
    const booked = await book(slot.slotId, farmer.id, 20);

    await sweep(hours(-1, CUTOFF));
    expect(await status(booked.booking_id)).toBe("booked");

    await sweep(CUTOFF);
    expect(await status(booked.booking_id)).toBe("released");
    expect(await available(slot.buyer.id)).toBe(FUNDS);
    expect(await capacityLeft(slot.slotId)).toBe(30);
    expect(await notices(farmer.id, "booking_released")).toHaveLength(1);
    expect(await q(`select 1 from strikes where farmer_id = $1`, [farmer.id])).toHaveLength(0);
  });
});

describe("the mid-window prompt", () => {
  it("fires once, at the midpoint, when there's no code and no late notice", async () => {
    const b = await confirmedBooking();
    await sweep(hours(-1, MID_WINDOW));
    expect(await notices(b.buyer.id, "not_arrived")).toHaveLength(0);
    await sweep(MID_WINDOW);
    await sweep(hours(1, MID_WINDOW));
    expect(await notices(b.buyer.id, "not_arrived")).toHaveLength(1);
  });

  it("doesn't fire after a late notice, but the notice changes no deadline", async () => {
    const b = await confirmedBooking();
    await call("money_running_late", { p_booking: b.booking.booking_id, p_farmer: b.farmer.id, p_expected: iso(hours(75)), p_now: iso(WINDOW_START) });
    await sweep(MID_WINDOW);
    expect(await notices(b.buyer.id, "not_arrived")).toHaveLength(0);
    const [told] = await notices(b.buyer.id, "running_late");
    expect(told).toBeDefined();
    expect(await q(`select 1 from email_outbox o join notifications n on n.id = o.notification_id where n.kind = 'running_late'`)).toHaveLength(0);

    await sweep(hours(RULES.NO_SHOW_GRACE_HOURS, WINDOW_END));
    expect(await status(b.booking.booking_id)).toBe("no_show");
  });

  it("doesn't fire once the code is in", async () => {
    const b = await confirmedBooking();
    await arrive(b, WINDOW_START);
    await sweep(MID_WINDOW);
    expect(await notices(b.buyer.id, "not_arrived")).toHaveLength(0);
  });
});

describe("backup farmers", () => {
  async function withStock(commodityId: string, count = 1) {
    return Promise.all(Array.from({ length: count }, async () => {
      const farmer = await makeUser("farmer");
      await q(`insert into producer_stock (farmer_id, commodity_id, date, qty_declared) values ($1, $2, '2026-12-10', 50)`, [farmer.id, commodityId]);
      return farmer;
    }));
  }

  async function requestBackup(b: { booking: { booking_id: string }; buyer: { id: string } }, extra: Record<string, unknown> = {}) {
    return call("money_request_backup", { p_booking: b.booking.booking_id, p_buyer: b.buyer.id, p_now: iso(MID_WINDOW), ...extra }) as Promise<{
      ok: boolean; code?: string; slot_id: string; told: number; deadline_at: string; short_kobo?: number;
    }>;
  }

  it("emails at most 15 farmers with stock, not the original farmer, and pins it on their boards", async () => {
    const b = await confirmedBooking();
    const farmers = await withStock(b.commodityId, 16);
    const noStock = await makeUser("farmer");
    await q(`insert into producer_stock (farmer_id, commodity_id, date, qty_declared) values ($1, $2, '2026-12-10', 50)`, [b.farmer.id, b.commodityId]);

    const request = await requestBackup(b);
    expect(request).toMatchObject({ ok: true, told: RULES.BACKUP_NOTIFY_MAX });
    expect(new Date(request.deadline_at)).toEqual(hours(RULES.NO_SHOW_GRACE_HOURS, WINDOW_END));
    expect(await notices(noStock.id, "backup_request")).toHaveLength(0);
    expect(await notices(b.farmer.id, "backup_request")).toHaveLength(0);

    const [firstTold] = await q<{ user_id: string }>(`select user_id from notifications where kind = 'backup_request' limit 1`);
    const board = await call("logistics_board", { p_farmer: firstTold.user_id, p_now: iso(MID_WINDOW) });
    expect(board.pinned).toEqual([request.slot_id]);
    expect(farmers).toHaveLength(16);
  });

  it("refuses a higher price the buyer can't fund, and a deadline on another day", async () => {
    const b = await confirmedFor(await makeUser("farmer"), 0, { fundKobo: RESERVE_10 });
    expect(await requestBackup(b, { p_price_kobo: PRICE + 100_000 })).toMatchObject({ code: "needs_more_funds" });
    expect(await requestBackup(b, { p_price_kobo: PRICE - 1 })).toMatchObject({ code: "price_too_low" });
    expect(await requestBackup(b, { p_deadline: iso(hours(48, WINDOW_END)) })).toMatchObject({ code: "invalid_deadline" });
    expect((await requestBackup(b)).ok).toBe(true);
  });

  it("closes when the original farmer delivers, releases extra backups without penalty, and restores the hold", async () => {
    // Funded with exactly one reserve, so the backup has to use what's held for the first farmer.
    const b = await confirmedFor(await makeUser("farmer"), 0, { fundKobo: RESERVE_10 });
    const [backupFarmer] = await withStock(b.commodityId);
    const request = await requestBackup(b);

    const backup = await book(request.slot_id, backupFarmer.id, 10, MID_WINDOW);
    expect(backup.ok).toBe(true);
    expect(await status(backup.booking_id)).toBe("confirmed");
    expect(await hold(b.booking.booking_id)).toBe(0);
    expect(await hold(backup.booking_id)).toBe(RESERVE_10);

    await arrive(b, hours(0.5, MID_WINDOW));

    expect(await status(backup.booking_id)).toBe("released");
    expect(await hold(backup.booking_id)).toBe(0);
    expect(await hold(b.booking.booking_id)).toBe(RESERVE_10);
    expect(await notices(backupFarmer.id, "backup_released")).toHaveLength(1);
    expect(await q(`select 1 from strikes where farmer_id = $1`, [backupFarmer.id])).toHaveLength(0);
    expect(await q(`select 1 from money_pending_fees where farmer_id = $1`, [backupFarmer.id])).toHaveLength(0);
    const [row] = await q<{ status: string; closed_reason: string }>(`select status, closed_reason from backup_requests where booking_id = $1`, [b.booking.booking_id]);
    expect(row).toMatchObject({ status: "closed", closed_reason: "original_arrived" });
    expect(await book(request.slot_id, (await withStock(b.commodityId))[0].id, 1, hours(1, MID_WINDOW))).toMatchObject({ code: "slot_closed" });
    expect(await ledgerTotal()).toBe(0);
  });

  it("keeps a backup farmer who has already arrived", async () => {
    const b = await confirmedBooking();
    const [backupFarmer] = await withStock(b.commodityId);
    const request = await requestBackup(b);
    const backup = await book(request.slot_id, backupFarmer.id, 10, MID_WINDOW);
    await arrive({ booking: backup, farmer: backupFarmer }, hours(0.25, MID_WINDOW));
    await arrive(b, hours(0.5, MID_WINDOW));
    expect(await status(backup.booking_id)).toBe("confirmed");
  });

  it("doesn't offer the quantity twice when the original farmer never comes", async () => {
    const b = await confirmedBooking();
    const [backupFarmer] = await withStock(b.commodityId);
    const request = await requestBackup(b);
    const backup = await book(request.slot_id, backupFarmer.id, 10, MID_WINDOW);

    await sweep(hours(RULES.NO_SHOW_GRACE_HOURS, WINDOW_END));
    expect(await status(b.booking.booking_id)).toBe("no_show");
    expect(await capacityLeft(b.slotId)).toBe(70);
    expect(await status(backup.booking_id)).toBe("confirmed");
    const [row] = await q<{ status: string }>(`select status from backup_requests where booking_id = $1`, [b.booking.booking_id]);
    expect(row.status).toBe("closed");
  });

  it("stops the backup farmer booking their own missed delivery", async () => {
    const b = await confirmedBooking();
    const request = await requestBackup(b);
    expect(await book(request.slot_id, b.farmer.id, 1, MID_WINDOW)).toMatchObject({ code: "own_backup" });
  });
});

describe("no-shows", () => {
  it("at window end + 2h releases the full reserve and reopens the quantity, with no fee the first time", async () => {
    const b = await confirmedBooking();
    await sweep(hours(RULES.NO_SHOW_GRACE_HOURS, WINDOW_END));

    expect(await status(b.booking.booking_id)).toBe("no_show");
    expect(await available(b.buyer.id)).toBe(FUNDS);
    expect(await capacityLeft(b.slotId)).toBe(80);
    expect(await q(`select 1 from strikes where farmer_id = $1 and kind = 'no_show'`, [b.farmer.id])).toHaveLength(1);
    expect(await q(`select 1 from money_pending_fees where farmer_id = $1`, [b.farmer.id])).toHaveLength(0);
    expect((await notices(b.farmer.id, "no_show_farmer"))[0].data).toMatchObject({ fee_kobo: 0 });
    expect(await notices(b.buyer.id, "no_show_buyer")).toHaveLength(1);
  });

  it("takes a fee from the second, from the next payout, all of it to the affected buyer, and pauses booking", async () => {
    const farmer = await makeUser("farmer");
    const first = await confirmedFor(farmer);
    await sweep(hours(2, first.end));
    const second = await confirmedFor(farmer, 5);
    await sweep(hours(2, second.end));
    const fee = MIN_10 * 0.05;

    const [owed] = await q<{ amount_kobo: string; buyer_share_pct: number }>(`select amount_kobo, buyer_share_pct from money_pending_fees where farmer_id = $1`, [farmer.id]);
    expect(Number(owed.amount_kobo)).toBe(fee);
    expect(owed.buyer_share_pct).toBe(100);

    // Two in 30 days: paused for 14, and told so.
    expect(await notices(farmer.id, "farmer_paused")).toHaveLength(1);
    const blocked = await makeSlot();
    await fund(blocked.buyer.id, FUNDS);
    await q(`update slots set cutoff_at = $1 where id = $2`, [hours(24 * 40), blocked.slotId]);
    expect(await book(blocked.slotId, farmer.id, 1, hours(2, second.end))).toMatchObject({ code: "farmer_banned" });

    const lumoraBefore = await balance("lumora_revenue");
    const next = await confirmedFor(farmer, 30);
    await deliver(next, 30);
    const gross = 30 * PRICE;
    expect(await balance("farmer_pending", farmer.id)).toBe(gross - fee);
    expect(await available(second.buyer.id)).toBe(FUNDS + fee);
    expect(await balance("lumora_revenue")).toBe(lumoraBefore + gross * 0.01); // Only the buyer's 1%.
    expect(await ledgerTotal()).toBe(0);
  });

  it("doesn't pause for two no-shows more than 30 days apart", async () => {
    const farmer = await makeUser("farmer");
    const first = await confirmedFor(farmer);
    await sweep(hours(2, first.end));
    const second = await confirmedFor(farmer, 40);
    await sweep(hours(2, second.end));
    expect(await notices(farmer.id, "farmer_paused")).toHaveLength(0);
  });
});

describe("the code not given", () => {
  async function reported() {
    const b = await confirmedBooking();
    const report = await call("money_report_no_code", { p_booking: b.booking.booking_id, p_farmer: b.farmer.id, p_now: iso(hours(1, WINDOW_START)) });
    expect(report).toMatchObject({ ok: true, status: "contested" });
    return b;
  }

  async function atOps() {
    const b = await reported();
    await sweep(hours(1.5, WINDOW_START));
    const [row] = await q<{ id: string; status: string }>(`select id, status from code_reports where booking_id = $1`, [b.booking.booking_id]);
    expect(row.status).toBe("ops");
    return { b, reportId: row.id };
  }

  const resolve = (reportId: string, decision: string, actor: string) =>
    call("money_resolve_code_report", { p_report: reportId, p_decision: decision, p_actor: actor, p_now: iso(hours(3, WINDOW_START)) });

  it("only accepts a report in the window, up to an hour after it", async () => {
    const b = await confirmedBooking();
    const report = (now: Date) => call("money_report_no_code", { p_booking: b.booking.booking_id, p_farmer: b.farmer.id, p_now: iso(now) });
    expect(await report(hours(-1, WINDOW_START))).toMatchObject({ code: "report_window_closed" });
    expect(await report(hours(RULES.NOCODE_GRACE_HOURS, WINDOW_END))).toMatchObject({ code: "report_window_closed" });
    expect((await report(hours(0.5, WINDOW_END))).ok).toBe(true);
  });

  it("blocks the no-show while it's open, and tells the buyer straight away", async () => {
    const b = await reported();
    expect(await notices(b.buyer.id, "nocode_buyer")).toHaveLength(1);
    await sweep(hours(RULES.NO_SHOW_GRACE_HOURS, WINDOW_END));
    expect(await status(b.booking.booking_id)).toBe("contested");
    expect(await q(`select 1 from strikes where farmer_id = $1`, [b.farmer.id])).toHaveLength(0);
  });

  it("ends when the code goes in", async () => {
    const b = await reported();
    await arrive(b, hours(1.2, WINDOW_START));
    expect(await status(b.booking.booking_id)).toBe("confirmed");
    const [row] = await q<{ decision: string }>(`select decision from code_reports where booking_id = $1`, [b.booking.booking_id]);
    expect(row.decision).toBe("code_given");
  });

  it("treats a buyer's decline with a reason and photo as a quality rejection, with no penalty", async () => {
    const b = await reported();
    const decline = (photo: string) => call("money_nocode_decline", {
      p_booking: b.booking.booking_id, p_buyer: b.buyer.id, p_reason: "underweight", p_photo_url: photo, p_now: iso(hours(1.2, WINDOW_START)),
    });
    expect(await decline("")).toMatchObject({ code: "photo_required" });
    expect((await decline("https://x/p.jpg")).ok).toBe(true);
    expect(await status(b.booking.booking_id)).toBe("cancelled");
    expect(await available(b.buyer.id)).toBe(FUNDS);
    expect(await q(`select 1 from strikes`)).toHaveLength(0);
    expect(await notices(b.farmer.id, "nocode_declined")).toHaveLength(1);
  });

  it("goes to ops after 30 minutes without an answer", async () => {
    const b = await reported();
    await sweep(hours(1.25, WINDOW_START));
    expect((await q<{ status: string }>(`select status from code_reports where booking_id = $1`, [b.booking.booking_id]))[0].status).toBe("open");
    await sweep(hours(1.5, WINDOW_START));
    expect(await db.rpc<unknown[]>("money_admin_code_reports")).toHaveLength(1);
    expect(await notices(b.farmer.id, "nocode_with_ops")).toHaveLength(1);
  });

  it("buyer at fault: farmer gets the late-cancel fee, the rest goes back, buyer strike", async () => {
    const { b, reportId } = await atOps();
    const admin = await makeUser("admin");
    const fee = MIN_10 * 0.05;
    expect(await resolve(reportId, "buyer_fault", admin.id)).toMatchObject({ ok: true, fee_kobo: fee });
    expect(await balance("farmer_pending", b.farmer.id)).toBe(fee);
    expect(await available(b.buyer.id)).toBe(FUNDS - fee);
    expect(await q(`select 1 from strikes where buyer_id = $1 and kind = 'refused_code'`, [b.buyer.id])).toHaveLength(1);
    expect(await status(b.booking.booking_id)).toBe("cancelled");
    expect(await notices(b.farmer.id, "nocode_outcome")).toHaveLength(1);
    expect(await notices(b.buyer.id, "nocode_outcome")).toHaveLength(1);
    expect(await ledgerTotal()).toBe(0);
  });

  it("farmer at fault: treated as a no-show", async () => {
    const { b, reportId } = await atOps();
    const admin = await makeUser("admin");
    await resolve(reportId, "farmer_fault", admin.id);
    expect(await status(b.booking.booking_id)).toBe("no_show");
    expect(await available(b.buyer.id)).toBe(FUNDS);
    expect(await q(`select 1 from strikes where farmer_id = $1 and kind = 'no_show'`, [b.farmer.id])).toHaveLength(1);
  });

  it("no fault: the full reserve back, no strikes", async () => {
    const { b, reportId } = await atOps();
    const admin = await makeUser("admin");
    await resolve(reportId, "no_fault", admin.id);
    expect(await status(b.booking.booking_id)).toBe("cancelled");
    expect(await available(b.buyer.id)).toBe(FUNDS);
    expect(await q(`select 1 from strikes`)).toHaveLength(0);
  });

  it("defaults to no fault after 24 hours", async () => {
    const { b } = await atOps();
    await sweep(hours(1.5 + RULES.NOCODE_OPS_DECISION_HOURS - 1, WINDOW_START));
    expect(await status(b.booking.booking_id)).toBe("contested");
    await sweep(hours(1.5 + RULES.NOCODE_OPS_DECISION_HOURS, WINDOW_START));
    expect(await status(b.booking.booking_id)).toBe("cancelled");
    expect(await available(b.buyer.id)).toBe(FUNDS);
    expect(await q(`select 1 from strikes`)).toHaveLength(0);
    expect(await q(`select 1 from money_alerts where kind = 'code_report_deadline_missed'`)).toHaveLength(1);
  });

  it("pauses a buyer's listings after two buyer-fault strikes in 30 days", async () => {
    const admin = await makeUser("admin");
    const slot = await makeSlot();
    await fund(slot.buyer.id, FUNDS);
    for (const farmer of [await makeUser("farmer"), await makeUser("farmer")]) {
      const booked = await book(slot.slotId, farmer.id, 5);
      await call("money_confirm_booking", { p_booking: booked.booking_id, p_farmer: farmer.id, p_now: iso(hours(1)) });
      await call("money_report_no_code", { p_booking: booked.booking_id, p_farmer: farmer.id, p_now: iso(WINDOW_START) });
    }
    await sweep(hours(1, WINDOW_START));
    const reports = await q<{ id: string }>(`select id from code_reports`);
    for (const report of reports) await resolve(report.id, "buyer_fault", admin.id);
    const [listing] = await q<{ status: string; paused_reason: string }>(`select status, paused_reason from demand_listings where id = $1`, [slot.listingId]);
    expect(listing).toMatchObject({ status: "paused", paused_reason: "review" });
    expect(await notices(slot.buyer.id, "listings_paused_review")).toHaveLength(1);
  });
});

describe("settlement", () => {
  it("charges 1% + 1% after the free deliveries, skips the farmer's fee within them, and releases the rest", async () => {
    const farmer = await makeUser("farmer");
    const gross = 30 * PRICE;
    let lastSettled = 0;

    for (let delivery = 0; delivery < RULES.FREE_FARMER_DELIVERIES; delivery++) {
      const b = await confirmedFor(farmer, delivery * 7);
      await deliver(b);
      lastSettled = await balance("farmer_pending", farmer.id);
      expect(lastSettled).toBe(gross * (delivery + 1));
    }

    const b = await confirmedFor(farmer, 30);
    const result = await deliver(b);
    const fee = gross * 0.01;
    expect(result).toMatchObject({ farmer_fee_kobo: fee, buyer_fee_kobo: fee, released_kobo: RESERVE_10 - gross });
    expect(await balance("farmer_pending", farmer.id)).toBe(lastSettled + gross - fee);
    expect(await available(b.buyer.id)).toBe(FUNDS - gross - fee);
    const [payout] = await notices(farmer.id, "payout_breakdown").then((rows) => rows.slice(-1));
    expect(payout.data).toMatchObject({ gross_kobo: gross, farmer_fee_kobo: fee, net_kobo: gross - fee });
    expect(await notices(b.buyer.id, "receipt")).toHaveLength(1);
    expect(await ledgerTotal()).toBe(0);
  });

  it("deducts pending fees after the farmer's fee", async () => {
    const farmer = await makeUser("farmer");
    await q(`insert into money_pending_fees (farmer_id, amount_kobo, reason) values ($1, 100000, 'test')`, [farmer.id]);
    const b = await confirmedFor(farmer);
    await deliver(b);
    expect(await balance("farmer_pending", farmer.id)).toBe(30 * PRICE - 100_000);
  });

  it("charges a late-cancelling buyer 5% of the booked minimum, not of the reserve", async () => {
    const b = await confirmedBooking();
    const result = await call("money_cancel_buyer", { p_booking: b.booking.booking_id, p_buyer: b.buyer.id, p_now: iso(hours(50)) });
    expect(result).toMatchObject({ late_fee_kobo: MIN_10 * 0.05 });
    expect(await notices(b.farmer.id, "buyer_cancelled")).toHaveLength(1);
  });
});

describe("reliability", () => {
  it("counts deliveries and no-shows, and a late code isn't on time", async () => {
    const farmer = await makeUser("farmer");
    await deliver(await confirmedFor(farmer));
    const late = await confirmedFor(farmer, 7);
    await arrive(late, hours(1, late.end));
    const missed = await confirmedFor(farmer, 14);
    await sweep(hours(2, missed.end));
    expect(await db.rpc("money_farmer_reliability", { p_farmer: farmer.id })).toEqual({ on_time: 1, total: 3 });
  });
});

describe("email action links", () => {
  const SECRET = "test-secret";

  async function confirmRequest() {
    const slot = await makeSlot();
    await fund(slot.buyer.id, FUNDS);
    const farmer = await makeUser("farmer", "Amina");
    const booked = await book(slot.slotId, farmer.id, 10);
    await sweep(hours(36));
    const tokens = await q<{ id: string; action: string; expires_at: Date }>(`select * from action_tokens where user_id = $1 order by action`, [farmer.id]);
    return { slot, farmer, booked, tokens, confirm: tokens.find((token) => token.action === "confirm")!, cancel: tokens.find((token) => token.action === "cancel_farmer")! };
  }

  it("rejects a forged, altered or expired signature", () => {
    const expires = new Date("2026-12-09T08:00:00Z");
    const token = signActionToken("abc", expires, SECRET);
    expect(verifyActionToken(token, SECRET, new Date("2026-12-08T08:00:00Z"))).toEqual({ ok: true, id: "abc" });
    expect(verifyActionToken(token, SECRET, expires)).toEqual({ ok: false, code: "expired" });
    expect(verifyActionToken(token, "other", new Date("2026-12-08T08:00:00Z"))).toEqual({ ok: false, code: "invalid" });
    expect(verifyActionToken(token.replace("abc", "abd"), SECRET, new Date("2026-12-08T08:00:00Z"))).toEqual({ ok: false, code: "invalid" });
    expect(verifyActionToken(token, undefined)).toEqual({ ok: false, code: "invalid" });
  });

  it("expires at that step's deadline", async () => {
    const { confirm } = await confirmRequest();
    expect(confirm.expires_at).toEqual(CUTOFF);
  });

  it("opening a link changes nothing, and only the button does", async () => {
    const { farmer, booked, confirm } = await confirmRequest();
    const preview = await call("money_action_preview", { p_token: confirm.id, p_user: farmer.id, p_now: iso(hours(37)) });
    expect(preview).toMatchObject({ ok: true, action: "confirm" });
    expect(await status(booked.booking_id)).toBe("booked");
    const [row] = await q<{ used_at: Date | null }>(`select used_at from action_tokens where id = $1`, [confirm.id]);
    expect(row.used_at).toBeNull();

    expect(await call("money_action_perform", { p_token: confirm.id, p_user: farmer.id, p_now: iso(hours(37)) })).toMatchObject({ ok: true });
    expect(await status(booked.booking_id)).toBe("confirmed");
  });

  it("rejects a reused link, an expired one, and someone else's", async () => {
    const { farmer, confirm, cancel, booked } = await confirmRequest();
    const stranger = await makeUser("farmer");
    expect(await call("money_action_perform", { p_token: confirm.id, p_user: stranger.id, p_now: iso(hours(37)) })).toMatchObject({ code: "not_yours" });
    expect(await call("money_action_perform", { p_token: cancel.id, p_user: farmer.id, p_now: iso(CUTOFF) })).toMatchObject({ code: "expired" });
    expect(await status(booked.booking_id)).toBe("booked");

    await call("money_action_perform", { p_token: confirm.id, p_user: farmer.id, p_now: iso(hours(37)) });
    expect(await call("money_action_perform", { p_token: confirm.id, p_user: farmer.id, p_now: iso(hours(38)) })).toMatchObject({ code: "used" });
    expect(await call("money_action_preview", { p_token: confirm.id, p_user: farmer.id, p_now: iso(hours(38)) })).toMatchObject({ code: "used" });
  });

  it("runs the money action once when pressed twice at the same moment", async () => {
    const b = await confirmedBooking();
    await arrive(b, WINDOW_START);
    await record(b, 30, hours(1, WINDOW_START));
    const [token] = await q<{ id: string }>(`select id from action_tokens where action = 'confirm_weight'`);
    const at = iso(hours(2, WINDOW_START));
    const results = await Promise.all([1, 2].map(() => call("money_action_perform", { p_token: token.id, p_user: b.farmer.id, p_now: at })));
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(await balance("farmer_pending", b.farmer.id)).toBe(30 * PRICE);
    expect(await ledgerTotal()).toBe(0);
  });

  it("puts the signed link in the button, and writes the spec's words", async () => {
    const { slot, farmer, booked } = await confirmRequest();
    const mailer = new FakeMailer();
    expect(await sendEmails({ db, mailer, secret: SECRET, now: hours(36) })).toMatchObject({ configured: true, failed: 0 });

    const confirm = mailer.sent.find((email) => email.subject.startsWith("Please confirm"));
    const [goods] = await q<{ name: string }>(`select name from commodities where id = $1`, [slot.commodityId]);
    expect(confirm?.subject).toBe(`Please confirm: 10 ${goods.name} for ${slot.buyer.name} Thursday`);
    const links = [...(confirm?.html.matchAll(/\/action\/([^"]+)"/g) ?? [])].map((match) => match[1]);
    expect(links).toHaveLength(2);
    expect(verifyActionToken(links[0], SECRET, hours(37)).ok).toBe(true);
    expect(mailer.sent.map((email) => email.to)).toContain((await q<{ email: string }>(`select email from users where id = $1`, [farmer.id]))[0].email);
    expect(booked.ok).toBe(true);
  });
});

describe("the email outbox", () => {
  it("never blocks a money step, and retries a failed send", async () => {
    const slot = await makeSlot();
    await fund(slot.buyer.id, FUNDS);
    const farmer = await makeUser("farmer");
    const booked = await book(slot.slotId, farmer.id, 10);
    expect(await status(booked.booking_id)).toBe("booked");

    const mailer = new FakeMailer();
    mailer.failing = true;
    expect(await sendEmails({ db, mailer, secret: "s", now: T0 })).toMatchObject({ sent: 0, failed: 2 });
    const [row] = await q<{ status: string; next_attempt_at: Date }>(`select status, next_attempt_at from email_outbox limit 1`);
    expect(row.status).toBe("queued");
    expect(row.next_attempt_at).toEqual(hours(5 / 60));

    mailer.failing = false;
    expect(await sendEmails({ db, mailer, secret: "s", now: T0 })).toMatchObject({ sent: 0 });
    expect(await sendEmails({ db, mailer, secret: "s", now: hours(1) })).toMatchObject({ sent: 2 });
    expect(await sendEmails({ db, mailer, secret: "s", now: hours(2) })).toMatchObject({ sent: 0 });
  });

  it("gives up after the last try and raises an alert", async () => {
    const slot = await makeSlot();
    await fund(slot.buyer.id, FUNDS);
    await book(slot.slotId, (await makeUser("farmer")).id, 1);
    const mailer = new FakeMailer();
    mailer.failing = true;
    for (let run = 0; run < RULES.EMAIL_MAX_ATTEMPTS; run++) {
      await sendEmails({ db, mailer, secret: "s", now: hours(24 * (run + 1)) });
    }
    expect(await q(`select 1 from email_outbox where status = 'failed'`)).toHaveLength(2);
    expect(await q(`select 1 from money_alerts where kind = 'email_failed'`)).toHaveLength(2);
  });

  it("waits, without using up retries, until email is configured", async () => {
    const slot = await makeSlot();
    await fund(slot.buyer.id, FUNDS);
    await book(slot.slotId, (await makeUser("farmer")).id, 1);
    expect(await sendEmails({ db, mailer: null, secret: "s", now: T0 })).toMatchObject({ configured: false });
    const [row] = await q<{ attempts: number }>(`select attempts from email_outbox limit 1`);
    expect(row.attempts).toBe(0);
  });

  it("shows someone with no email in the bell only", async () => {
    const slot = await makeSlot();
    await fund(slot.buyer.id, FUNDS);
    const farmer = await makeUser("farmer");
    await q(`update users set email = null where id = $1`, [farmer.id]);
    await book(slot.slotId, farmer.id, 1);
    expect(await notices(farmer.id, "booking_confirmed")).toHaveLength(1);
    expect(await q(`select 1 from email_outbox o join notifications n on n.id = o.notification_id where n.user_id = $1`, [farmer.id])).toHaveLength(0);
  });

  it("counts unread for the bell and marks them read", async () => {
    const slot = await makeSlot();
    await fund(slot.buyer.id, FUNDS);
    const farmer = await makeUser("farmer");
    await book(slot.slotId, farmer.id, 1);
    expect(await call("money_notifications", { p_user: farmer.id })).toMatchObject({ unread: 1 });
    await call("money_notifications_read", { p_user: farmer.id });
    expect(await call("money_notifications", { p_user: farmer.id })).toMatchObject({ unread: 0 });
  });
});

describe("the spec's worked example", () => {
  it("measures distance the same way in SQL and TypeScript", async () => {
    const a = { lat: 9.799912, lng: 8.866667 };
    const b = { lat: 9.929486, lng: 8.909463 };
    const km = await db.rpc<number>("money_distance_km", { a_lat: a.lat, a_lng: a.lng, b_lat: b.lat, b_lng: b.lng });
    expect(km).toBe(roadKm(a, b));
  });
});
