import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { connection } from "next/server";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/**
 * GET /api/ai-scan?commodity=<name>&mode=demand|supply
 *
 * mode=demand  → caller is posting a demand listing (buyer).
 *                Returns active SUPPLY listings (farmers selling this).
 * mode=supply  → caller is posting a supply listing (farmer).
 *                Returns active DEMAND listings (buyers wanting this).
 *
 * Returns up to 8 matches, newest first.
 */

export type AiScanResult = {
  mode: "demand" | "supply";
  commodity: string;
  matches: AiMatch[];
};

export type AiMatch = {
  id: string;
  kind: "supply" | "demand";
  title: string;
  detail: string;
  price_display: string;
  area: string;
  url: string;
};

function formatKobo(kobo: number) {
  return `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;
}

export async function GET(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(request.url);
  const commodity = searchParams.get("commodity")?.trim() ?? "";
  const mode = searchParams.get("mode") === "supply" ? "supply" : "demand";

  if (!commodity) return NextResponse.json({ mode, commodity, matches: [] });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const matches: AiMatch[] = [];

  if (mode === "demand") {
    // Buyer is posting demand → find farmers who are already SELLING this commodity
    const { data } = await supabase
      .from("farmer_listings")
      .select(`
        id, title, description, unit_price_kobo, qty, unit, created_at,
        commodity:commodities!commodity_id(name),
        farmer:users!farmer_id(display_name),
        area:areas!area_id(name)
      `)
      .eq("status", "active")
      .ilike("commodities.name", commodity)
      .order("created_at", { ascending: false })
      .limit(8);

    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const commodityName = (row.commodity as { name?: string } | null)?.name ?? commodity;
      if (!commodityName.toLowerCase().includes(commodity.toLowerCase())) continue;

      const price = Number(row.unit_price_kobo ?? 0);
      const unit = String(row.unit ?? "unit");
      const area = (row.area as { name?: string } | null)?.name ?? "Unknown area";
      const farmerName = (row.farmer as { display_name?: string } | null)?.display_name ?? "A farmer";

      matches.push({
        id: String(row.id),
        kind: "supply",
        title: String(row.title ?? commodityName),
        detail: `${farmerName} · ${String(row.qty ?? "?")} ${unit}s available`,
        price_display: price > 0 ? `${formatKobo(price)} per ${unit}` : "Price on request",
        area,
        url: `/dashboard/marketplace`,
      });
    }
  } else {
    // Farmer is posting supply → find buyers who are already DEMANDING this commodity
    const { data } = await supabase
      .from("demand_listings")
      .select(`
        id, spec, unit_price_kobo, unit_price_min_kobo, capacity_per_day,
        created_at, location_area,
        commodity:commodities!commodity_id(name, unit),
        buyer:users!buyer_id(display_name),
        area:areas!area_id(name)
      `)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(50);

    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const commodityObj = row.commodity as { name?: string; unit?: string } | null;
      const commodityName = commodityObj?.name ?? "";
      if (!commodityName.toLowerCase().includes(commodity.toLowerCase())) continue;

      const maxPrice = Number(row.unit_price_kobo ?? 0);
      const minPrice = Number(row.unit_price_min_kobo ?? maxPrice);
      const unit = commodityObj?.unit ?? "unit";
      const area = (row.area as { name?: string } | null)?.name
        ?? String(row.location_area ?? "Unknown area");
      const buyerName = (row.buyer as { display_name?: string } | null)?.display_name ?? "A buyer";
      const capacity = Number(row.capacity_per_day ?? 0);

      const priceDisplay = minPrice < maxPrice
        ? `${formatKobo(minPrice)}–${formatKobo(maxPrice)} per ${unit}`
        : `${formatKobo(maxPrice)} per ${unit}`;

      matches.push({
        id: String(row.id),
        kind: "demand",
        title: `${buyerName} wants ${commodityName}`,
        detail: `${capacity > 0 ? `Up to ${capacity} ${unit}s/day` : "Standing demand"} · ${area}`,
        price_display: priceDisplay,
        area,
        url: `/dashboard/board`,
      });

      if (matches.length >= 8) break;
    }
  }

  return NextResponse.json({ mode, commodity, matches } satisfies AiScanResult);
}
