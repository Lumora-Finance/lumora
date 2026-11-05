/** Types for the demand explorer. */

export type Produce = {
  key: string;
  chip: string;
  command: string;
  weeklyDemand: number;
  demandUnit: string;
  priceUnit: string;
  prices: number[];
  buyers: number;
  verdict: string;
};

export const DEFAULT_PRODUCE = "turkey";
