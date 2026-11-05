"use client";

import Link from "next/link";

import { Panel, PanelHeading, PanelLink } from "./panel";

type BoardItem = {
  id: string;
  commodity: string;
  org: string;
  price: string;
  unit: string;
  needs: string;
  distance: string;
  best?: boolean;
};

const ITEMS: BoardItem[] = [
  { id: "1", commodity: "Live broilers", org: "Rayfield Restaurant", price: "₦3,800", unit: "kg", needs: "Needs 40", distance: "3 km", best: true },
  { id: "2", commodity: "Live broilers", org: "Grand Hotel Jos", price: "₦3,650", unit: "kg", needs: "Needs 25", distance: "5 km" },
  { id: "3", commodity: "Tomatoes", org: "Barkin Ladi Farm", price: "₦780", unit: "basket", needs: "60 baskets", distance: "9 km" },
];

export function BoardPreview() {
  return (
    <Panel className="flex h-full flex-col">
      <PanelHeading title="Near you" sub="The best matches right now" action={<PanelLink href="/dashboard/marketplace">Marketplace</PanelLink>} />
      <ul className="mt-2 flex-1 divide-y divide-line px-5 pb-2 sm:px-6">
        {ITEMS.map((item) => (
          <li key={item.id}>
            <Link href="/dashboard/marketplace" className="flex items-center gap-3 py-3.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-paper font-num text-xs text-ink">{item.distance}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium text-ink">{item.org}</span>
                  {item.best && <span className="shrink-0 rounded-full bg-amber-soft px-2 py-px text-[11px] font-medium text-[#9A6A1A]">Best price</span>}
                </span>
                <span className="block truncate text-body-sm text-ink-muted">{item.commodity} · {item.needs}</span>
              </span>
              <span className="shrink-0 text-right text-body-sm text-ink-muted">
                <span className="font-num font-medium text-ink">{item.price}</span>/{item.unit}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
