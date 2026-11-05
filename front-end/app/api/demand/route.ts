import { connection } from "next/server";

import { serverMoneyDb } from "@/lib/money/db";

/**
 * GET /api/demand
 *
 * Returns real demand data aggregated from active listings on the board.
 * Public endpoint — no auth required (only shows aggregate, area-level data).
 *
 * Response shape per commodity:
 *   key, chip, command, weeklyDemand, demandUnit, priceUnit, prices[], buyers, verdict
 */
export async function GET() {
  // Public aggregate data, so it must not be prerendered for one user.
  await connection();

  const db = serverMoneyDb();

  // Query the board rows directly — no user context needed for aggregate demand.
  const rows = await db.rpc<{ commodity: string; plain_name: string; plain_plural: string; price_kobo: bigint; price_unit: string; remaining: number; buyer: string }[]>(
    "logistics_board_rows",
    { p_now: new Date().toISOString() },
  );

  // Group by commodity to build demand summaries.
  const byCommodity = new Map<string, {
    commodity: string;
    plainName: string;
    plainPlural: string;
    priceUnit: string;
    totalRemaining: number;
    buyerSet: Set<string>;
    prices: number[];
  }>();

  for (const row of rows) {
    const key = row.commodity ?? row.plain_name ?? "unknown";
    const entry = byCommodity.get(key) ?? {
      commodity: row.commodity ?? key,
      plainName: row.plain_name ?? key,
      plainPlural: row.plain_plural ?? `${key}s`,
      priceUnit: row.price_unit ?? "unit",
      totalRemaining: 0,
      buyerSet: new Set<string>(),
      prices: [] as number[],
    };
    entry.totalRemaining += row.remaining;
    entry.buyerSet.add(row.buyer);
    entry.prices.push(Number(row.price_kobo) / 100);
    byCommodity.set(key, entry);
  }

  // Build the response array matching the Produce type the explorer expects.
  const demand = Array.from(byCommodity.values()).map((entry) => {
    const avgPrice =
      entry.prices.length > 0
        ? Math.round(entry.prices.reduce((s, p) => s + p, 0) / entry.prices.length)
        : 0;
    const minPrice = entry.prices.length > 0 ? Math.min(...entry.prices) : 0;
    const maxPrice = entry.prices.length > 0 ? Math.max(...entry.prices) : 0;

    // Build an 8-point price series from the data we have.
    // With real price history (price_points table), this would use actual weekly data.
    // For now, we interpolate from current listings.
    const prices = entry.prices.length >= 8
      ? entry.prices.slice(0, 8)
      : Array.from({ length: 8 }, (_, i) => {
          if (entry.prices.length === 0) return 0;
          const t = i / 7;
          return Math.round(minPrice + t * (maxPrice - minPrice));
        });

    return {
      key: entry.commodity.toLowerCase().replace(/\s+/g, "-"),
      chip: entry.plainName,
      command: `DEMAND ${entry.plainName.toUpperCase().split(" ")[0]} JOS`,
      weeklyDemand: entry.totalRemaining,
      demandUnit: `${entry.plainPlural} a week`,
      priceUnit: entry.priceUnit,
      prices,
      buyers: entry.buyerSet.size,
      verdict: entry.buyerSet.size >= 3
        ? `Strong demand from ${entry.buyerSet.size} buyers near Jos.`
        : `${entry.buyerSet.size} buyer${entry.buyerSet.size === 1 ? "" : "s"} looking for ${entry.plainPlural}.`,
    };
  });

  return Response.json(demand);
}
