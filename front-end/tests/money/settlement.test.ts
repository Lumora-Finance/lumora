import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { nairaToKobo, koboToNaira, namesMatch, RULES } from "../../lib/money/rules";
import {
  arrive, available, balance, book, call, confirmedBooking, fund, hold, hours, ledgerTotal, makeSlot, makeUser, pool, PRICE, q,
  record, resetDb, status, WINDOW_START,
} from "./helpers";

beforeEach(resetDb);
afterAll(() => pool.end());

const RESERVE = 12_250_000;
const reply = (b: Awaited<ReturnType<typeof confirmedBooking>>, answer: string, claimKg: number | null = null) =>
  call("money_farmer_reply", {
    p_booking: b.booking.booking_id, p_farmer: b.farmer.id, p_reply: answer, p_claim_kg: claimKg,
    p_now: hours(2, WINDOW_START).toISOString(),
  });

async function delivered(kg = 30) {
  const b = await confirmedBooking();
  await arrive(b, WINDOW_START);
  await record(b, kg, hours(1, WINDOW_START));
  return b;
}

describe("settlement", () => {
  it("releases exactly reserve - gross and charges the fee once", async () => {
    const b = await delivered(30);
    const gross = 30 * PRICE;
    const fee = gross * 0.015;

    await reply(b, "yes");

    expect(await status(b.booking.booking_id)).toBe("settled");
    expect(await balance("farmer_pending", b.farmer.id)).toBe(gross);
    expect(await hold(b.booking.booking_id)).toBe(0);
    expect(await balance("lumora_revenue")).toBe(fee);
    const released = await q<{ amount_kobo: string }>(`select amount_kobo from money_ledger where idem_key = $1`, [`release:${b.booking.booking_id}:settlement_remainder`]);
    expect(Number(released[0].amount_kobo)).toBe(RESERVE - gross);
    expect(await available(b.buyer.id)).toBe(50_000_000 - gross - fee);

    const repeat = await reply(b, "yes");
    expect(repeat).toMatchObject({ duplicate: true });
    expect(await balance("lumora_revenue")).toBe(fee);
    expect(await q(`select 1 from money_ledger where reason = 'buyer fee'`)).toHaveLength(1);
    expect(await ledgerTotal()).toBe(0);
  });

  it("matches the worked example: 92.4 kg x ₦3,500 = ₦323,400", async () => {
    const slot = await makeSlot();
    await q(`update demand_listings set max_unit_weight_kg = 5 where id = $1`, [slot.listingId]);
    await fund(slot.buyer.id, 50_000_000);
    const farmer = await makeUser("farmer");
    const booked = await book(slot.slotId, farmer.id, 20);
    const b = { booking: booked, farmer, buyer: slot.buyer };
    await call("money_confirm_booking", { p_booking: booked.booking_id, p_farmer: farmer.id, p_now: hours(1).toISOString() });
    await arrive(b, WINDOW_START);
    await record(b, 92.4, hours(1, WINDOW_START), 20);

    const sent = await q<{ body: string }>(`select body from sms_outbox where phone = $1`, [farmer.phone]);
    expect(sent.at(-1)?.body).toBe(`${booked.code}: 92.4 kg × ₦3,500 = ₦323,400. Reply YES or DISPUTE.`);

    await call("money_farmer_reply", { p_booking: booked.booking_id, p_farmer: farmer.id, p_reply: "yes", p_now: hours(2, WINDOW_START).toISOString() });
    expect(await balance("farmer_pending", farmer.id)).toBe(32_340_000);
    expect(await balance("lumora_revenue")).toBe(485_100);
    expect(await available(slot.buyer.id)).toBe(50_000_000 - 32_340_000 - 485_100);
  });

  it("charges the fee once when a YES and the deadline job arrive together", async () => {
    const b = await delivered(30);
    const at = hours(3, WINDOW_START).toISOString();
    await Promise.all([
      reply(b, "yes"),
      reply(b, "yes"),
      call("money_sweep", { p_now: at }),
      call("money_sweep", { p_now: at }),
      reply(b, "yes"),
    ]);
    expect(await status(b.booking.booking_id)).toBe("settled");
    expect(await balance("farmer_pending", b.farmer.id)).toBe(30 * PRICE);
    expect(await balance("lumora_revenue")).toBe(30 * PRICE * 0.015);
    expect(await q(`select 1 from money_payouts where farmer_id = $1`, [b.farmer.id])).toHaveLength(1);
    expect(await ledgerTotal()).toBe(0);
  });

  it("refuses decline reasons that aren't a list", async () => {
    const b = await confirmedBooking();
    await arrive(b, WINDOW_START);
    expect(await call("money_record_delivery", {
      p_booking: b.booking.booking_id, p_buyer: b.buyer.id, p_units_received: 8, p_units_declined: 2,
      p_decline_reasons: { reason: "sick" }, p_measured_kg: 20, p_scale_photos: ["u"], p_now: hours(1, WINDOW_START).toISOString(),
    })).toMatchObject({ code: "decline_reason_required" });
  });

  it("caps gross at the reserve when more is delivered than the maximum", async () => {
    const b = await delivered(100);
    await reply(b, "yes");
    expect(await balance("farmer_pending", b.farmer.id)).toBe(RESERVE);
    expect(await q(`select 1 from money_events where action = 'gross_capped_at_reserve'`)).toHaveLength(1);
  });

  it("requires a scale photo, and reasons for declined units", async () => {
    const b = await confirmedBooking();
    await arrive(b, WINDOW_START);
    const base = {
      p_booking: b.booking.booking_id, p_buyer: b.buyer.id, p_units_received: 8, p_measured_kg: 20,
      p_now: hours(1, WINDOW_START).toISOString(),
    };
    expect(await call("money_record_delivery", { ...base, p_units_declined: 0, p_decline_reasons: [] as unknown as object, p_scale_photos: [] }))
      .toMatchObject({ code: "scale_photo_required" });
    expect(await call("money_record_delivery", { ...base, p_units_declined: 2, p_decline_reasons: [] as unknown as object, p_scale_photos: ["u"] }))
      .toMatchObject({ code: "decline_reason_required" });
    expect(await call("money_record_delivery", { ...base, p_units_declined: 2, p_decline_reasons: [{ reason: "underweight" }, { reason: "outside_spec" }] as unknown as object, p_scale_photos: ["u"] }))
      .toMatchObject({ ok: true, gross_kobo: 20 * PRICE });
  });

  it("records what the buyer can't afford in fees and collects it from the next deposit", async () => {
    // Funded with exactly the reserve, and gross equals the reserve, so nothing is left for the fee.
    const b = await confirmedBooking({ fundKobo: RESERVE });
    await arrive(b, WINDOW_START);
    await record(b, 35, hours(1, WINDOW_START));
    await reply(b, "yes");

    const fee = RESERVE * 0.015;
    expect(await available(b.buyer.id)).toBe(0);
    expect(await balance("lumora_revenue")).toBe(0);
    const [owed] = await q<{ amount_kobo: string }>(`select amount_kobo from money_receivables where buyer_id = $1`, [b.buyer.id]);
    expect(Number(owed.amount_kobo)).toBe(fee);

    await fund(b.buyer.id, 1_000_000);
    expect(await balance("lumora_revenue")).toBe(fee);
    expect(await available(b.buyer.id)).toBe(1_000_000 - fee);
    expect(await ledgerTotal()).toBe(0);
  });
});

