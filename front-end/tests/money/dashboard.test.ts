import { describe, expect, it } from "vitest";

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
