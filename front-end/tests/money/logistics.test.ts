import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { nearest, roadKm } from "../../lib/geo";
import { AREAS, nearestArea } from "../../lib/logistics/areas";
import { buildBoard, type RawBoard } from "../../lib/logistics/board";
import { priceUnitLabel, shortWhenLabel, smsBoardLine, whenLabel } from "../../lib/logistics/board-copy";
import { captureLocation } from "../../lib/logistics/capture-location";
import { distanceWord, needsMore, slotShape, stepStock, takesLabel, unitsTaken, unitWords } from "../../lib/logistics/crate";
import { DECLINE_REASONS, declineProblem } from "../../lib/logistics/decline";
import { normalisePhone, readLocationChoice, validPhone } from "../../lib/logistics/location-input";
import { areaMenu } from "../../lib/logistics/sms-onboarding";
import { handleInboundSms } from "../../lib/money/sms-commands";
import { largestHoldKobo, type ListingDraft, listingBody, stepProblem } from "../../lib/logistics/listing-draft";
import { loadingMessage } from "../../lib/loading-messages";
import { taskCounts, trackTask, whenTasksSettle } from "../../lib/loading/progress";
import { FARMER_FEE_PCT, takeHomeKobo } from "../../lib/pricing";
import {
  arrive, balance, book, call, confirmedBooking, db, FakeSms, fund, hours, makeSlot, makeUser, pool, PRICE, q, resetDb, T0, WINDOW_START,
} from "./helpers";

beforeEach(resetDb);
afterAll(() => pool.end());

const area = (name: string) => AREAS.find((item) => item.name === name)!;
const at = (iso: string) => new Date(iso);
const text = (phone: string, body: string, now: Date = T0, sms = new FakeSms()) =>
  handleInboundSms({ phone, text: body, now }, { db, sms });

async function setLocation(userId: string, areaName: string, address: string | null = null) {
  return call("logistics_save_location", {
    p_user: userId, p_area: areaName, p_lat: area(areaName).lat + 0.001, p_lng: area(areaName).lng + 0.001,
    p_source: "device_gps", p_accuracy: 12, p_address: address,
  });
}

describe("distance", () => {
  it("is stable and rounded between seeded areas", () => {
    const km = roadKm(area("Rayfield"), area("Bukuru"));
    expect(Number.isInteger(km)).toBe(true);
    expect(km).toBe(9);
    expect(roadKm(area("Bukuru"), area("Rayfield"))).toBe(km);
    expect(roadKm(area("Bukuru"), area("Bukuru"))).toBe(0);
    expect(roadKm(area("Bukuru"), area("Barkin Ladi"))).toBe(39);
  });

  it("has the same areas in code as in the database", async () => {
    const rows = await q<{ name: string; lat: string; lng: string }>(`select name, lat, lng from areas order by position`);
    expect(rows.map((row) => ({ name: row.name, lat: Number(row.lat), lng: Number(row.lng) }))).toEqual([...AREAS]);
    expect(rows).toHaveLength(10);
  });
});

describe("matching a GPS point to an area", () => {
  it.each([
    [{ lat: 9.8, lng: 8.87 }, "Bukuru"],
    [{ lat: 9.84, lng: 8.91 }, "Rayfield"],
    [{ lat: 9.54, lng: 8.91 }, "Barkin Ladi"],
    [{ lat: 9.92, lng: 8.89 }, "Terminus"],
    [{ lat: 9.96, lng: 8.87 }, "Farin Gada"],
  ])("matches %j to %s", (point, name) => {
    expect(nearestArea(point).name).toBe(name);
  });

  it("works out the area itself, whatever the screen claims", () => {
    expect(readLocationChoice({ lat: 9.8, lng: 8.87, area: "Rayfield", accuracyM: 20 })).toMatchObject({ kind: "gps", area: "Bukuru" });
  });

  it("refuses points outside the pilot, and areas that don't exist", () => {
    expect(readLocationChoice({ lat: 6.5, lng: 3.4 })).toBeNull();
    expect(readLocationChoice({ area: "Lagos" })).toBeNull();
    expect(readLocationChoice({ area: "Bukuru" })).toEqual({ kind: "area", area: "Bukuru" });
    expect(() => nearest({ lat: 0, lng: 0 }, [])).toThrow();
  });
});

describe("asking the device for its location", () => {
  const device = (run: (ok: PositionCallback, fail: PositionErrorCallback, options?: PositionOptions) => void) =>
    ({ getCurrentPosition: run }) as Pick<Geolocation, "getCurrentPosition">;
  const fail = (code: number) => device((_, onError) => onError!({ code } as GeolocationPositionError));

  it("falls back without errors when permission is denied", async () => {
    await expect(captureLocation(fail(1))).resolves.toEqual({ status: "denied" });
  });

  it("falls back when it times out or fails", async () => {
    await expect(captureLocation(fail(3))).resolves.toEqual({ status: "timeout" });
    await expect(captureLocation(fail(2))).resolves.toEqual({ status: "unavailable" });
  });

  it("falls back on a phone with no geolocation, or one that throws", async () => {
    await expect(captureLocation(undefined)).resolves.toEqual({ status: "unavailable" });
    await expect(captureLocation(device(() => { throw new Error("blocked"); }))).resolves.toEqual({ status: "unavailable" });
  });

  it("asks for high accuracy with a 10 second limit", async () => {
    let seen: PositionOptions | undefined;
    const result = await captureLocation(device((ok, _, options) => {
      seen = options;
      ok({ coords: { latitude: 9.8, longitude: 8.87, accuracy: 15 } } as GeolocationPosition);
    }));
    expect(seen).toMatchObject({ enableHighAccuracy: true, timeout: 10_000 });
    expect(result).toEqual({ status: "ok", lat: 9.8, lng: 8.87, accuracyM: 15 });
  });
});