describe("disputes", () => {
  it("pays the undisputed amount at once and holds only the difference", async () => {
    const b = await delivered(30);
    const gross = 30 * PRICE;
    const result = await reply(b, "dispute", 33);
    const difference = 3 * PRICE;

    expect(result).toMatchObject({ status: "disputed", undisputed_kobo: gross, disputed_kobo: difference });
    expect(await balance("farmer_pending", b.farmer.id)).toBe(gross);
    expect(await hold(b.booking.booking_id)).toBe(difference);
    expect(await available(b.buyer.id)).toBe(50_000_000 - gross - difference);
  });

  it("resolves automatically for the farmer within the weight tolerance", async () => {
    const b = await delivered(30);
    const gross = 30 * PRICE;
    const result = await reply(b, "dispute", 30.2); // 0.67% over
    expect(result).toMatchObject({ auto_resolved: true, status: "settled" });
    const paid = gross + Math.round(0.2 * PRICE);
    expect(await balance("farmer_pending", b.farmer.id)).toBe(paid);
    expect(await q(`select 1 from disputes`)).toHaveLength(0);
    expect(await hold(b.booking.booking_id)).toBe(0);
  });

  it("opens a dispute just past the tolerance", async () => {
    const b = await delivered(30);
    expect(await reply(b, "dispute", 30.4)).toMatchObject({ status: "disputed" });
  });

  it("without a claimed weight, holds everything left of the reserve", async () => {
    const b = await delivered(30);
    expect(await reply(b, "dispute")).toMatchObject({ disputed_kobo: RESERVE - 30 * PRICE });
  });

  const open = async () => {
    const b = await delivered(30);
    await reply(b, "dispute", 33);
    const [d] = await q<{ id: string }>(`select id from disputes where booking_id = $1`, [b.booking.booking_id]);
    return { b, disputeId: d.id, admin: await makeUser("admin") };
  };
  const decide = (id: string, decision: string, custom: number | null, actor: string) =>
    call("money_resolve_dispute", { p_dispute: id, p_decision: decision, p_custom_kobo: custom, p_actor: actor, p_now: hours(5, WINDOW_START).toISOString() });

  it("pay recorded pays nothing more", async () => {
    const { b, disputeId, admin } = await open();
    await decide(disputeId, "pay_recorded", null, admin.id);
    expect(await balance("farmer_pending", b.farmer.id)).toBe(30 * PRICE);
    expect(await status(b.booking.booking_id)).toBe("settled");
    expect(await hold(b.booking.booking_id)).toBe(0);
    expect(await ledgerTotal()).toBe(0);
  });

  it("pay booked minimum never pays less than the undisputed amount", async () => {
    const { b, disputeId, admin } = await open();
    // Minimum is 10 x 2.5 = 25 kg, below the recorded 30.
    expect(await decide(disputeId, "pay_booked_minimum", null, admin.id)).toMatchObject({ final_kobo: 30 * PRICE });
    expect(await balance("farmer_pending", b.farmer.id)).toBe(30 * PRICE);
  });

  it("limits a custom amount, charges the fee on the total, and writes the decision to the log", async () => {
    const { b, disputeId, admin } = await open();
    expect(await decide(disputeId, "custom", 30 * PRICE - 1, admin.id)).toMatchObject({ code: "custom_out_of_range" });
    expect(await decide(disputeId, "custom", RESERVE + 1, admin.id)).toMatchObject({ code: "custom_out_of_range" });
    expect(await decide(disputeId, "custom", 34 * PRICE, admin.id)).toMatchObject({ code: "above_amount_held" });

    const total = 32 * PRICE;
    expect(await decide(disputeId, "custom", total, admin.id)).toMatchObject({ ok: true, final_kobo: total, status: "settled" });
    expect(await balance("farmer_pending", b.farmer.id)).toBe(total);
    expect(await balance("lumora_revenue")).toBe(total * 0.015);

    const [event] = await q<{ actor: string; after: { decision: string } }>(`select actor, after from money_events where entity = 'dispute'`);
    expect(event.actor).toBe(admin.id);
    expect(event.after.decision).toBe("custom");

    expect(await decide(disputeId, "pay_recorded", null, admin.id)).toMatchObject({ duplicate: true });
    expect(await ledgerTotal()).toBe(0);
  });

  it("has no route for a buyer quality complaint after recording", async () => {
    const b = await delivered(30);
    expect(await call("money_farmer_reply", { p_booking: b.booking.booking_id, p_farmer: b.buyer.id, p_reply: "dispute" }))
      .toMatchObject({ code: "not_your_booking" });
  });
});

