/** Example data for the demand explorer. None of this is real market data. */
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

export const DEMAND: Produce[] = [
  {
    key: "broilers",
    chip: "broilers",
    command: "DEMAND BROILER JOS",
    weeklyDemand: 420,
    demandUnit: "broilers a week",
    priceUnit: "kg",
    prices: [3360, 3410, 3390, 3460, 3500, 3480, 3560, 3540],
    buyers: 12,
    verdict: "Strong, steady demand. Prices have risen in most weeks.",
  },
  {
    key: "turkey",
    chip: "turkey",
    command: "DEMAND TURKEY JOS",
    weeklyDemand: 60,
    demandUnit: "turkeys a week",
    priceUnit: "kg",
    prices: [3950, 3980, 4020, 4010, 4080, 4100, 4170, 4150],
    buyers: 4,
    verdict: "Small but steady. Four buyers, and very few farmers supplying them.",
  },
  {
    key: "tomatoes",
    chip: "tomatoes",
    command: "DEMAND TOMATO JOS",
    weeklyDemand: 140,
    demandUnit: "baskets a week",
    priceUnit: "basket",
    prices: [31000, 30000, 29500, 27000, 26000, 27500, 28500, 28000],
    buyers: 6,
    verdict: "Plenty of demand, but prices swing with the season. Time your harvest.",
  },
  {
    key: "eggs",
    chip: "eggs",
    command: "DEMAND EGGS JOS",
    weeklyDemand: 210,
    demandUnit: "crates a week",
    priceUnit: "crate",
    prices: [5300, 5350, 5400, 5450, 5500, 5520, 5580, 5600],
    buyers: 5,
    verdict: "Steady all year, mostly from hotels and schools.",
  },
];

export const DEFAULT_PRODUCE = "turkey";