describe("saving a location", () => {
  it("keeps the exact point for GPS, and stores the source and accuracy", async () => {
    const user = await makeUser("farmer");
    await setLocation(user.id, "Bukuru");
    const [row] = await q<{ lat: string; location_source: string; location_accuracy_m: string }>(`select * from user_locations where user_id = $1`, [user.id]);
    expect(Number(row.lat)).toBeCloseTo(9.800912, 6);
    expect(row.location_source).toBe("device_gps");
    expect(Number(row.location_accuracy_m)).toBe(12);
    const [saved] = await q<{ area: string }>(`select area from users where id = $1`, [user.id]);
    expect(saved.area).toBe("Bukuru");
  });

  it("stores the area's centre when an area is picked, whatever was sent", async () => {
    const user = await makeUser("farmer");
    await call("logistics_save_location", { p_user: user.id, p_area: "Rayfield", p_lat: 1, p_lng: 1, p_source: "area_pick", p_accuracy: 5 });
    const [row] = await q<{ lat: string; lng: string; location_accuracy_m: string | null }>(`select * from user_locations where user_id = $1`, [user.id]);
    expect([Number(row.lat), Number(row.lng)]).toEqual([area("Rayfield").lat, area("Rayfield").lng]);
    expect(row.location_accuracy_m).toBeNull();
  });

  it("marks a farm captured by an agent as agent_gps, and only agents can do it", async () => {
    const agent = await makeUser("agent");
    const args = { p_name: "Amina", p_phone: "+2348011112222", p_area: "Bukuru", p_lat: 9.8, p_lng: 8.87, p_accuracy: 9 };
    const farmer = await makeUser("farmer");
    expect(await call("logistics_agent_add_farmer", { ...args, p_agent: farmer.id })).toMatchObject({ code: "not_an_agent" });

    const result = await call("logistics_agent_add_farmer", { ...args, p_agent: agent.id });
    expect(result.ok).toBe(true);
    const [row] = await q<{ location_source: string; captured_by: string }>(`select * from user_locations where user_id = $1`, [result.farmer_id]);
    expect(row).toMatchObject({ location_source: "agent_gps", captured_by: agent.id });
    expect(await call("logistics_agent_add_farmer", { ...args, p_agent: agent.id })).toMatchObject({ code: "phone_in_use" });
  });

  it("accepts real phone numbers and refuses others", () => {
    for (const phone of ["0803 000 0000", "+2348030000000", "08030000000"]) expect(validPhone(phone)).toBe(true);
    for (const phone of ["", "12345", "not a phone", undefined]) expect(validPhone(phone)).toBe(false);
  });

  it("treats 0803 and +234803 as the same phone", () => {
    expect(normalisePhone("0803 000 0000")).toBe("+2348030000000");
    expect(normalisePhone("2348030000000")).toBe("+2348030000000");
    expect(normalisePhone("+2348030000000")).toBe("+2348030000000");
  });

  it("creates the user row a Firebase sign-up was missing, once per phone", async () => {
    const save = (uid: string, phone: string) =>
      call("logistics_save_profile", { p_firebase_uid: uid, p_name: "Amina", p_phone: phone, p_role: "farmer" });
    expect((await save("fb-a", "+2348055555555")).ok).toBe(true);
    expect((await save("fb-a", "+2348055555555")).ok).toBe(true);
    expect(await save("fb-b", "+2348055555555")).toMatchObject({ code: "phone_in_use" });
    expect(await call("logistics_save_profile", { p_firebase_uid: "fb-c", p_name: "X", p_phone: "+2348066666666", p_role: "admin" })).toMatchObject({ code: "invalid_role" });
  });
});