describe("delivery code", () => {
  it("locks after 5 wrong tries, alerts ops, and refuses even the right code", async () => {
    const b = await confirmedBooking();
    const wrong = b.booking.delivery_code === "0000" ? "1111" : "0000";
    const attempt = (digits: string) =>
      call("money_submit_code", { p_booking: b.booking.booking_id, p_farmer: b.farmer.id, p_digits: digits, p_now: WINDOW_START.toISOString() });

    for (let left = RULES.CODE_MAX_ATTEMPTS - 1; left > 0; left--) {
      expect(await attempt(wrong)).toMatchObject({ code: "wrong_code", attempts_left: left });
    }
    expect(await attempt(wrong)).toMatchObject({ code: "code_locked" });
    expect(await attempt(b.booking.delivery_code)).toMatchObject({ code: "code_locked" });
    expect(await q(`select 1 from money_alerts where kind = 'code_locked'`)).toHaveLength(1);
    const [row] = await q<{ arrived_at: unknown }>(`select arrived_at from bookings where id = $1`, [b.booking.booking_id]);
    expect(row.arrived_at).toBeNull();
  });

  it("accepts the right code, for the right farmer only", async () => {
    const b = await confirmedBooking();
    const stranger = await makeUser("farmer");
    expect(await call("money_submit_code", { p_booking: b.booking.booking_id, p_farmer: stranger.id, p_digits: b.booking.delivery_code }))
      .toMatchObject({ code: "not_your_booking" });
    expect(await arrive(b, WINDOW_START)).toMatchObject({ ok: true });
  });
});

