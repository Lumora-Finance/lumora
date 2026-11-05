import { RULES } from "./money/rules";

/** What a farmer takes home. The same fee as settlement, and free for their first deliveries. */
export const FARMER_FEE_PCT = RULES.FARMER_FEE_PCT;

/** How many more deliveries this farmer pays no fee on. */
export const freeDeliveriesLeft = (completed: number) => Math.max(RULES.FREE_FARMER_DELIVERIES - completed, 0);

const toGrams = (kg: number) => Math.round(kg * 1000);

export type TakeHomeInput = {
  units: number;
  minWeightKg: number;
  maxWeightKg: number;
  priceKobo: number;
  farmerFeePct?: number;
  freeDeliveriesLeft?: number;
};

/** units × average spec weight × price × (1 − farmer fee, or 0 within free deliveries), in kobo. */
export function takeHomeKobo({
  units,
  minWeightKg,
  maxWeightKg,
  priceKobo,
  farmerFeePct = FARMER_FEE_PCT,
  freeDeliveriesLeft = 0,
}: TakeHomeInput): number {
  if (units <= 0) return 0;
  // Worked in whole grams, so no float arithmetic touches the money.
  const gross = (units * (toGrams(minWeightKg) + toGrams(maxWeightKg)) * priceKobo) / 2000;
  const fee = freeDeliveriesLeft > 0 ? 0 : (gross * farmerFeePct) / 100;
  return Math.round(gross - fee);
}