describe("plain language", () => {
  it.each([
    [0, "very close"],
    [4, "very close"],
    [5, "close"],
    [15, "close"],
    [16, "far"],
  ])("calls %i km %s", (km, label) => {
    expect(distanceWord(km)).toBe(label);
  });

  const now = at("2026-12-07T08:00:00Z"); // A Monday, 9am in Jos.
  const window = (start: string, end: string) => [at(start), at(end), now] as const;

  it.each([
    [window("2026-12-10T06:00:00Z", "2026-12-10T10:00:00Z"), "Thursday morning, 7 to 11"],
    [window("2026-12-07T13:00:00Z", "2026-12-07T15:00:00Z"), "Today afternoon, 2 to 4"],
    [window("2026-12-08T06:30:00Z", "2026-12-08T10:00:00Z"), "Tomorrow morning, 7:30 to 11"],
    [window("2026-12-10T11:00:00Z", "2026-12-10T14:00:00Z"), "Thursday afternoon, 12 to 3"],
    [window("2026-12-10T15:00:00Z", "2026-12-10T17:00:00Z"), "Thursday evening, 4 to 6"],
  ])("describes a window as %#", ([start, end, current], expected) => {
    expect(whenLabel(start, end, current)).toBe(expected);
  });

  it("uses Jos time at the edge of a day", () => {
    // 23:30 UTC on the 7th is already 00:30 on the 8th in Jos.
    expect(shortWhenLabel(at("2026-12-08T08:00:00Z"), at("2026-12-07T23:30:00Z"))).toBe("Today morning");
  });

  it("words prices and quantities plainly", () => {
    expect(priceUnitLabel("kg")).toBe("for every kg");
    expect(priceUnitLabel("basket")).toBe("for every basket");
  });

  it("writes the SMS line as specified", () => {
    expect(smsBoardLine({
      n: 1, buyer: "Caterer D", area: "Angwan Rukuba", km: 9, priceKobo: 380_000, priceUnit: "kg", remaining: 40,
      windowStart: at("2026-12-10T06:00:00Z"), collects: false,
    }, now)).toBe("1) Caterer D, Angwan Rukuba, about 9 km. N3,800 for every kg. Needs 40 more, Thu morning.");
  });

  it("keeps jargon out of everything a farmer reads by SMS", async () => {
    const slot = await makeSlot({ capacity: 15 });
    await fund(slot.buyer.id, 50_000_000);
    const farmer = await makeUser("farmer");
    await setLocation(farmer.id, "Bukuru");
    const [{ name }] = await q<{ name: string }>(`select name from commodities where id = $1`, [slot.commodityId]);
    const replies = [
      await text(farmer.phone, `BUYERS ${name}`),
      await text(farmer.phone, "SELL 1 99"),
      await text(farmer.phone, "SELL 9 1"),
      await text(farmer.phone, "SELL 1 1 SUN"),
      await text(farmer.phone, "SELL 1 5"),
      await text(farmer.phone, "hello"),
    ];
    for (const reply of replies) expect(reply).not.toMatch(/\b(slot|capacity|listing|bid|demand)s?\b/i);
  });
});

describe("SMS BUYERS and SELL", () => {
  it("includes the km figure, and SELL takes the day shown", async () => {
    const slot = await makeSlot({ capacity: 40 });
    await q(`update users set name = 'Caterer D' where id = $1`, [slot.buyer.id]);
    await fund(slot.buyer.id, 50_000_000);
    const farmer = await makeUser("farmer");
    await setLocation(farmer.id, "Bukuru");
    const [{ name }] = await q<{ name: string }>(`select name from commodities where id = $1`, [slot.commodityId]);

    const reply = await text(farmer.phone, `BUYERS ${name}`);
    const km = roadKm(area("Bukuru"), area("Angwan Rukuba"));
    expect(reply).toBe(`1) Caterer D, Angwan Rukuba, about ${km} km. N3,500 for every kg. Needs 40 more, Thu morning. Reply SELL 1 20`);

    const sms = new FakeSms();
    expect(await text(farmer.phone, "SELL 1 20", T0, sms)).toContain("selling 20");
    expect(sms.sent[0].phone).toBe(slot.buyer.phone);
    const [row] = await q<{ qty: number; slot_id: string }>(`select qty, slot_id from bookings`);
    expect(row).toMatchObject({ qty: 20, slot_id: slot.slotId });
  });

  it("finds a seeded commodity by its plain name", async () => {
    const slot = await makeSlot();
    const [chicken] = await q<{ id: string }>(`select id from commodities where name = 'Live broilers'`);
    await q(`update demand_listings set commodity_id = $1 where id = $2`, [chicken.id, slot.listingId]);
    await fund(slot.buyer.id, 50_000_000);
    const farmer = await makeUser("farmer");
    expect(await text(farmer.phone, "BUYERS CHICKEN")).toContain("1) ");
    expect(await text(farmer.phone, "BUYERS BROILER")).toContain("1) ");
    expect(await text(farmer.phone, "BUYERS TURKEY")).toContain("Nobody");
  });
});

describe("SMS sign-up", () => {
  it("takes a name, then an area, and stores the area's centre", async () => {
    const phone = "+2348077777777";
    expect(await text(phone, "hello")).toBe("Welcome to Lumora. What is your name?");
    const menu = await text(phone, "Amina Bello");
    expect(menu).toContain("Where is your farm? Reply with a number: 1 Bukuru, 2 Barkin Ladi, 3 Rayfield, 4 Angwan Rukuba, 5 Tudun Wada, 6 More");

    expect(await text(phone, "9")).toContain("Where is your farm?");
    expect(await text(phone, "6")).toContain("1 Beach Road");
    expect(await text(phone, "6")).toContain("1 Bukuru");
    expect(await text(phone, "2")).toContain("near Barkin Ladi");

    const [row] = await q<{ name: string; role: string; lat: string; location_source: string }>(
      `select u.name, u.role, l.lat, l.location_source from users u join user_locations l on l.user_id = u.id where u.phone = $1`, [phone],
    );
    expect(row).toMatchObject({ name: "Amina Bello", role: "farmer", location_source: "sms_area" });
    expect(Number(row.lat)).toBe(area("Barkin Ladi").lat);
    expect(await q(`select 1 from sms_onboarding`)).toHaveLength(0);
    expect(await text(phone, "JOIN")).toContain("already on Lumora");
  });

  it("picks from the second page correctly", async () => {
    const phone = "+2348077777778";
    await text(phone, "JOIN");
    await text(phone, "Chidi");
    await text(phone, "6");
    expect(await text(phone, "1")).toContain("near Beach Road");
  });

  it("asks a known farmer with no area for just the area on JOIN", async () => {
    const farmer = await makeUser("farmer");
    expect(await text(farmer.phone, "JOIN")).toContain("Where is your farm?");
    expect(await text(farmer.phone, "3")).toContain("near Rayfield");
  });

  it("shows every area across the menu pages", () => {
    const shown = [areaMenu(0), areaMenu(1)].join(" ");
    for (const { name } of AREAS) expect(shown).toContain(name);
  });
});

