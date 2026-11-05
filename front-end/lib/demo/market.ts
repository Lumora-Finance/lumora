/** Shared marketplace data — demand posts and produce listings. */

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

export const MARKET_ITEMS: MarketItem[] = [
  // ── Demand posts ──────────────────────────
  {
    id: "d1", type: "demand", commodity: "Live Broilers", spec: "2.5–3.5 kg each, healthy, no visible injuries",
    poster: "Rayfield Restaurant", posterRole: "buyer", area: "Rayfield",
    price: 3500, priceUnit: "kg", unit: "bird", unitPlural: "birds",
    capacity: 80, remaining: 50, day: "Thu",
    image: "/images/step-buyer.jpg", postedAgo: "2h ago",
    description: "We need 80 live broilers delivered to our kitchen in Rayfield. Weighing happens on-site. Payment by bank transfer within 24 hours of delivery. Book at least 10 birds.",
  },
  {
    id: "d2", type: "demand", commodity: "Tomatoes", spec: "Grade A, Plateau Roma, firm and ripe",
    poster: "Caterer D", posterRole: "buyer", area: "Angwan Rukuba",
    price: 28000, priceUnit: "basket", unit: "basket", unitPlural: "baskets",
    capacity: 20, remaining: 12, day: "Wed",
    image: "/images/hero-farm.jpg", postedAgo: "5h ago",
    description: "Looking for 20 baskets of fresh Roma tomatoes for a weekend event. Must be firm, ripe, and locally grown. Pick-up at our kitchen in Angwan Rukuba, Wednesday 6–10am.",
  },
  {
    id: "d3", type: "demand", commodity: "Eggs", spec: "Crates of 30, medium to large",
    poster: "Bakery H", posterRole: "buyer", area: "Bukuru",
    price: 5600, priceUnit: "crate", unit: "crate", unitPlural: "crates",
    capacity: 80, remaining: 60, day: "Tue",
    image: "/images/step-scale.jpg", postedAgo: "1d ago",
    description: "Weekly demand for 80 crates of table eggs. We're a bakery — eggs go fast. Delivery Tuesday mornings 7–9am. Payment per crate on delivery, bank transfer.",
  },
  {
    id: "d4", type: "demand", commodity: "Live Turkey", spec: "6–9 kg, live or dressed",
    poster: "Grand Hotel Jos", posterRole: "buyer", area: "GRA, Jos",
    price: 4150, priceUnit: "kg", unit: "bird", unitPlural: "birds",
    capacity: 25, remaining: 15, day: "Sat",
    image: "/images/step-farmer.jpg", postedAgo: "2d ago",
    description: "Grand Hotel needs 25 turkeys every Saturday for our restaurant service. Live or dressed accepted. Weigh-in at our loading bay. Long-term partnership available for reliable suppliers.",
  },
  {
    id: "d5", type: "demand", commodity: "Live Broilers", spec: "2.5–3.5 kg, healthy",
    poster: "Hotel B", posterRole: "buyer", area: "Rayfield",
    price: 3800, priceUnit: "kg", unit: "bird", unitPlural: "birds",
    capacity: 40, remaining: 25, day: "Fri",
    image: "/images/hero-market.jpg", postedAgo: "3h ago",
    description: "Higher price for quality birds. 40 broilers every Friday. Must be 2.5kg minimum. We pay the best in Rayfield — ₦3,800/kg. Delivery 7–11am at our back entrance.",
  },
  {
    id: "d6", type: "demand", commodity: "Tomatoes", spec: "Fresh, mixed varieties",
    poster: "School C", posterRole: "buyer", area: "Farin Gada",
    price: 26500, priceUnit: "basket", unit: "basket", unitPlural: "baskets",
    capacity: 30, remaining: 20, day: "Thu",
    image: "/images/step-buyer.jpg", postedAgo: "6h ago",
    description: "School kitchen needs 30 baskets of tomatoes weekly for student meals. Mixed varieties OK. Delivery Thursday 6–8am. We pay on delivery.",
  },

  // ── Produce listings ──────────────────────
  {
    id: "l1", type: "listing", commodity: "Live Broilers", spec: "2.8–3.2 kg, free-range, vaccinated",
    poster: "Amina Farms", posterRole: "farmer", area: "Bukuru",
    price: 3400, priceUnit: "kg", unit: "bird", unitPlural: "birds",
    capacity: 120, remaining: 80, day: "Available now",
    image: "/images/hero-farm.jpg", postedAgo: "1h ago",
    description: "120 healthy broilers ready for sale. Free-range, fully vaccinated, 2.8–3.2 kg each. Can deliver within Jos and Bukuru. Discount for bulk orders above 50 birds.",
  },
  {
    id: "l2", type: "listing", commodity: "Tomatoes", spec: "Grade A Roma, freshly harvested",
    poster: "Barkin Ladi Farm", posterRole: "farmer", area: "Barkin Ladi",
    price: 780, priceUnit: "basket", unit: "basket", unitPlural: "baskets",
    capacity: 60, remaining: 45, day: "Available now",
    image: "/images/step-scale.jpg", postedAgo: "4h ago",
    description: "Just harvested 60 baskets of Grade A Roma tomatoes from our Plateau farm. Firm, ripe, and ready for market. Can deliver to Jos and surrounding areas. Price is negotiable for bulk.",
  },
  {
    id: "l3", type: "listing", commodity: "Eggs", spec: "Medium crates of 30, farm-fresh",
    poster: "Plateau Poultry", posterRole: "farmer", area: "Jos North",
    price: 5200, priceUnit: "crate", unit: "crate", unitPlural: "crates",
    capacity: 100, remaining: 70, day: "Available now",
    image: "/images/step-farmer.jpg", postedAgo: "8h ago",
    description: "Farm-fresh eggs from our 500-layer farm. 100 crates available weekly. Medium to large eggs, 30 per crate. Standing supply agreement available for regular buyers.",
  },
  {
    id: "l4", type: "listing", commodity: "Live Turkey", spec: "5–7 kg, naturally raised",
    poster: "Hilltop Turkey Farm", posterRole: "farmer", area: "Barkin Ladi",
    price: 4000, priceUnit: "kg", unit: "bird", unitPlural: "birds",
    capacity: 30, remaining: 20, day: "Available now",
    image: "/images/hero-market.jpg", postedAgo: "1d ago",
    description: "30 live turkeys, naturally raised on free range. 5–7 kg each. Healthy and well-fed. Available for immediate delivery within Plateau State. Book ahead for repeat orders.",
  },
];

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

export const SAMPLE_OFFERS: Record<string, Offer[]> = {
  d1: [
    { id: "o1", itemId: "d1", farmer: "Amina Farms", area: "Bukuru", price: 3400, priceUnit: "kg", qty: 30, unit: "bird", unitPlural: "birds", note: "30 birds at 2.8–3.2 kg, can deliver Thursday morning.", timeAgo: "1h ago" },
    { id: "o2", itemId: "d1", farmer: "Plateau Poultry", area: "Jos North", price: 3450, priceUnit: "kg", qty: 50, unit: "bird", unitPlural: "birds", note: "50 vaccinated broilers, 3 kg average. Delivery by 7am.", timeAgo: "3h ago" },
  ],
  d2: [
    { id: "o3", itemId: "d2", farmer: "Barkin Ladi Farm", area: "Barkin Ladi", price: 27000, priceUnit: "basket", qty: 15, unit: "basket", unitPlural: "baskets", note: "15 baskets of Grade A Roma, freshly harvested today.", timeAgo: "2h ago" },
  ],
};
