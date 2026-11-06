import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/commodities
 *
 * Returns all commodities from the database, grouped by category.
 * Public endpoint — no auth required, commodity list is not sensitive.
 *
 * Response shape:
 * [
 *   {
 *     label: "Live poultry",
 *     items: [
 *       { id, name, unit, latest_window_end, max_units_per_crate }
 *     ]
 *   }
 * ]
 */

type CommodityRow = {
  id: string;
  name: string;
  unit: string;
  category: string | null;
  latest_window_end: string | null;
  max_units_per_crate: number | null;
};

// Category order matches how they appear in the listing form
const CATEGORY_ORDER = [
  "Live poultry",
  "Eggs & dairy",
  "Live animals",
  "Vegetables",
  "Fruits",
  "Root crops & tubers",
  "Grains & cereals",
  "Legumes & pulses",
  "Fish & seafood",
  "Spices & condiments",
  "Processed & packaged",
];

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase
    .from("commodities")
    .select("id, name, unit, category, latest_window_end, max_units_per_crate")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by category
  const grouped = new Map<string, CommodityRow[]>();
  for (const row of (data ?? []) as CommodityRow[]) {
    const cat = row.category ?? "Other";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(row);
  }

  // Sort categories by preferred order, unknown categories appended alphabetically
  const knownOrder = CATEGORY_ORDER.filter((c) => grouped.has(c));
  const unknownOrder = [...grouped.keys()]
    .filter((c) => !CATEGORY_ORDER.includes(c))
    .sort();
  const orderedKeys = [...knownOrder, ...unknownOrder];

  const result = orderedKeys.map((label) => ({
    label,
    items: grouped.get(label)!.map((row) => ({
      id: row.id,
      name: row.name,
      unit: row.unit,
      latest: row.latest_window_end
        ? row.latest_window_end.slice(0, 5)   // "HH:MM:SS" → "HH:MM"
        : null,
      crate: row.max_units_per_crate ?? null,
    })),
  }));

  return NextResponse.json(result, {
    headers: {
      // Cache for 5 minutes — commodity list changes rarely
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
    },
  });
}