describe("commodity delivery rules", () => {
  const listing = (buyer: string, windowEnd: string, commodity = "Live broilers", extra: Record<string, unknown> = {}) =>
    call("logistics_create_listing", {
      p_buyer: buyer, p_commodity: commodity, p_unit_price_kobo: PRICE, p_capacity: 40, p_min_qty: 5, p_min_weight: 2.5,
      p_max_weight: 3.5, p_mode: "farmer_delivers", p_date: "2026-12-20", p_window_start: "07:00", p_window_end: windowEnd,
      p_cutoff_hours: 24, p_address: "12 Rayfield Road", p_spec: "Healthy", p_now: T0.toISOString(), ...extra,
    });

  async function locatedBuyer() {
    const buyer = await makeUser("buyer");
    await setLocation(buyer.id, "Rayfield");
    return buyer;
  }

  it("rejects a live-broiler window ending at 12:00", async () => {
    const buyer = await locatedBuyer();
    expect(await listing(buyer.id, "12:00")).toMatchObject({ ok: false, code: "window_too_late", latest: "11:00" });
    expect(await q(`select 1 from demand_listings`)).toHaveLength(0);
  });

  it("allows one ending at exactly 11:00, and shows the crate limit in the spec", async () => {
    const buyer = await locatedBuyer();
    expect(await listing(buyer.id, "11:00")).toMatchObject({ ok: true, spec: "Healthy Up to 10 per crate." });
  });

  it("holds the rule for turkey, and doesn't apply it to tomatoes", async () => {
    const buyer = await locatedBuyer();
    expect(await listing(buyer.id, "12:00", "Turkey")).toMatchObject({ code: "window_too_late" });
    expect(await listing(buyer.id, "15:00", "Tomatoes", { p_min_weight: 1, p_max_weight: 1 })).toMatchObject({ ok: true, spec: "Healthy" });
  });

  it("holds the rule at the database, even for a direct write", async () => {
    const buyer = await locatedBuyer();
    const [chicken] = await q<{ id: string }>(`select id from commodities where name = 'Live broilers'`);
    await expect(q(
      `insert into demand_listings (buyer_id, commodity_id, unit_price_kobo, capacity_per_day, window_end) values ($1, $2, 1, 1, '12:00')`,
      [buyer.id, chicken.id],
    )).rejects.toThrow(/window_too_late/);
  });

  it("needs an address for delivery, but not for collection", async () => {
    const buyer = await locatedBuyer();
    expect(await listing(buyer.id, "11:00", "Live broilers", { p_address: " " })).toMatchObject({ code: "address_required" });
    const collected = await listing(buyer.id, "11:00", "Live broilers", { p_mode: "buyer_collects", p_address: null });
    expect(collected.ok).toBe(true);
    const [row] = await q<{ delivery_mode: string }>(`select delivery_mode from demand_listings where id = $1`, [collected.listing_id]);
    expect(row.delivery_mode).toBe("buyer_collects");
  });

  it("defaults to the farmer delivering", async () => {
    const slot = await makeSlot();
    const [row] = await q<{ delivery_mode: string }>(`select delivery_mode from demand_listings where id = $1`, [slot.listingId]);
    expect(row.delivery_mode).toBe("farmer_delivers");
  });

  it("needs the buyer to have a location, and refuses farmers", async () => {
    const noLocation = await makeUser("buyer");
    expect(await listing(noLocation.id, "11:00")).toMatchObject({ code: "location_required" });
    const farmer = await makeUser("farmer");
    expect(await listing(farmer.id, "11:00")).toMatchObject({ code: "not_a_buyer" });
  });
});

describe("the board", () => {
  async function twoListings() {
    const farmer = await makeUser("farmer");
    await setLocation(farmer.id, "Bukuru");
    const far = await makeSlot();
    await q(`update demand_listings set unit_price_kobo = 400000, area_id = (select id from areas where name = 'Farin Gada') where id = $1`, [far.listingId]);
    const near = await makeSlot();
    await q(`update demand_listings set area_id = (select id from areas where name = 'Bukuru'), delivery_mode = 'buyer_collects' where id = $1`, [near.listingId]);
    const raw = await db.rpc<RawBoard>("logistics_board", { p_farmer: farmer.id, p_now: T0.toISOString() });
    return { raw, far, near };
  }

  it("sorts by highest price by default, and can sort by nearest", async () => {
    const { raw } = await twoListings();
    const byPrice = buildBoard(raw, "price");
    expect(byPrice.map((card) => card.area)).toEqual(["Farin Gada", "Bukuru"]);
    const byDistance = buildBoard(raw, "nearest");
    expect(byDistance.map((card) => card.area)).toEqual(["Bukuru", "Farin Gada"]);
    expect(byDistance[0]).toMatchObject({ km: 0, collects: true });
    expect(byDistance[1].km).toBe(roadKm(area("Bukuru"), area("Farin Gada")));
  });

  it("carries no phone, address or exact location", async () => {
    const buyerWithAddress = await makeUser("buyer");
    await setLocation(buyerWithAddress.id, "Rayfield", "SECRET-ADDRESS");
    const slot = await makeSlot({ buyer: buyerWithAddress });
    await q(`insert into listing_private values ($1, 'SECRET-LISTING-ADDRESS')`, [slot.listingId]);
    const farmer = await makeUser("farmer");
    const raw = await db.rpc<RawBoard>("logistics_board", { p_farmer: farmer.id, p_now: T0.toISOString() });
    const shown = JSON.stringify(buildBoard(raw, "price"));
    expect(shown).not.toContain("SECRET");
    expect(shown).not.toContain(buyerWithAddress.phone);
    expect(JSON.stringify(raw)).not.toContain("SECRET");
    expect(JSON.stringify(raw)).not.toContain(buyerWithAddress.phone);
    expect(JSON.stringify(raw)).not.toContain(String(area("Rayfield").lat + 0.001));
  });

  it("still shows a full listing, with nothing remaining", async () => {
    const slot = await makeSlot({ capacity: 5 });
    await fund(slot.buyer.id, 50_000_000);
    const farmer = await makeUser("farmer");
    await book(slot.slotId, farmer.id, 5);
    const raw = await db.rpc<RawBoard>("logistics_board", { p_farmer: farmer.id, p_now: T0.toISOString() });
    expect(buildBoard(raw, "price")[0].remaining).toBe(0);
  });
});

