/** Shared marketplace types — demand posts and produce listings. */

export type MarketItemType = "demand" | "listing";

export type MarketItem = {
  id: string;
  type: MarketItemType;
  commodity: string;
  spec: string;
  /** Who posted it — buyer name for demand, farmer name for listing */
  poster: string;
  posterRole: "buyer" | "farmer";
  area: string;
  price: number;
  priceUnit: string; // "kg", "basket", "crate"
  unit: string; // "bird", "basket", "crate"
  unitPlural: string;
  capacity: number; // total
  remaining: number; // left
  day: string;
  image?: string;
  postedAgo: string;
  description: string;
};

export type Offer = {
  id: string;
  itemId: string;
  farmer: string;
  area: string;
  price: number;
  priceUnit: string;
  qty: number;
  unit: string;
  unitPlural: string;
  note: string;
  timeAgo: string;
};
