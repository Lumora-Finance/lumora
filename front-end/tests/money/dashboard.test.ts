import { describe, expect, it } from "vitest";

import { buildBoard } from "../../lib/logistics/board";
import { ownListingImages } from "../../lib/logistics/listing-draft";
import { countsTowardsChart, type DashboardBooking, type MoneyRow, monthlyTotals, otherParty } from "../../lib/dashboard-data";

const today = new Date("2026-11-20T10:00:00Z");
const row = (kind: string, amount_kobo: number, created_at = "2026-11-05T10:00:00Z", direction: MoneyRow["direction"] = "credit"): MoneyRow =>
  ({ kind, amount_kobo, created_at, direction });

describe("the dashboard money chart", () => {
  const rows = [
    row("deposit", 5_000_000),
    row("trade", 2_000_000),
    row("payout", 2_000_000), // The same delivery reaching the bank.
    row("release", 700_000),
    row("hold", 900_000),
    row("trade", 3_000_000, "2026-11-05T10:00:00Z", "debit"), // A buyer paying for a delivery.
    row("withdrawal", 400_000, "2026-11-05T10:00:00Z", "debit"),
    row("deposit", 1_000_000, "2026-10-05T10:00:00Z"),
  ];

  it("shows a buyer only what they added to their wallet", () => {
    const months = monthlyTotals(today, rows, "buyer", 2);
    expect(months.map((month) => month.kobo)).toEqual([1_000_000, 5_000_000]);
  });

  it("shows a seller only what deliveries earned, counted once", () => {
    for (const role of ["farmer", "agent"]) {
      expect(monthlyTotals(today, rows, role, 1)[0].kobo).toBe(2_000_000);
    }
  });

  it("doesn't count a buyer's deposit as earnings, or a payout as funding", () => {
    expect(countsTowardsChart(row("deposit", 1), "farmer")).toBe(false);
    expect(countsTowardsChart(row("trade", 1), "buyer")).toBe(false);
  });

  it("ignores months outside the range, and survives bad amounts", () => {
    const months = monthlyTotals(today, [row("deposit", Number.NaN), row("deposit", 500, "2025-01-01T00:00:00Z")], "buyer", 6);
    expect(months.every((month) => month.kobo === 0)).toBe(true);
    expect(months.map((month) => month.name)).toEqual(["Jun", "Jul", "Aug", "Sept", "Oct", "Nov"]);
  });
});

describe("who's on the other side of a booking", () => {
  const booking = (extra: Partial<DashboardBooking>) => ({ is_buyer: true, ...extra }) as DashboardBooking;

  it("is always text, whichever shape the API sends", () => {
    expect(otherParty(booking({ farmer: { name: "Amina" } }))).toBe("Amina");
    expect(otherParty(booking({ farmer: "Amina" }))).toBe("Amina");
    expect(otherParty(booking({ is_buyer: false, buyer: { name: "Sweetfoods" } }))).toBe("Sweetfoods");
    expect(otherParty(booking({ is_buyer: false, contact: { ok: true, name: "Sweetfoods" } }))).toBe("Sweetfoods");
  });

  it("falls back to plain words", () => {
    expect(otherParty(booking({}))).toBe("A farmer");
    expect(otherParty(booking({ is_buyer: false }))).toBe("Your buyer");
  });
});

describe("photos on board cards", () => {
  const row = { listing_id: "l", slot_id: "s", buyer: "B", area: "Jos", area_lat: 9, area_lng: 8, price_kobo: 1, price_unit: "kg", remaining: 1, min_qty: 1, window_start: "", window_end: "", delivery_mode: "farmer_delivers", plain_name: "a", plain_plural: "b", spec: null } as never;

  it("carries a listing's photos and buyer", () => {
    const [card] = buildBoard({ farmer_area: null, rows: [{ ...(row as object), images: ["u"], buyer_id: "b1" } as never] }, "price");
    expect(card.images).toEqual(["u"]);
    expect(card.buyerId).toBe("b1");
  });

  it("is empty for a listing without any", () => {
    const [card] = buildBoard({ farmer_area: null, rows: [row] }, "price");
    expect(card.images).toEqual([]);
    expect(card.buyerId).toBeNull();
  });
});

describe("which photos can go on a listing", () => {
  const base = "https://x.supabase.co";
  const mine = `${base}/storage/v1/object/public/demand-listing-images/me/a.jpg`;

  it("keeps this person's uploads", () => {
    expect(ownListingImages([mine], `${base}/`, "me")).toEqual([mine]);
  });

  it("drops anything else", () => {
    const theirs = `${base}/storage/v1/object/public/demand-listing-images/you/a.jpg`;
    const elsewhere = "https://evil.test/a.jpg";
    const climbing = `${base}/storage/v1/object/public/demand-listing-images/me/../you/a.jpg`;
    expect(ownListingImages([theirs, elsewhere, climbing, 5], base, "me")).toEqual([]);
    expect(ownListingImages("nope", base, "me")).toEqual([]);
  });

  it("keeps at most four", () => {
    expect(ownListingImages(Array(6).fill(mine), base, "me")).toHaveLength(4);
  });
});

