"use client";

import { useState } from "react";
import type { User } from "firebase/auth";

import type { BoardCard } from "@/lib/logistics/board";
import { whenLabel } from "@/lib/logistics/board-copy";
import { apiFetch } from "@/lib/logistics/client";
import {
  distanceWord, MAX_SLOTS, needsMore, slotShape, takesLabel, unitsTaken, unitWords,
} from "@/lib/logistics/crate";
import { formatKobo } from "@/lib/money/rules";
import { takeHomeKobo } from "@/lib/pricing";
import { cn } from "@/lib/utils";

const SLOT_SHAPES = {
  round: "aspect-square rounded-full",
  crate: "aspect-[4/3] rounded-[4px]",
  basket: "aspect-square rounded-[10px]",
};

const FAILURES: Record<string, string> = {
  only_n_left: "They need fewer than that now.",
  below_minimum: "They need more than that.",
  past_cutoff: "It's too late to sell for that day.",
  new_farmer_cap: "Your first sale can be up to 20.",
  over_declared_stock: "That's more than you said you have for that day.",
  farmer_banned: "You can't sell right now because you missed recent deliveries.",
  insufficient_funds: "This buyer isn't buying right now.",
  slot_closed: "This buyer isn't buying right now.",
};

export const cardTakeHome = (card: BoardCard, stock: number) =>
  takeHomeKobo({
    units: unitsTaken(stock, card.remaining),
    minWeightKg: card.minWeightKg,
    maxWeightKg: card.maxWeightKg,
    priceKobo: card.priceKobo,
  });

function PriceTag({ card }: { card: BoardCard }) {
  const price = formatKobo(card.priceKobo);
  return (
    <span className="market-tag absolute -top-2.5 -right-2.5 block rotate-3 bg-market-kraft py-1.5 pr-3 pl-6 text-market-ink">
      <span aria-hidden="true" className="absolute top-1/2 left-3 size-1.5 -translate-y-1/2 rounded-full bg-market-card" />
      <span className="block text-[18px] leading-6 font-medium whitespace-nowrap">
        <span className="font-display">{price.slice(0, 1)}</span>
        <span className="font-num">{price.slice(1)}</span>
      </span>
      <span className="block text-[11px] leading-3.5 whitespace-nowrap">for every {card.priceUnit}</span>
    </span>
  );
}

function Road({ km, area }: { km: number; area: string }) {
  return (
    <span className="mt-3 flex items-center gap-2 text-body-sm text-market-muted">
      <span className="shrink-0">Your farm</span>
      <span className="market-road relative flex h-px min-w-12 flex-1 items-center justify-center">
        <span className="font-num bg-market-card px-1.5 text-xs text-market-ink">{Math.max(km, 1)} km</span>
      </span>
      <span className="shrink-0 text-right">{area}</span>
    </span>
  );
}