describe("decline reasons", () => {
  async function arrived() {
    const b = await confirmedBooking();
    await arrive(b, WINDOW_START);
    return b;
  }
  const recordWith = (b: Awaited<ReturnType<typeof arrived>>, received: number, declined: object[], kg: number) =>
    call("logistics_record_delivery", {
      p_booking: b.booking.booking_id, p_buyer: b.buyer.id, p_units_received: received, p_units_declined: declined.length,
      p_decline_reasons: declined, p_measured_kg: kg, p_scale_photos: ["https://x/s.jpg"], p_now: hours(1, WINDOW_START).toISOString(),
    });

  it.each([
    ["an unknown reason", [{ reason: "smelled_odd" }], "invalid_reason"],
    ["other without a note", [{ reason: "other" }], "note_required"],
    ["other with a blank note", [{ reason: "other", note: "  " }], "note_required"],
    ["dead_on_arrival without a photo", [{ reason: "dead_on_arrival" }], "photo_required"],
    ["sick_or_injured without a photo", [{ reason: "sick_or_injured" }], "photo_required"],
  ])("refuses %s", async (_, declined, code) => {
    const b = await arrived();
    expect(await recordWith(b, 9, declined, 25)).toMatchObject({ ok: false, code });
  });

  it("needs a reason for every declined unit", async () => {
    const b = await arrived();
    const result = await call("logistics_record_delivery", {
      p_booking: b.booking.booking_id, p_buyer: b.buyer.id, p_units_received: 8, p_units_declined: 2,
      p_decline_reasons: [{ reason: "underweight" }], p_measured_kg: 20, p_scale_photos: ["u"], p_now: hours(1, WINDOW_START).toISOString(),
    });
    expect(result).toMatchObject({ code: "reason_per_unit_required" });
  });

  it("excludes declined units from settlement", async () => {
    const b = await arrived();
    const result = await recordWith(b, 7, [
      { reason: "underweight" },
      { reason: "dead_on_arrival", photo_url: "https://x/d.jpg" },
      { reason: "other", note: "Wrong breed" },
    ], 21);
    expect(result).toMatchObject({ ok: true, gross_kobo: 21 * PRICE });

    await call("money_farmer_reply", { p_booking: b.booking.booking_id, p_farmer: b.farmer.id, p_reply: "yes", p_now: hours(2, WINDOW_START).toISOString() });
    expect(await balance("farmer_pending", b.farmer.id)).toBe(21 * PRICE);
  });

  it("holds the rules at the database, even for the older route", async () => {
    const b = await arrived();
    await expect(call("money_record_delivery", {
      p_booking: b.booking.booking_id, p_buyer: b.buyer.id, p_units_received: 9, p_units_declined: 1,
      p_decline_reasons: [{ reason: "smelled_odd" }], p_measured_kg: 25, p_scale_photos: ["u"], p_now: hours(1, WINDOW_START).toISOString(),
    })).rejects.toThrow(/decline_invalid_reason/);
  });

  it("checks the form the same way as the database", async () => {
    expect(DECLINE_REASONS.map((item) => item.value)).toEqual(
      ["dead_on_arrival", "underweight", "overweight_or_bloated", "sick_or_injured", "outside_spec", "other"],
    );
    expect(declineProblem({ reason: "" })).toBeTruthy();
    expect(declineProblem({ reason: "other" })).toBeTruthy();
    expect(declineProblem({ reason: "sick_or_injured" })).toBeTruthy();
    expect(declineProblem({ reason: "underweight" })).toBeNull();
    for (const item of DECLINE_REASONS) {
      const unit = { reason: item.value, note: "n", photo_url: "p" };
      const [row] = await q<{ problem: string | null }>(`select logistics_decline_problem(1, $1::jsonb) as problem`, [JSON.stringify([unit])]);
      expect(row.problem).toBeNull();
      const bare = { reason: item.value };
      const [dbBare] = await q<{ problem: string | null }>(`select logistics_decline_problem(1, $1::jsonb) as problem`, [JSON.stringify([bare])]);
      expect(Boolean(dbBare.problem)).toBe(Boolean(declineProblem(bare)));
    }
  });
});

