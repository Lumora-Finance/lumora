import { ALL_COMMODITIES, findCommodity, type CommodityOption } from "@/lib/logistics/commodities";
import { nairaToKobo } from "@/lib/money/rules";

export { ALL_COMMODITIES };

/**
 * Flat list of commodities used for validation helpers.
 */
export const LISTING_COMMODITIES = ALL_COMMODITIES.flatMap((cat) => cat.items);

export const CUTOFF_HOURS = 24;
export const LISTING_STEPS = 4;

export type ListingDraft = {
  /** Free-form commodity name — validated against the DB on submit */
  commodity: string;
  mode: "farmer_delivers" | "buyer_collects";
  address: string;
  date: string;
  windowStart: string;
  windowEnd: string;
  /** Minimum price per unit the buyer will pay (naira string) */
  priceMin: string;
  /** Maximum price per unit the buyer will pay (naira string) */
  priceMax: string;
  capacity: string;
  minQty: string;
  minWeight: string;
  maxWeight: string;
  spec: string;
  images: string[];
  /** The unit auto-filled when a commodity is selected */
  unit: string;
};

/**
 * Returns the commodity rules for the current draft commodity.
 * Falls back gracefully to kg defaults so the form never crashes.
 */
export const commodityRules = (name: string): CommodityOption & { latest: string | null; crate: number | null } => {
  const found = findCommodity(name);
  if (found) return found;
  // Unknown / custom commodity — default to kg, no time constraint
  return { name, unit: "kg", latest: null, crate: null };
};

/** Only kg-priced produce has a weight to ask about. Baskets, crates etc. count as 1 each. */
export const asksForWeight = (draft: ListingDraft) => commodityRules(draft.commodity).unit === "kg";

const wholeNumber = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value) : null);
const positive = (value: string) => {
  const number = Number(value);
  return value.trim() !== "" && Number.isFinite(number) && number > 0 ? number : null;
};

/** The start of the window as an instant. Lagos is UTC+1 all year. */
const windowStartAt = (draft: ListingDraft) =>
  draft.date && draft.windowStart ? new Date(`${draft.date}T${draft.windowStart}:00+01:00`) : null;

/** When booking closes, for showing the buyer. Null until there's a day and a time. */
export function cutoffAt(draft: ListingDraft): Date | null {
  const start = windowStartAt(draft);
  if (!start || Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() - CUTOFF_HOURS * 3_600_000);
}

/** What's wrong with a step, in plain words, or null when it can move on. Steps count from 1. */
export function stepProblem(step: number, draft: ListingDraft, now: Date): string | null {
  if (step === 1) {
    if (!draft.commodity.trim()) return "Choose a produce type.";
    if (draft.mode === "farmer_delivers" && !draft.address.trim()) return "Add the address farmers should deliver to.";
    if (draft.images.length < 1) return "Add at least 1 photo so farmers can see what you need.";
    return null;
  }
  if (step === 2) {
    if (!draft.date) return "Choose a day.";
    if (!draft.windowStart || !draft.windowEnd) return "Choose a start and end time.";
    if (draft.windowEnd <= draft.windowStart) return "The end time has to be after the start time.";
    const { latest } = commodityRules(draft.commodity);
    if (latest !== null && draft.windowEnd > latest) return `${draft.commodity} must be delivered by ${latest}.`;
    const cutoff = cutoffAt(draft);
    if (!cutoff || cutoff.getTime() <= now.getTime()) return `Choose a later day. Farmers need at least ${CUTOFF_HOURS} hours to book.`;
    return null;
  }
  if (step === 3) {
    const minKobo = nairaToKobo(draft.priceMin);
    const maxKobo = nairaToKobo(draft.priceMax);
    if (!minKobo || minKobo <= 0) return "Enter the minimum price you will pay (e.g. 3000).";
    if (!maxKobo || maxKobo <= 0) return "Enter the maximum price you will pay (e.g. 4000).";
    if (maxKobo < minKobo) return "The maximum price must be equal to or higher than the minimum.";
    const capacity = wholeNumber(draft.capacity);
    const smallest = wholeNumber(draft.minQty);
    if (!capacity) return "Enter how many you need.";
    if (!smallest) return "Enter the smallest order you'll take.";
    if (smallest > capacity) return "The smallest order can't be more than you need.";
    if (asksForWeight(draft)) {
      const min = positive(draft.minWeight);
      const max = positive(draft.maxWeight);
      if (!min || !max) return "Enter the smallest and largest weight for each one.";
      if (max < min) return "The largest weight can't be less than the smallest.";
    }
    return null;
  }
  return null;
}

/** The most this can ever hold from the buyer's balance: every unit at the largest weight × max price. */
export function largestHoldKobo(draft: ListingDraft): number | null {
  const kobo = nairaToKobo(draft.priceMax);
  const capacity = wholeNumber(draft.capacity);
  const max = asksForWeight(draft) ? positive(draft.maxWeight) : 1;
  if (!kobo || !capacity || !max) return null;
  return Math.ceil((capacity * Math.round(max * 1000) * kobo) / 1000);
}

/** What the API takes. Call only once every step has passed. */
export function listingBody(draft: ListingDraft) {
  const weighs = asksForWeight(draft);
  return {
    commodity: draft.commodity,
    unitPriceKobo: nairaToKobo(draft.priceMax),
    unitPriceMinKobo: nairaToKobo(draft.priceMin),
    unitPriceMaxKobo: nairaToKobo(draft.priceMax),
    capacity: Number(draft.capacity),
    minQty: Number(draft.minQty),
    minWeight: weighs ? Number(draft.minWeight) : 1,
    maxWeight: weighs ? Number(draft.maxWeight) : 1,
    mode: draft.mode,
    date: draft.date,
    windowStart: draft.windowStart,
    windowEnd: draft.windowEnd,
    address: draft.mode === "farmer_delivers" ? draft.address.trim() : null,
    spec: draft.spec.trim(),
    images: draft.images,
  };
}

/** Only photos this person uploaded to our own storage can go on their listing. */
export function ownListingImages(images: unknown, supabaseUrl: string | undefined, userId: string): string[] {
  if (!Array.isArray(images) || !supabaseUrl) return [];
  const prefix = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/demand-listing-images/${userId}/`;
  return images.filter((url): url is string => typeof url === "string" && url.startsWith(prefix) && !url.includes("..")).slice(0, 4);
}
