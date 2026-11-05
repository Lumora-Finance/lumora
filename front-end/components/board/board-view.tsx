"use client";

import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuthUser } from "@/components/auth/use-auth-user";
import { Button } from "@/components/ui/button";
import { type BoardCard, type BoardSort } from "@/lib/logistics/board";
import {
  COLLECTS_LABEL, distanceLabel, FULL_LABEL, needsLabel, priceUnitLabel, SELL_LABEL, whenLabel,
} from "@/lib/logistics/board-copy";
import { apiFetch } from "@/lib/logistics/client";
import { formatKobo } from "@/lib/money/rules";
import { cn } from "@/lib/utils";

const inDays = (days: number, hour: number) => {
  const date = new Date(Date.now() + days * 86_400_000);
  date.setUTCHours(hour - 1, 0, 0, 0); // Lagos is UTC+1.
  return date.toISOString();
};

/** Shown only when the live board can't be reached, and labelled as an example. */
const exampleCards = (): BoardCard[] => [
  { listingId: "e1", slotId: "e1", buyer: "Caterer D", area: "Angwan Rukuba", km: 9, priceKobo: 380_000, priceUnit: "kg", remaining: 40, minQty: 5, windowStart: inDays(2, 7), windowEnd: inDays(2, 11), collects: false, plainName: "chicken", plainPlural: "chickens", spec: null },
  { listingId: "e2", slotId: "e2", buyer: "Rayfield Restaurant", area: "Rayfield", km: 3, priceKobo: 350_000, priceUnit: "kg", remaining: 12, minQty: 1, windowStart: inDays(1, 7), windowEnd: inDays(1, 11), collects: true, plainName: "chicken", plainPlural: "chickens", spec: null },
  { listingId: "e3", slotId: "e3", buyer: "Hotel B", area: "Barkin Ladi", km: 22, priceKobo: 2_800_000, priceUnit: "basket", remaining: 0, minQty: 1, windowStart: inDays(3, 13), windowEnd: inDays(3, 16), collects: false, plainName: "basket of tomatoes", plainPlural: "baskets of tomatoes", spec: null },
];

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

function Card({
  card,
  example,
  onSold,
}: {
  card: BoardCard;
  example: boolean;
  onSold: () => void;
}) {
  const { user } = useAuthUser();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const full = card.remaining === 0;

  async function sell(event: React.FormEvent) {
    event.preventDefault();
    if (example) {
      setMessage("This is only an example. Real buyers will appear here.");
      return;
    }
    if (!user) return;
    setSaving(true);
    setMessage(null);
    const response = await apiFetch(user, `/api/money/slots/${card.slotId}/book`, { qty: Number(qty) }).catch(() => null);
    const result = (await response?.json().catch(() => null)) as { ok?: boolean; code?: string; remaining?: number } | null;
    setSaving(false);
    if (result?.ok) {
      setOpen(false);
      onSold();
      return;
    }
    setMessage(FAILURES[result?.code ?? ""] ?? "That didn't work. Please try again.");
  }

  return (
    <li className="rounded-xl border border-line bg-white p-5">
      <h2 className="text-heading font-semibold text-ink">
        {card.buyer}, {card.area}
      </h2>
      {card.km !== null && (
        <p className="mt-1 flex items-center gap-1.5 text-ink-muted">
          <MapPin aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0" />
          {distanceLabel(card.km)}
        </p>
      )}
      <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
        <span className="font-num text-number-lg font-medium text-ink">{formatKobo(card.priceKobo)}</span>
        <span className="text-ink">{priceUnitLabel(card.priceUnit)}</span>
      </p>
      {!full && <p className="mt-2 text-ink">{needsLabel(card.remaining, card.plainName, card.plainPlural)}</p>}
      <p className="mt-1 text-ink">{whenLabel(new Date(card.windowStart), new Date(card.windowEnd), new Date())}</p>
      {card.collects && <p className="mt-1 font-medium text-green">{COLLECTS_LABEL}</p>}

      {open ? (
        <form onSubmit={sell} className="mt-4">
          <label className="block text-body-sm font-medium text-ink">
            How many {card.plainPlural} can you sell?
            <input
              required
              autoFocus
              type="number"
              inputMode="numeric"
              min={card.minQty}
              max={card.remaining}
              value={qty}
              onChange={(event) => setQty(event.target.value)}
              className="font-num mt-1.5 h-12 w-full rounded-md border border-line bg-white px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Button type="submit" className="h-12 text-base" disabled={saving}>
              Confirm
            </Button>
            <Button type="button" variant="outline" className="h-12 text-base" onClick={() => setOpen(false)}>
              Not now
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          disabled={full}
          onClick={() => setOpen(true)}
          className="mt-4 h-12 w-full text-base"
        >
          {full ? FULL_LABEL : SELL_LABEL}
        </Button>
      )}
      {message && (
        <p role="alert" className="mt-3 text-body-sm text-danger">
          {message}
        </p>
      )}
    </li>
  );
}

export function BoardView() {
  const { user, loading } = useAuthUser();
  const [sort, setSort] = useState<BoardSort>("price");
  const [cards, setCards] = useState<BoardCard[] | null>(null);
  const [example, setExample] = useState(false);
  const [version, setVersion] = useState(0);
  const [sold, setSold] = useState(false);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    const showExamples = () => {
      if (cancelled) return;
      setExample(true);
      const examples = exampleCards();
      setCards(sort === "nearest" ? examples.sort((a, b) => (a.km ?? 0) - (b.km ?? 0)) : examples.sort((a, b) => b.priceKobo - a.priceKobo));
    };
    if (!user) {
      showExamples();
      return;
    }
    apiFetch(user, `/api/board?sort=${sort}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Unavailable");
        const data = (await response.json()) as { cards: BoardCard[] };
        if (!cancelled) {
          setExample(false);
          setCards(data.cards);
        }
      })
      .catch(showExamples);
    return () => {
      cancelled = true;
    };
  }, [user, loading, sort, version]);

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 py-8 md:px-6">
      <h1 className="text-title font-semibold text-ink">Buyers near you</h1>
      <p className="mt-1 text-ink-muted">See who is buying before you load up.</p>

      <div role="group" aria-label="Sort" className="mt-5 grid grid-cols-2 gap-2 rounded-lg border border-line bg-white p-1">
        {([["price", "Highest price"], ["nearest", "Nearest"]] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={sort === value}
            onClick={() => setSort(value)}
            className={cn(
              "min-h-12 rounded-md text-base font-medium transition-colors duration-200 ease-out focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              sort === value ? "bg-green text-paper" : "text-ink hover:bg-sage-soft",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {example && <p className="mt-4 text-body-sm text-ink-muted">These are examples, not real buyers.</p>}
      {sold && <p role="status" className="mt-4 font-medium text-green">Done. Your sale is in My Bookings.</p>}

      {cards === null ? (
        <p className="mt-6 text-ink-muted">Finding buyers…</p>
      ) : cards.length === 0 ? (
        <p className="mt-6 text-ink-muted">Nobody is buying near you right now. Check again soon.</p>
      ) : (
        <ul className="mt-5 space-y-4">
          {cards.map((card) => (
            <Card
              key={card.listingId}
              card={card}
              example={example}
              onSold={() => {
                setSold(true);
                setVersion((value) => value + 1);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