describe("address privacy", () => {
  async function asClient(firebaseUid: string, sql: string, params: unknown[] = []) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: firebaseUid })]);
      await client.query("set local role authenticated");
      return (await client.query(sql, params)).rows;
    } finally {
      await client.query("rollback");
      client.release();
    }
  }

  const contact = (booking: string, viewer: string) => call("logistics_booking_contact", { p_booking: booking, p_viewer: viewer });

  async function setup() {
    const b = await confirmedBooking();
    await setLocation(b.buyer.id, "Angwan Rukuba", "BUYER-ADDRESS");
    await setLocation(b.farmer.id, "Bukuru", "FARMER-ADDRESS");
    const stranger = await makeUser("buyer");
    await setLocation(stranger.id, "Rayfield", "STRANGER-ADDRESS");
    return { ...b, stranger };
  }

  it("gives each side the other's details on a booking between them", async () => {
    const { booking, buyer, farmer } = await setup();
    expect(await contact(booking.booking_id, buyer.id)).toMatchObject({ ok: true, phone: farmer.phone, address: "FARMER-ADDRESS" });
    expect(await contact(booking.booking_id, farmer.id)).toMatchObject({ ok: true, phone: buyer.phone, address: "BUYER-ADDRESS" });
  });

  it("gives a stranger nothing", async () => {
    const { booking, stranger } = await setup();
    const result = await contact(booking.booking_id, stranger.id);
    expect(result).toEqual({ ok: false, code: "not_your_booking" });
  });

  it("stops sharing once a booking is cancelled", async () => {
    const { booking, buyer } = await setup();
    await call("money_cancel_buyer", { p_booking: booking.booking_id, p_buyer: buyer.id, p_now: hours(1).toISOString() });
    expect(await contact(booking.booking_id, buyer.id)).toMatchObject({ code: "booking_not_active" });
  });

  it("sends a delivering farmer to the listing's address", async () => {
    const { booking, farmer, listingId } = await setup();
    await q(`insert into listing_private values ($1, 'LISTING-ADDRESS')`, [listingId]);
    expect(await contact(booking.booking_id, farmer.id)).toMatchObject({ address: "LISTING-ADDRESS" });
  });

  it("stops a farmer reading a buyer's exact location with no booking, and the reverse, under RLS", async () => {
    const { stranger, farmer, buyer } = await setup();
    const uid = async (id: string) => (await q<{ firebase_uid: string }>(`select firebase_uid from users where id = $1`, [id]))[0].firebase_uid;
    const farmerUid = await uid(farmer.id);
    const strangerUid = await uid(stranger.id);

    expect(await asClient(farmerUid, `select user_id from user_locations where user_id = $1`, [stranger.id])).toHaveLength(0);
    expect(await asClient(strangerUid, `select user_id from user_locations where user_id = $1`, [farmer.id])).toHaveLength(0);
    expect(await asClient(farmerUid, `select phone from users where id = $1`, [stranger.id])).toHaveLength(0);
    expect(await asClient(strangerUid, `select phone from users where id = $1`, [farmer.id])).toHaveLength(0);
    // Even the two people on a booking go through the server, never the table.
    expect(await asClient(farmerUid, `select user_id from user_locations where user_id = $1`, [buyer.id])).toHaveLength(0);
    // Your own row is fine.
    expect(await asClient(farmerUid, `select address from user_locations`)).toEqual([{ address: "FARMER-ADDRESS" }]);
  });

  it("keeps listing addresses from clients, though listings themselves are public", async () => {
    const { listingId, farmer } = await setup();
    await q(`insert into listing_private values ($1, 'LISTING-ADDRESS')`, [listingId]);
    const [{ firebase_uid: uid }] = await q<{ firebase_uid: string }>(`select firebase_uid from users where id = $1`, [farmer.id]);
    await expect(asClient(uid, `select * from listing_private`)).rejects.toThrow(/permission denied/);
    const rows = await asClient(uid, `select * from demand_listings where id = $1`, [listingId]);
    expect(JSON.stringify(rows)).not.toContain("LISTING-ADDRESS");
  });

  it("doesn't let clients call the contact function", async () => {
    const { booking, stranger } = await setup();
    const [{ firebase_uid: uid }] = await q<{ firebase_uid: string }>(`select firebase_uid from users where id = $1`, [stranger.id]);
    await expect(asClient(uid, `select logistics_booking_contact($1, $2)`, [booking.booking_id, stranger.id])).rejects.toThrow(/permission denied/);
  });

  it("gives the SMS list no phone or address", async () => {
    const { buyer, stranger } = await setup();
    const reply = await text(stranger.phone, "BUYERS");
    expect(reply).not.toContain("BUYER-ADDRESS");
    expect(reply).not.toContain(buyer.phone);
  });
});

