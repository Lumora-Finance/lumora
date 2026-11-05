/**
 * What a farmer takes home. Settlement charges farmers no fee today, only the buyer's 1.5%, so this
 * is 0. If a farmer fee is introduced, change it here and in settlement together, or this page would
 * promise a different amount from what gets paid.
 */
export const FARMER_FEE_PCT = 0;

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