export function CrateCard({
  card,
  stock,
  selected,
  example,
  user,
  onToggle,
  onSold,
}: {
  card: BoardCard;
  stock: number;
  selected: boolean;
  example: boolean;
  user: User | null;
  onToggle: () => void;
  onSold: () => void;
}) {
  const [selling, setSelling] = useState(false);
  const [qty, setQty] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const words = unitWords(card.priceUnit, card.plainName, card.plainPlural);
  const shape = slotShape(card.priceUnit);
  const shown = Math.min(card.remaining, MAX_SLOTS);
  const units = unitsTaken(stock, card.remaining);
  const needs = needsMore(card.remaining, words);
  const full = card.remaining === 0;
  const belowMinimum = units > 0 && units < card.minQty;

  const details = [
    whenLabel(new Date(card.windowStart), new Date(card.windowEnd), new Date()),
    card.km === null ? null : distanceWord(card.km),
    card.collects ? "they come to your farm" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  async function sell(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (example) {
      setMessage("This is only an example. Real buyers will appear here.");
      return;
    }
    if (!user) return;
    setSaving(true);
    const response = await apiFetch(user, `/api/money/slots/${card.slotId}/book`, { qty: Number(qty) }).catch(() => null);
    const result = (await response?.json().catch(() => null)) as { ok?: boolean; code?: string } | null;
    setSaving(false);
    if (result?.ok) {
      setSelling(false);
      onSold();
      return;
    }
    setMessage(FAILURES[result?.code ?? ""] ?? "That didn't work. Please try again.");
  }

  return (
    <li
      data-crate={card.listingId}
      className={cn(
        "relative flex flex-col rounded-[14px] border bg-market-card",
        selected ? "border-market-ink" : "border-market-card-line",
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        disabled={full}
        onClick={onToggle}
        className="flex flex-1 cursor-pointer flex-col rounded-[14px] p-4 text-left focus-visible:ring-3 focus-visible:ring-market-ink/40 focus-visible:outline-none disabled:cursor-default"
      >
        <PriceTag card={card} />
        {/* The right padding keeps the tag off the name, however long the name is. */}
        <span className="block pr-[112px] text-base leading-6 font-medium text-market-ink">{card.buyer}</span>
        <span className="mt-1 block pr-[60px] text-body-sm text-market-muted">{details}</span>
        {card.km !== null && <Road km={card.km} area={card.area} />}

        <span className="market-crate mt-4 block rounded-lg p-2.5">
          {full ? (
            <span className="block py-3 text-center text-body-sm font-medium text-market-ink">Full for this day</span>
          ) : (
            <span
              role="img"
              aria-label={needs}
              className={cn("grid gap-1.5", shape === "basket" ? "grid-cols-6" : "grid-cols-10")}
            >
              {Array.from({ length: shown }, (_, index) => (
                <span key={index} data-slot className={cn("block bg-market-slot", SLOT_SHAPES[shape])} />
              ))}
            </span>
          )}
          {card.remaining > MAX_SLOTS && (
            <span className="font-num mt-2 block text-right text-xs font-medium text-market-ink">
              +{card.remaining - MAX_SLOTS} more
            </span>
          )}
        </span>

        <span className="mt-auto flex flex-wrap items-baseline justify-between gap-x-3 pt-3 text-body-sm">
          <span className="font-medium text-market-ink">
            {selected && units > 0 ? takesLabel(units, stock) : full ? "They have enough for this day" : needs}
          </span>
          {!full && !selected && <span className="text-market-muted">Tap to fill this crate</span>}
        </span>
      </button>

      {selected && (
        <div data-crate-result className="mx-4 mb-4 border-t border-dashed border-market-dash pt-3">
          {units === 0 ? (
            <p className="text-body-sm text-market-muted">Add to your flock above to sell to them.</p>
          ) : (
            <>
              <p className="text-body-sm text-market-muted">You take home</p>
              <p aria-live="polite" className="font-num text-2xl leading-8 font-medium text-market-ink">
                {formatKobo(cardTakeHome(card, stock))}
              </p>
              {belowMinimum ? (
                <p className="mt-2 text-body-sm text-market-ink">This buyer needs at least {card.minQty}.</p>
              ) : selling ? (
                <form onSubmit={sell} className="mt-3">
                  <label className="block text-body-sm font-medium text-market-ink">
                    How many {words.many} are you selling?
                    <input
                      required
                      autoFocus
                      type="number"
                      inputMode="numeric"
                      min={card.minQty}
                      max={card.remaining}
                      value={qty}
                      onChange={(event) => setQty(event.target.value)}
                      className="font-num mt-1.5 h-12 w-full rounded-md border border-market-card-line bg-white px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-market-ink/40"
                    />
                  </label>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="min-h-12 rounded-full bg-market-ink px-4 font-medium text-market-card disabled:opacity-60"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelling(false)}
                      className="min-h-12 rounded-full border border-market-ink px-4 font-medium text-market-ink"
                    >
                      Not now
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setQty(String(units));
                    setSelling(true);
                  }}
                  className="mt-3 min-h-12 w-full rounded-full bg-market-ink px-4 font-medium text-market-card focus-visible:ring-3 focus-visible:ring-market-ink/40 focus-visible:outline-none"
                >
                  Sell {units} to {card.buyer}
                </button>
              )}
              {message && (
                <p role="alert" className="mt-2 text-body-sm text-market-ink">
                  {message}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}
