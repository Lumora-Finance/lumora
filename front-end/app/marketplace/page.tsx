import type { Metadata } from "next";

import { MarketplaceBoard } from "@/components/marketplace/marketplace-board";

export const metadata: Metadata = {
  title: "Marketplace",
  robots: { index: false, follow: false },
};

export default function MarketplacePage() {
  return <MarketplaceBoard />;
}
