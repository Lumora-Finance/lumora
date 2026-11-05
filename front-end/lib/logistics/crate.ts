/** How a commodity's unit appears on the market board. */
export const MAX_SLOTS = 60;
export const MAX_FLOCK_TOKENS = 60;
export const FLOCK_STEP = 5;
export const DEFAULT_FLOCK = 30;

export type SlotShape = "round" | "crate" | "basket";

export function slotShape(priceUnit: string): SlotShape {
  if (priceUnit === "basket") return "basket";
  if (priceUnit === "crate") return "crate";
  return "round";
}

/** The short word on a crate. "baskets", not "baskets of tomatoes". */
export function unitWords(priceUnit: string, plainName: string, plainPlural: string) {
  if (priceUnit === "kg") return { one: plainName, many: plainPlural };
  return { one: priceUnit, many: `${priceUnit}s` };
}

export const countWord = (count: number, words: { one: string; many: string }) =>
  `${count} ${count === 1 ? words.one : words.many}`;

export const needsMore = (remaining: number, words: { one: string; many: string }) =>
  `Needs ${remaining} more ${remaining === 1 ? words.one : words.many}`;

export const takesLabel = (units: number, stock: number) =>
  units >= stock ? `Takes all ${stock}` : `Takes ${units} of your ${stock}`;

export const unitsTaken = (stock: number, remaining: number) => Math.max(0, Math.min(stock, remaining));

export const stepStock = (stock: number, direction: 1 | -1) => Math.max(0, stock + direction * FLOCK_STEP);

/** "close", as a muted word on the card. */
export function distanceWord(km: number) {
  if (km < 5) return "very close";
  return km <= 15 ? "close" : "far";
}