describe("market board", () => {
  it("works out take-home from the average weight", () => {
    // 30 x 3 kg x ₦3,500, less 1%
    expect(takeHomeKobo({ units: 30, minWeightKg: 2.5, maxWeightKg: 3.5, priceKobo: 350_000 })).toBe(31_185_000);
    expect(takeHomeKobo({ units: 30, minWeightKg: 2.5, maxWeightKg: 3.5, priceKobo: 350_000, freeDeliveriesLeft: 1 })).toBe(31_500_000);
    expect(takeHomeKobo({ units: 0, minWeightKg: 2.5, maxWeightKg: 3.5, priceKobo: 350_000 })).toBe(0);
    expect(takeHomeKobo({ units: 14, minWeightKg: 1, maxWeightKg: 1, priceKobo: 2_800_000 })).toBe(38_808_000);
  });

  it("takes the farmer fee off only outside free deliveries", () => {
    const base = { units: 10, minWeightKg: 3, maxWeightKg: 3, priceKobo: 100_000 };
    expect(FARMER_FEE_PCT).toBe(1);
    expect(takeHomeKobo(base)).toBe(2_970_000);
    expect(takeHomeKobo({ ...base, farmerFeePct: 2 })).toBe(2_940_000);
    expect(takeHomeKobo({ ...base, farmerFeePct: 2, freeDeliveriesLeft: 3 })).toBe(3_000_000);
  });

  it("promises what settlement pays when the weight comes in at the average", async () => {
    const b = await confirmedBooking();
    await arrive(b, WINDOW_START);
    await call("money_record_delivery", {
      p_booking: b.booking.booking_id, p_buyer: b.buyer.id, p_units_received: 10, p_units_declined: 0,
      p_decline_reasons: [] as unknown as object, p_measured_kg: 30, p_scale_photos: ["u"], p_now: hours(1, WINDOW_START).toISOString(),
    });
    await call("money_farmer_reply", { p_booking: b.booking.booking_id, p_farmer: b.farmer.id, p_reply: "yes", p_now: hours(2, WINDOW_START).toISOString() });
    expect(await balance("farmer_pending", b.farmer.id)).toBe(
      takeHomeKobo({ units: 10, minWeightKg: 2.5, maxWeightKg: 3.5, priceKobo: PRICE, freeDeliveriesLeft: 3 }),
    );
  });

  it("words a crate for each commodity", () => {
    const baskets = unitWords("basket", "basket of tomatoes", "baskets of tomatoes");
    expect(needsMore(14, baskets)).toBe("Needs 14 more baskets");
    expect(needsMore(1, baskets)).toBe("Needs 1 more basket");
    expect(needsMore(40, unitWords("kg", "chicken", "chickens"))).toBe("Needs 40 more chickens");
    expect([slotShape("kg"), slotShape("crate"), slotShape("basket")]).toEqual(["round", "crate", "basket"]);
  });

  it("says how much a crate takes", () => {
    expect(unitsTaken(30, 12)).toBe(12);
    expect(unitsTaken(30, 40)).toBe(30);
    expect(takesLabel(12, 30)).toBe("Takes 12 of your 30");
    expect(takesLabel(30, 30)).toBe("Takes all 30");
    expect(stepStock(30, 1)).toBe(35);
    expect(stepStock(0, -1)).toBe(0);
  });

  it("gives the board weights, declared stock and follows", async () => {
    const slot = await makeSlot();
    const farmer = await makeUser("farmer");
    const [chicken] = await q<{ id: string }>(`select id from commodities where name = 'Live broilers'`);
    await q(`insert into producer_stock (farmer_id, commodity_id, date, qty_declared) values ($1, $2, '2026-12-05', 99), ($1, $2, '2026-12-08', 45), ($1, $2, '2026-12-09', 70)`, [farmer.id, chicken.id]);
    await call("logistics_follow_commodity", { p_farmer: farmer.id, p_commodity: "Live broilers" });
    await call("logistics_follow_commodity", { p_farmer: farmer.id, p_commodity: "Live broilers" });

    const raw = await db.rpc<RawBoard>("logistics_board", { p_farmer: farmer.id, p_now: T0.toISOString() });
    // The soonest day still to come, not an old one.
    expect(raw.stock).toEqual({ "Live broilers": 45 });
    expect(raw.follows).toEqual(["Live broilers"]);
    expect(buildBoard(raw, "price")[0]).toMatchObject({ slotId: slot.slotId, minWeightKg: 2.5, maxWeightKg: 3.5 });
    expect(await call("logistics_follow_commodity", { p_farmer: farmer.id, p_commodity: "Goats" })).toMatchObject({ code: "unknown_commodity" });
  });

  it("tells followers in the buyer's area when a new demand posts, and nobody else", async () => {
    const near = await makeUser("farmer");
    await setLocation(near.id, "Rayfield");
    const far = await makeUser("farmer");
    await setLocation(far.id, "Barkin Ladi");
    const notFollowing = await makeUser("farmer");
    await setLocation(notFollowing.id, "Rayfield");
    for (const farmer of [near, far]) await call("logistics_follow_commodity", { p_farmer: farmer.id, p_commodity: "Live broilers" });

    const buyer = await makeUser("buyer", "Caterer D");
    await setLocation(buyer.id, "Rayfield");
    const result = await call("logistics_create_listing", {
      p_buyer: buyer.id, p_commodity: "Live broilers", p_unit_price_kobo: PRICE, p_capacity: 40, p_min_qty: 5, p_min_weight: 2.5,
      p_max_weight: 3.5, p_mode: "farmer_delivers", p_date: "2026-12-20", p_window_start: "07:00", p_window_end: "11:00",
      p_cutoff_hours: 24, p_address: "12 Rayfield Road", p_spec: null, p_now: T0.toISOString(),
    });
    expect(result.ok).toBe(true);

    const sent = await q<{ user_id: string; data: object }>(`select user_id, data from notifications where kind = 'new_demand'`);
    expect(sent.map((row) => row.user_id)).toEqual([near.id]);
    expect(sent[0].data).toMatchObject({ buyer: "Caterer D", area: "Rayfield", goods: "broilers" });
    expect(JSON.stringify(sent[0].data)).not.toContain("12 Rayfield Road");
  });
});

