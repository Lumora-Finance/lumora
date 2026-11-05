import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { RULES } from "../../lib/money/rules";
import { handleInboundSms, parseCommand } from "../../lib/money/sms-commands";
import {
  book, call, confirmedBooking, db, FakeSms, fund, hours, makeSlot, makeUser, pool, q, record, resetDb, status, sweep, T0, WINDOW_START,
} from "./helpers";

beforeEach(resetDb);
afterAll(() => pool.end());

const text = (phone: string, body: string, now: Date = T0, sms = new FakeSms()) =>
  handleInboundSms({ phone, text: body, now }, { db, sms });

describe("parseCommand", () => {
  it.each([
    ["yes", { name: "YES", code: null }],
    ["YES LM-12345", { name: "YES", code: "LM-12345" }],
    ["delivered lm-12345 0042", { name: "DELIVERED", code: "LM-12345", digits: "0042" }],
    ["DISPUTE LM-12345", { name: "DISPUTE", code: "LM-12345", claimKg: null }],
    ["DISPUTE LM-12345 95.5", { name: "DISPUTE", code: "LM-12345", claimKg: 95.5 }],
    ["DISPUTE", { name: "DISPUTE", code: null, claimKg: null }],
    ["CANCEL LM-12345", { name: "CANCEL", code: "LM-12345" }],
    ["BOOK 1 20 THU", { name: "BOOK", position: 1, qty: 20, day: "THU" }],
    ["BUYERS BROILER", { name: "BUYERS", commodity: "BROILER" }],
  ])("reads %s", (input, expected) => {
    expect(parseCommand(input)).toEqual(expected);
  });

  it.each(["", "hello", "DELIVERED LM-12345 12", "DELIVERED LM-12345", "BOOK 1 twenty THU", "CANCEL", "DISPUTE LM-1 abc", "YES please"])(
    "doesn't act on %j", (input) => {
      expect(parseCommand(input)).toEqual({ name: "UNKNOWN" });
    },
  );
});

describe("commands", () => {
  it("confirms with YES", async () => {
    const slot = await makeSlot();
    await fund(slot.buyer.id, 50_000_000);
    const farmer = await makeUser("farmer");
    const booked = await book(slot.slotId, farmer.id, 10);
    await sweep(hours(48));

    expect(await text(farmer.phone, "YES", hours(49))).toContain("Confirmed");
    expect(await status(booked.booking_id)).toBe("confirmed");
  });

  it("asks which booking when more than one is waiting", async () => {
    const slot = await makeSlot();
    await fund(slot.buyer.id, 50_000_000);
    const farmer = await makeUser("farmer");
    const first = await book(slot.slotId, farmer.id, 5);
    const second = await book(slot.slotId, farmer.id, 5);
    await sweep(hours(48));

    expect(await text(farmer.phone, "YES", hours(49))).toContain("more than one");
    expect(await status(first.booking_id)).toBe("booked");
    await text(farmer.phone, `YES ${second.code}`, hours(49));
    expect(await status(second.booking_id)).toBe("confirmed");
    expect(await status(first.booking_id)).toBe("booked");
  });

  it("settles with YES after recording", async () => {
    const b = await confirmedBooking();
    await call("money_submit_code", { p_booking: b.booking.booking_id, p_farmer: b.farmer.id, p_digits: b.booking.delivery_code, p_now: WINDOW_START.toISOString() });
    await record(b, 30, hours(1, WINDOW_START));
    expect(await text(b.farmer.phone, "yes", hours(2, WINDOW_START))).toContain("payout");
    expect(await status(b.booking.booking_id)).toBe("settled");
  });

  it("takes DELIVERED, and counts down wrong codes", async () => {
    const b = await confirmedBooking();
    const wrong = b.booking.delivery_code === "0000" ? "1111" : "0000";
    expect(await text(b.farmer.phone, `DELIVERED ${b.booking.code} ${wrong}`, WINDOW_START)).toBe(`Wrong code. ${RULES.CODE_MAX_ATTEMPTS - 1} tries left.`);
    expect(await text(b.farmer.phone, `DELIVERED ${b.booking.code} ${b.booking.delivery_code}`, WINDOW_START)).toContain("accepted");
    const [row] = await q<{ arrived_at: unknown }>(`select arrived_at from bookings where id = $1`, [b.booking.booking_id]);
    expect(row.arrived_at).not.toBeNull();
  });

  it("opens a dispute with a claimed weight", async () => {
    const b = await confirmedBooking();
    await call("money_submit_code", { p_booking: b.booking.booking_id, p_farmer: b.farmer.id, p_digits: b.booking.delivery_code, p_now: WINDOW_START.toISOString() });
    await record(b, 30, hours(1, WINDOW_START));
    expect(await text(b.farmer.phone, `DISPUTE ${b.booking.code} 34`, hours(2, WINDOW_START))).toContain("reviewing");
    expect(await status(b.booking.booking_id)).toBe("disputed");
    const queue = await db.rpc<{ messages: unknown[] }[]>("money_admin_disputes");
    expect(queue).toHaveLength(1);
    expect(queue[0].messages).toHaveLength(1);
  });

  it("cancels for whichever side sends it, and no one else", async () => {
    const b = await confirmedBooking();
    const stranger = await makeUser("farmer");
    expect(await text(stranger.phone, `CANCEL ${b.booking.code}`, hours(2))).toContain("couldn't find");
    expect(await status(b.booking.booking_id)).toBe("confirmed");
    expect(await text(b.buyer.phone, `CANCEL ${b.booking.code}`, hours(2))).toContain("cancelled");
    expect(await status(b.booking.booking_id)).toBe("cancelled");
  });

  it("books from a list, and answers Only N left when capacity has changed", async () => {
    const slot = await makeSlot({ capacity: 15 });
    await fund(slot.buyer.id, 50_000_000);
    const farmer = await makeUser("farmer");
    const rival = await makeUser("farmer");
    const [{ name: commodity }] = await q<{ name: string }>(`select name from commodities where id = $1`, [slot.commodityId]);
    const sms = new FakeSms();

    expect(await text(farmer.phone, `BUYERS ${commodity}`)).toContain("1) ");
    await book(slot.slotId, rival.id, 10);

    expect(await text(farmer.phone, "BOOK 1 12 THU", T0, sms)).toBe("Only 5 left. Reply BOOK 1 5 THU.");
    const reply = await text(farmer.phone, "BOOK 1 5 THU", T0, sms);
    expect(reply).toContain("Booked 5");
    expect(reply).not.toMatch(/\b\d{4}\b/);
    expect(sms.sent).toHaveLength(1);
    expect(sms.sent[0].phone).toBe(slot.buyer.phone);
  });

  it("explains itself to an unknown number, and for an unknown command", async () => {
    expect(await text("+2340000000000", "YES")).toContain("isn't on Lumora");
    const farmer = await makeUser("farmer");
    expect(await text(farmer.phone, "hello")).toContain("Commands:");
  });

  it("goes quiet when a number sends too much, per number", async () => {
    const farmer = await makeUser("farmer");
    const other = await makeUser("farmer");
    for (let i = 0; i < RULES.SMS_RATE_LIMIT; i++) {
      expect(await text(farmer.phone, "hello")).not.toBeNull();
    }
    expect(await text(farmer.phone, "hello")).toBeNull();
    expect(await text(other.phone, "hello")).not.toBeNull();
    expect(await text(farmer.phone, "hello", hours(1))).not.toBeNull();
  });
});
