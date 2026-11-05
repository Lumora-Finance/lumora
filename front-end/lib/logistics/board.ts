import { roadKm, type LatLng } from "@/lib/geo";

export type BoardSort = "price" | "nearest";

export type RawBoard = {
  farmer_area: (LatLng & { name: string }) | null;
  stock?: Record<string, number>;
  follows?: string[];
  rows: {
    listing_id: string; slot_id: string; buyer: string; area: string; area_lat: number; area_lng: number;
    price_kobo: number; price_unit: string; remaining: number; min_qty: number; window_start: string; window_end: string;
    delivery_mode: "farmer_delivers" | "buyer_collects"; plain_name: string; plain_plural: string; spec: string | null;
    commodity?: string; min_weight_kg?: number; max_weight_kg?: number;
  }[];
};

export type BoardCard = {
  listingId: string;
  slotId: string;
  buyer: string;
  area: string;
  km: number | null;
  priceKobo: number;
  priceUnit: string;
  remaining: number;
  minQty: number;
  windowStart: string;
  windowEnd: string;
  collects: boolean;
  plainName: string;
  plainPlural: string;
  spec: string | null;
  commodity: string;
  minWeightKg: number;
  maxWeightKg: number;
};

/** Distances run from area to area, so a card never reveals anyone's exact location. */
export function buildBoard(raw: RawBoard, sort: BoardSort): BoardCard[] {
  const cards = raw.rows.map((row): BoardCard => ({
    listingId: row.listing_id,
    slotId: row.slot_id,
    buyer: row.buyer,
    area: row.area,
    km: raw.farmer_area ? roadKm(raw.farmer_area, { lat: Number(row.area_lat), lng: Number(row.area_lng) }) : null,
    priceKobo: row.price_kobo,
    priceUnit: row.price_unit,
    remaining: row.remaining,
    minQty: row.min_qty,
    windowStart: row.window_start,
    windowEnd: row.window_end,
    collects: row.delivery_mode === "buyer_collects",
    plainName: row.plain_name,
    plainPlural: row.plain_plural,
    spec: row.spec,
    commodity: row.commodity ?? "",
    minWeightKg: Number(row.min_weight_kg ?? 0),
    maxWeightKg: Number(row.max_weight_kg ?? 0),
  }));
  if (sort === "nearest") {
    return [...cards].sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity) || b.priceKobo - a.priceKobo);
  }
  return [...cards].sort((a, b) => b.priceKobo - a.priceKobo);
}