describe("the post demand steps", () => {
  const NOW = new Date("2026-12-07T08:00:00Z");
  const draft: ListingDraft = {
    commodity: "Live broilers", mode: "farmer_delivers", address: "12 Rayfield Road", date: "2026-12-10", windowStart: "07:00", windowEnd: "11:00",
    price: "3500", capacity: "30", minQty: "1", minWeight: "2.5", maxWeight: "3.5", spec: "", images: [],
  };

  it("passes a complete draft on every step", () => {
    for (const step of [1, 2, 3, 4]) expect(stepProblem(step, draft, NOW)).toBeNull();
  });

  it("asks for an address only when the farmer delivers", () => {
    expect(stepProblem(1, { ...draft, address: "  " }, NOW)).toMatch(/address/);
    expect(stepProblem(1, { ...draft, address: "", mode: "buyer_collects" }, NOW)).toBeNull();
  });

  it("stops a window that's too late, backwards, or inside the cut-off", () => {
    expect(stepProblem(2, { ...draft, windowEnd: "12:00" }, NOW)).toMatch(/by 11:00/);
    expect(stepProblem(2, { ...draft, commodity: "Tomatoes", windowEnd: "12:00" }, NOW)).toBeNull();
    expect(stepProblem(2, { ...draft, windowEnd: "06:00" }, NOW)).toMatch(/after the start/);
    expect(stepProblem(2, { ...draft, date: "2026-12-08" }, NOW)).toMatch(/later day/);
    expect(stepProblem(2, { ...draft, date: "" }, NOW)).toMatch(/Choose a day/);
  });

  it("checks the numbers", () => {
    expect(stepProblem(3, { ...draft, price: "abc" }, NOW)).toMatch(/price/);
    expect(stepProblem(3, { ...draft, price: "0" }, NOW)).toMatch(/price/);
    expect(stepProblem(3, { ...draft, capacity: "2.5" }, NOW)).toMatch(/how many/);
    expect(stepProblem(3, { ...draft, minQty: "31" }, NOW)).toMatch(/smallest order/);
    expect(stepProblem(3, { ...draft, maxWeight: "2" }, NOW)).toMatch(/largest weight/);
  });

  it("doesn't ask for weights on baskets and crates, and sends 1 for them", () => {
    const tomatoes: ListingDraft = { ...draft, commodity: "Tomatoes", minWeight: "", maxWeight: "" };
    expect(stepProblem(3, tomatoes, NOW)).toBeNull();
    expect(listingBody(tomatoes)).toMatchObject({ minWeight: 1, maxWeight: 1 });
  });

  it("works out the largest hold the same way as book_slot", () => {
    expect(largestHoldKobo(draft)).toBe(30 * 3.5 * 350_000);
    expect(largestHoldKobo({ ...draft, commodity: "Eggs", price: "5600", capacity: "25" })).toBe(25 * 560_000);
    expect(largestHoldKobo({ ...draft, price: "" })).toBeNull();
  });

  it("sends no address when the buyer collects", () => {
    expect(listingBody({ ...draft, mode: "buyer_collects" })).toMatchObject({ address: null, unitPriceKobo: 350_000, capacity: 30 });
  });
});

describe("loader messages", () => {
  it("says something plain for every route, with the area when it's known", () => {
    expect(loadingMessage("/dashboard")).toBe("Getting your day ready");
    expect(loadingMessage("/dashboard/board", "Bukuru")).toBe("Finding buyers near Bukuru");
    expect(loadingMessage("/dashboard/board")).toBe("Finding buyers near you");
    expect(loadingMessage("/dashboard/bookings")).toBe("Loading your bookings");
    expect(loadingMessage("/dashboard/bookings/abc")).toBe("Opening your booking");
    expect(loadingMessage("/dashboard/wallet")).toBe("Checking your balance");
    expect(loadingMessage("/onboarding/finish")).toBe("Setting up your board");
    for (const path of ["/dashboard", "/dashboard/marketplace", "/dashboard/posts", "/nowhere"]) {
      expect(loadingMessage(path)).not.toMatch(/…|\.\.\.|undefined/);
    }
  });
});

describe("loader progress", () => {
  it("counts one piece of work once, and settles only when nothing is left", async () => {
    const before = taskCounts();
    const first = trackTask("loader-test");
    const second = trackTask("loader-test");
    expect(taskCounts().pending).toBe(before.pending + 1);
    first();
    first();
    expect(taskCounts().pending).toBe(before.pending + 1);
    let settled = false;
    const waiting = whenTasksSettle({ graceMs: 0, capMs: 2000 }).then(() => { settled = true; });
    await new Promise((done) => setTimeout(done, 100));
    expect(settled).toBe(false);
    second();
    await waiting;
    expect(settled).toBe(true);
    expect(taskCounts().pending).toBe(before.pending);
  });

  it("never traps anyone behind a stuck request", async () => {
    const stuck = trackTask("loader-stuck");
    const startedAt = Date.now();
    await whenTasksSettle({ graceMs: 0, capMs: 100 });
    expect(Date.now() - startedAt).toBeLessThan(1000);
    stuck();
  });
});
