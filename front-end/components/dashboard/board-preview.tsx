"use client";

import Link from "next/link";

import { RowsSkeleton } from "@/components/loader/skeletons";
import { pricePer } from "@/lib/email/format";
import { useDashboardData } from "@/lib/hooks/use-dashboard-data";
import type { BoardCard } from "@/lib/logistics/board";

import { Panel, PanelHeading, PanelLink } from "./panel";

const MOST_SHOWN = 3;

/** The best-paying buyers from the real board, which already comes highest price first. */
export function BoardPreview() {
  const { data, loading } = useDashboardData<{ cards?: BoardCard[] }>("board");
  const cards = (data?.cards ?? []).filter((card) => card.remaining > 0).slice(0, MOST_SHOWN);

  return (
    <Panel className="flex h-full flex-col">
      <PanelHeading title="Near you" sub="The best matches right now" action={<PanelLink href="/dashboard/board">See the board</PanelLink>} />
      {loading ? (
        <RowsSkeleton rows={3} label="Finding buyers" className="mt-2 flex-1 px-5 sm:px-6" />
      ) : cards.length === 0 ? (
        <p className="flex-1 px-5 py-8 text-center text-body-sm text-ink-muted sm:px-6">No buyers near you right now. We&apos;ll show them here as they post.</p>
      ) : (
        <ul className="mt-2 flex-1 divide-y divide-line px-5 pb-2 sm:px-6">
          {cards.map((card, index) => (
            <li key={card.slotId}>
              <Link href="/dashboard/board" className="flex items-center gap-3 py-3.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-paper font-num text-xs text-ink">
                  {card.km === null ? "—" : `${Math.max(card.km, 1)} km`}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium text-ink">{card.buyer}</span>
                    {index === 0 && cards.length > 1 && <span className="shrink-0 rounded-full bg-amber-soft px-2 py-px text-[11px] font-medium text-[#9A6A1A]">Best price</span>}
                  </span>
                  <span className="block truncate text-body-sm text-ink-muted">{card.plainPlural} · Needs {card.remaining}</span>
                </span>
                <span className="shrink-0 font-num text-body-sm font-medium text-ink">{pricePer(card.priceKobo, card.priceUnit)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
