"use client";

import { Clock } from "lucide-react";
import { useState } from "react";
import type { User } from "firebase/auth";

import { BusyBar } from "@/components/loader/busy-bar";
import { clock, pricePer } from "@/lib/email/format";
import { playMoment } from "@/lib/loading/moment";
import type { BoardCard } from "@/lib/logistics/board";
import { whenLabel } from "@/lib/logistics/board-copy";
import { apiFetch } from "@/lib/logistics/client";
import { MAX_SLOTS, needsMore, slotShape, takesLabel, unitsTaken, unitWords } from "@/lib/logistics/crate";
import { formatKobo } from "@/lib/money/rules";
import { takeHomeKobo } from "@/lib/pricing";
import { cn } from "@/lib/utils";

const SLOT_SHAPES = {
  round: "size-4 rounded-full",
  crate: "h-4 w-5 rounded-[4px]",
  basket: "size-5 rounded-[6px]",
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
  own_backup: "This request is to replace your own delivery, so you can't take it.",
};

export const cardTakeHome = (card: BoardCard, stock: number, freeLeft = 0) =>
  takeHomeKobo({
    units: unitsTaken(stock, card.remaining),
    minWeightKg: card.minWeightKg,
    maxWeightKg: card.maxWeightKg,
    priceKobo: card.priceKobo,
    freeDeliveriesLeft: freeLeft,
  });

/** One buyer. What you'd take home is always showing. Tapping fills their crate and offers the sale. */
export function CrateCard({
  card,
  stock,
  freeLeft,
  selected,
  example,
  user,
  onToggle,
  onSold,
}: {
  card: BoardCard;
  stock: number;
  freeLeft: number;
  selected: boolean;
  example: boolean;
  user: User | null;
  onToggle: () => void;
  onSold: (bookingId?: string) => void;
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

  const when = card.urgent
    ? `Today by ${clock(card.windowEnd)}`
    : whenLabel(new Date(card.windowStart), new Date(card.windowEnd), new Date());
  const place = [card.km === null ? card.area : `${card.area}, ${Math.max(card.km, 1)} km`, card.collects ? "they come to you" : null]
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
    const result = (await response?.json().catch(() => null)) as { ok?: boolean; code?: string; booking_id?: string } | null;
    setSaving(false);
    if (result?.ok) {
      setSelling(false);
      const sold = Number(qty);
      playMoment({
        label: "Booking your sale",
        work: Promise.resolve({
          top: `Booking ${result.code}`,
          line: `Booked: ${sold} ${sold === 1 ? words.one : words.many} for ${card.buyer}`,
          fraction: 1,
          number: sold,
        }),
      });
      onSold(result.booking_id);
      return;
    }
    setMessage(FAILURES[result?.code ?? ""] ?? "That didn't work. Please try again.");
  }

  return (
    <li
      data-card
      data-crate={card.listingId}
      className={cn(
        "rounded-[20px] border bg-white transition-colors duration-200",
        selected ? "border-field" : card.pinned ? "border-amber" : "border-line hover:border-sage",
        full && "opacity-70",
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        disabled={full}
        onClick={onToggle}
        className="block w-full cursor-pointer rounded-[20px] p-4 text-left [-webkit-tap-highlight-color:transparent] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default sm:p-5"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate font-medium text-ink">{card.buyer}</span>
            <span className="mt-0.5 block text-body-sm text-ink-muted">{place}</span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block font-num text-lg leading-6 font-medium text-ink">{pricePer(card.priceKobo, card.priceUnit)}</span>
          </span>
        </span>

        <span className={cn("mt-2 inline-flex items-center gap-1.5 text-xs", card.urgent ? "font-medium text-[#9A6A1A]" : "text-ink-muted")}>
          <Clock aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
          {when}
        </span>

        <span className="mt-3 block rounded-2xl bg-paper p-2.5">
          {full ? (
            <span className="block py-2 text-center text-body-sm text-ink-muted">Full for this day</span>
          ) : (
            <span role="img" aria-label={needs} className="flex flex-wrap gap-1">
              {Array.from({ length: shown }, (_, index) => (
                <span key={index} data-slot className={cn("block bg-sage/35", SLOT_SHAPES[shape])} />
              ))}
            </span>
          )}
          {card.remaining > MAX_SLOTS && (
            <span className="mt-1.5 block text-right font-num text-[11px] text-ink-muted">+{card.remaining - MAX_SLOTS} more</span>
          )}
        </span>

        {!full && (
          <span className="mt-3 flex items-end justify-between gap-3">
            <span className="min-w-0 text-body-sm text-ink-muted">{selected && units > 0 ? takesLabel(units, stock) : needs}</span>
            {units > 0 && (
              <span className="shrink-0 text-right">
                <span className="block text-xs text-ink-muted">You take home</span>
                <span aria-live="polite" className="block font-num text-[20px] leading-7 font-medium text-green">
                  {formatKobo(cardTakeHome(card, stock, freeLeft))}
                </span>
              </span>
            )}
          </span>
        )}
      </button>

      {/* Opens smoothly to whatever height is inside, with no measuring. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
          selected ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden" inert={!selected}>
          <div className="px-4 pb-4 sm:px-5 sm:pb-5">
            {units === 0 ? (
              <p className="text-body-sm text-ink-muted">Add to your flock to sell to them.</p>
            ) : belowMinimum ? (
              <p className="text-body-sm text-ink">This buyer needs at least {card.minQty}.</p>
            ) : selling ? (
              <form onSubmit={sell}>
                <label className="block text-body-sm font-medium text-ink">
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
                    className="mt-1.5 h-[52px] w-full rounded-2xl border border-line bg-white px-4 font-num text-base outline-none focus-visible:border-green focus-visible:ring-3 focus-visible:ring-ring/30"
                  />
                </label>
                <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
                  <button
                    type="button"
                    onClick={() => setSelling(false)}
                    className="h-[52px] rounded-2xl px-5 font-medium text-ink transition-colors duration-150 hover:bg-sage-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    Not now
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    aria-busy={saving}
                    className="relative h-[52px] overflow-hidden rounded-2xl bg-green px-5 font-medium text-paper transition-[background-color,transform] duration-150 hover:bg-green-hover focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98] disabled:opacity-60 motion-reduce:active:scale-100"
                  >
                    Confirm
                    <BusyBar active={saving} />
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
                className="h-[52px] w-full truncate rounded-2xl bg-green px-5 font-medium text-paper transition-[background-color,transform] duration-150 hover:bg-green-hover focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98] motion-reduce:active:scale-100"
              >
                Sell {units} to {card.buyer}
              </button>
            )}
            {message && (
              <p role="alert" className="mt-2 text-body-sm text-danger">
                {message}
              </p>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