describe("the ledger", () => {
  it("can't be changed, and balances can't be written to directly", async () => {
    const b = await confirmedBooking();
    await expect(q(`update money_ledger set amount_kobo = 1`)).rejects.toThrow(/append-only/);
    await expect(q(`delete from money_ledger`)).rejects.toThrow(/append-only/);
    await expect(q(`update money_events set actor = 'x'`)).rejects.toThrow(/append-only/);
    await expect(q(`update money_balances set balance_kobo = 999999999`)).rejects.toThrow(/only changes through/);
    await expect(q(`update money_holds set amount_kobo = 1 where booking_id = $1`, [b.booking.booking_id])).rejects.toThrow(/only changes through/);
  });

  it("refuses to overdraw", async () => {
    const b = await confirmedBooking({ fundKobo: RESERVE });
    await expect(
      call("money_post", {
        p_key: "test", p_from: "buyer_available", p_from_owner: b.buyer.id, p_to: "lumora_revenue", p_to_owner: null,
        p_amount: 1, p_booking: null, p_reason: "test",
      }),
    ).rejects.toThrow(/money_balances_check|check constraint/);
  });

  it("only accepts whole kobo", async () => {
    await expect(
      call("money_post", {
        p_key: "float", p_from: "external", p_from_owner: null, p_to: "lumora_revenue", p_to_owner: null,
        p_amount: 1.5, p_booking: null, p_reason: "test",
      }),
    ).rejects.toThrow();
  });
});

describe("money helpers", () => {
  it("keeps the TypeScript and SQL rules identical", async () => {
    for (const [name, value] of Object.entries(RULES)) {
      const [row] = await q<{ value: string }>(`select money_rule($1) as value`, [name]);
      expect(Number(row.value), name).toBe(value);
    }
  });

  it.each([["323400", 32_340_000], ["323400.5", 32_340_050], ["0.07", 7], [323400.25, 32_340_025]])(
    "reads %s naira as kobo", (naira, kobo) => {
      expect(nairaToKobo(naira)).toBe(kobo);
    },
  );

  it("refuses amounts that can't be exact", () => {
    expect(nairaToKobo("1.234")).toBeNull();
    expect(nairaToKobo("-5")).toBeNull();
    expect(nairaToKobo("abc")).toBeNull();
    expect(koboToNaira(32_340_050)).toBe("323400.50");
    expect(koboToNaira(32_340_000)).toBe("323400");
    expect(() => koboToNaira(1.5)).toThrow();
  });

  it.each([
    ["Amina Bello", "AMINA BELLO", true],
    ["Amina Bello", "BELLO AMINA", true],
    ["Amina Bello", "A. BELLO", true],
    ["Amina Bello", "AMINA FATIMA BELLO", true],
    ["Amina Bello", "AMINA MUSA", false],
    ["Amina Bello", "BELLO", false],
    ["Amina Bello", "CHUKWU EMEKA OBI", false],
    ["Amina Bello", "AMINA BELLO ENTERPRISES VENTURES", false],
  ])("matches %s against %s: %s", (registered, resolved, expected) => {
    expect(namesMatch(registered, resolved)).toBe(expected);
  });
});
