/**
 * Commodity data and registry — no "use client" so this is safe to import
 * from both server route handlers and client components.
 */

export type CommodityOption = {
  id?: string;
  name: string;
  unit: "kg" | "bag" | "basket" | "crate" | "litre" | "unit" | "dozen" | "tonne" | "bundle" | "bunch" | string;
  /** Earliest window_end for time-sensitive produce, null = no constraint */
  latest: string | null;
  /** Max per crate note to append to spec, null = none */
  crate: number | null;
};

export type CommodityCategory = { label: string; items: CommodityOption[] };

// ---------------------------------------------------------------------------
// Static fallback data — used before the DB fetch resolves or if it fails.
// This is intentionally minimal; the real list comes from /api/commodities.
// ---------------------------------------------------------------------------
export const ALL_COMMODITIES: CommodityCategory[] = [
  {
    label: "Live poultry",
    items: [
      { name: "Live broilers", unit: "kg", latest: "11:00", crate: 10 },
      { name: "Live Turkey", unit: "kg", latest: "11:00", crate: 10 },
      { name: "Live guinea fowl", unit: "kg", latest: "11:00", crate: null },
      { name: "Live ducks", unit: "kg", latest: "11:00", crate: null },
      { name: "Live geese", unit: "kg", latest: "11:00", crate: null },
      { name: "Day-old chicks", unit: "unit", latest: null, crate: null },
      { name: "Point-of-lay pullets", unit: "unit", latest: null, crate: null },
    ],
  },
  {
    label: "Eggs & dairy",
    items: [
      { name: "Eggs", unit: "crate", latest: null, crate: null },
      { name: "Duck eggs", unit: "crate", latest: null, crate: null },
      { name: "Quail eggs", unit: "crate", latest: null, crate: null },
      { name: "Fresh cow milk", unit: "litre", latest: null, crate: null },
      { name: "Goat milk", unit: "litre", latest: null, crate: null },
      { name: "Wara (fresh cheese)", unit: "kg", latest: null, crate: null },
      { name: "Yoghurt", unit: "litre", latest: null, crate: null },
      { name: "Nono (fermented milk)", unit: "litre", latest: null, crate: null },
    ],
  },
  {
    label: "Live animals",
    items: [
      { name: "Goats", unit: "unit", latest: null, crate: null },
      { name: "Sheep", unit: "unit", latest: null, crate: null },
      { name: "Cattle", unit: "unit", latest: null, crate: null },
      { name: "Pigs", unit: "unit", latest: null, crate: null },
      { name: "Rabbits", unit: "unit", latest: null, crate: null },
      { name: "Catfish (live)", unit: "kg", latest: null, crate: null },
      { name: "Tilapia (live)", unit: "kg", latest: null, crate: null },
      { name: "Snails", unit: "kg", latest: null, crate: null },
      { name: "Grass-cutter (cane rat)", unit: "unit", latest: null, crate: null },
    ],
  },
  {
    label: "Vegetables",
    items: [
      { name: "Tomatoes", unit: "basket", latest: null, crate: null },
      { name: "Pepper (tatashe)", unit: "basket", latest: null, crate: null },
      { name: "Scotch bonnet (rodo)", unit: "basket", latest: null, crate: null },
      { name: "Onions", unit: "bag", latest: null, crate: null },
      { name: "Spinach (efo)", unit: "bundle", latest: null, crate: null },
      { name: "Ugwu (fluted pumpkin)", unit: "bundle", latest: null, crate: null },
      { name: "Bitter leaf", unit: "bundle", latest: null, crate: null },
      { name: "Waterleaf", unit: "bundle", latest: null, crate: null },
      { name: "Cabbage", unit: "unit", latest: null, crate: null },
      { name: "Carrots", unit: "kg", latest: null, crate: null },
      { name: "Cucumber", unit: "bag", latest: null, crate: null },
      { name: "Lettuce", unit: "unit", latest: null, crate: null },
      { name: "Green beans", unit: "kg", latest: null, crate: null },
      { name: "Okra", unit: "kg", latest: null, crate: null },
      { name: "Aubergine (garden egg)", unit: "basket", latest: null, crate: null },
      { name: "Corn (fresh)", unit: "unit", latest: null, crate: null },
      { name: "Garlic", unit: "kg", latest: null, crate: null },
      { name: "Ginger", unit: "kg", latest: null, crate: null },
    ],
  },
  {
    label: "Fruits",
    items: [
      { name: "Watermelon", unit: "unit", latest: null, crate: null },
      { name: "Mango", unit: "bag", latest: null, crate: null },
      { name: "Banana", unit: "bunch", latest: null, crate: null },
      { name: "Plantain", unit: "bunch", latest: null, crate: null },
      { name: "Pineapple", unit: "unit", latest: null, crate: null },
      { name: "Pawpaw (papaya)", unit: "unit", latest: null, crate: null },
      { name: "Orange", unit: "bag", latest: null, crate: null },
      { name: "Lemon / lime", unit: "bag", latest: null, crate: null },
      { name: "Avocado", unit: "bag", latest: null, crate: null },
      { name: "Guava", unit: "basket", latest: null, crate: null },
      { name: "Coconut", unit: "unit", latest: null, crate: null },
      { name: "Grapes", unit: "kg", latest: null, crate: null },
      { name: "Strawberries", unit: "kg", latest: null, crate: null },
    ],
  },
  {
    label: "Root crops & tubers",
    items: [
      { name: "Irish Potato", unit: "bag", latest: null, crate: null },
      { name: "Sweet potato", unit: "bag", latest: null, crate: null },
      { name: "Yam", unit: "unit", latest: null, crate: null },
      { name: "Cassava", unit: "bag", latest: null, crate: null },
      { name: "Cocoyam", unit: "bag", latest: null, crate: null },
    ],
  },
  {
    label: "Grains & cereals",
    items: [
      { name: "Maize (dry)", unit: "bag", latest: null, crate: null },
      { name: "Rice (paddy)", unit: "bag", latest: null, crate: null },
      { name: "Rice (milled)", unit: "bag", latest: null, crate: null },
      { name: "Millet", unit: "bag", latest: null, crate: null },
      { name: "Sorghum", unit: "bag", latest: null, crate: null },
      { name: "Guinea corn", unit: "bag", latest: null, crate: null },
      { name: "Wheat", unit: "bag", latest: null, crate: null },
      { name: "Oats", unit: "bag", latest: null, crate: null },
    ],
  },
  {
    label: "Legumes & pulses",
    items: [
      { name: "Soybean", unit: "bag", latest: null, crate: null },
      { name: "Cowpea (black-eyed beans)", unit: "bag", latest: null, crate: null },
      { name: "Groundnuts", unit: "bag", latest: null, crate: null },
      { name: "Bambara nuts", unit: "bag", latest: null, crate: null },
      { name: "Sesame (beniseed)", unit: "bag", latest: null, crate: null },
      { name: "Melon seed (egusi)", unit: "bag", latest: null, crate: null },
    ],
  },
  {
    label: "Fish & seafood",
    items: [
      { name: "Catfish (dressed)", unit: "kg", latest: null, crate: null },
      { name: "Tilapia (dressed)", unit: "kg", latest: null, crate: null },
      { name: "Mackerel (titus)", unit: "kg", latest: null, crate: null },
      { name: "Stockfish", unit: "kg", latest: null, crate: null },
      { name: "Dried fish", unit: "kg", latest: null, crate: null },
      { name: "Shrimp", unit: "kg", latest: null, crate: null },
      { name: "Crayfish", unit: "kg", latest: null, crate: null },
      { name: "Periwinkle", unit: "kg", latest: null, crate: null },
    ],
  },
  {
    label: "Spices & condiments",
    items: [
      { name: "Uziza leaf", unit: "bundle", latest: null, crate: null },
      { name: "Ehuru (calabash nutmeg)", unit: "kg", latest: null, crate: null },
      { name: "Ogiri (fermented locust bean)", unit: "kg", latest: null, crate: null },
      { name: "Iru (locust bean)", unit: "kg", latest: null, crate: null },
      { name: "Turmeric", unit: "kg", latest: null, crate: null },
      { name: "Cinnamon", unit: "kg", latest: null, crate: null },
      { name: "Cloves", unit: "kg", latest: null, crate: null },
    ],
  },
  {
    label: "Processed & packaged",
    items: [
      { name: "Palm oil (crude)", unit: "litre", latest: null, crate: null },
      { name: "Groundnut oil", unit: "litre", latest: null, crate: null },
      { name: "Coconut oil", unit: "litre", latest: null, crate: null },
      { name: "Honey", unit: "litre", latest: null, crate: null },
      { name: "Shea butter", unit: "kg", latest: null, crate: null },
    ],
  },
];

// ---------------------------------------------------------------------------
// Registry — mutable, updated when DB data loads. findCommodity reads this.
// ---------------------------------------------------------------------------
let _registry: Map<string, CommodityOption> = new Map(
  ALL_COMMODITIES.flatMap((cat) => cat.items.map((item) => [item.name.toLowerCase(), item])),
);

export function updateRegistry(categories: CommodityCategory[]): void {
  _registry = new Map(
    categories.flatMap((cat) => cat.items.map((item) => [item.name.toLowerCase(), item])),
  );
}

/** Look up a commodity by name (case-insensitive). Works with both static and DB data. */
export function findCommodity(name: string): CommodityOption | undefined {
  return _registry.get(name.toLowerCase());
}
