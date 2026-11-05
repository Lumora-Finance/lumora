"use client";

import { Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useAuthUser } from "@/components/auth/use-auth-user";
import { gsap, isReducedMotion, useGSAP } from "@/lib/gsap/effects";
import type { BoardCard } from "@/lib/logistics/board";
import { apiFetch } from "@/lib/logistics/client";
import {
  countWord, DEFAULT_FLOCK, MAX_FLOCK_TOKENS, MAX_SLOTS, stepStock, unitsTaken, unitWords,
} from "@/lib/logistics/crate";
import { cn } from "@/lib/utils";

import { cardTakeHome, CrateCard } from "./crate-card";

const COMMODITIES = [
  { name: "Live broilers", label: "chickens", unit: "kg", one: "chicken", many: "chickens", flock: true },
  { name: "Turkey", label: "turkeys", unit: "kg", one: "turkey", many: "turkeys", flock: true },
  { name: "Tomatoes", label: "tomatoes", unit: "basket", one: "basket of tomatoes", many: "baskets of tomatoes", flock: false },
  { name: "Eggs", label: "eggs", unit: "crate", one: "crate of eggs", many: "crates of eggs", flock: false },
] as const;

type Sort = "money" | "nearest";

const inDays = (days: number, hour: number) => {
  const date = new Date(Date.now() + days * 86_400_000);
  date.setUTCHours(hour - 1, 0, 0, 0); // Lagos is UTC+1.
  return date.toISOString();
};

const example = (id: string, buyer: string, area: string, km: number, priceKobo: number, remaining: number, commodity: (typeof COMMODITIES)[number], days: number, collects = false, weights = [2.5, 3.5]): BoardCard => ({
  listingId: id, slotId: id, buyer, area, km, priceKobo, priceUnit: commodity.unit, remaining, minQty: 1,
  windowStart: inDays(days, 7), windowEnd: inDays(days, 11), collects, plainName: commodity.one, plainPlural: commodity.many, spec: null,
  commodity: commodity.name, minWeightKg: weights[0], maxWeightKg: weights[1],
});

/** Shown only when the live board can't be reached, and labelled as examples. */
const exampleCards = (): BoardCard[] => [
  example("e1", "Caterer D", "Angwan Rukuba", 9, 380_000, 40, COMMODITIES[0], 2, true),
  example("e2", "Rayfield Restaurant", "Rayfield", 3, 350_000, 12, COMMODITIES[0], 1),
  example("e3", "Hotel B", "Barkin Ladi", 39, 340_000, 90, COMMODITIES[0], 3),
  example("e4", "Bukuru Grill", "Bukuru", 1, 360_000, 0, COMMODITIES[0], 2),
  example("e5", "Caterer D", "Angwan Rukuba", 9, 2_800_000, 14, COMMODITIES[2], 2, false, [1, 1]),
  example("e6", "Bakery H", "Bukuru", 1, 560_000, 25, COMMODITIES[3], 1, true, [1, 1]),
];

function EmptyCrate() {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 70" className="mx-auto w-28">
      <rect x="4" y="10" width="112" height="56" rx="6" className="fill-market-wood" />
      <rect x="4" y="24" width="112" height="2" className="fill-market-slat" />
      <rect x="4" y="38" width="112" height="2" className="fill-market-slat" />
      <rect x="4" y="52" width="112" height="2" className="fill-market-slat" />
      <rect x="14" y="4" width="92" height="10" rx="3" className="fill-market-slot" />
    </svg>
  );
}

export function MarketBoard() {
  const { user, loading } = useAuthUser();
  const root = useRef<HTMLDivElement>(null);
  const [cards, setCards] = useState<BoardCard[] | null>(null);
  const [isExample, setIsExample] = useState(false);
  const [area, setArea] = useState("Jos");
  const [commodityName, setCommodityName] = useState<string>(COMMODITIES[0].name);
  const [stockByCommodity, setStockByCommodity] = useState<Record<string, number>>({});
  const [follows, setFollows] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>("money");
  const [selected, setSelected] = useState<string | null>(null);
  const [showFull, setShowFull] = useState(false);
  const [sold, setSold] = useState(false);
  const [version, setVersion] = useState(0);
  const [followMessage, setFollowMessage] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    const showExamples = () => {
      if (cancelled) return;
      setIsExample(true);
      setArea("Bukuru");
      setCards(exampleCards());
    };
    if (!user) {
      showExamples();
      return;
    }
    apiFetch(user, "/api/board")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unavailable");
        const data = (await response.json()) as {
          area: string | null; cards: BoardCard[]; stock: Record<string, number>; follows: string[];
        };
        if (cancelled) return;
        setIsExample(false);
        setArea(data.area ?? "Jos");
        setCards(data.cards);
        setStockByCommodity((current) => ({ ...data.stock, ...current }));
        setFollows(data.follows);
      })
      .catch(showExamples);
    return () => {
      cancelled = true;
    };
  }, [user, loading, version]);

  const commodity = COMMODITIES.find((item) => item.name === commodityName) ?? COMMODITIES[0];
  const words = unitWords(commodity.unit, commodity.one, commodity.many);
  const stock = stockByCommodity[commodity.name] ?? DEFAULT_FLOCK;
  const noun = commodity.flock ? "flock" : "stock";

  const ordered = (cards ?? [])
    .filter((card) => card.commodity === commodity.name)
    .sort((a, b) =>
      sort === "nearest"
        ? (a.km ?? Infinity) - (b.km ?? Infinity) || cardTakeHome(b, stock) - cardTakeHome(a, stock)
        : cardTakeHome(b, stock) - cardTakeHome(a, stock) || b.priceKobo - a.priceKobo,
    );
  const open = ordered.filter((card) => card.remaining > 0);
  const full = ordered.filter((card) => card.remaining === 0);

  const chosen = open.find((card) => card.listingId === selected) ?? null;
  const going = chosen ? unitsTaken(stock, chosen.remaining) : 0;
  const tokens = Math.min(stock, MAX_FLOCK_TOKENS);

  // Chickens leave the flock and fill the crate. Reverted on each change, so a new choice starts clean.
  useGSAP(
    () => {
      const scope = root.current;
      if (!scope || !chosen) return;
      const crate = scope.querySelector(`[data-crate="${chosen.listingId}"]`);
      if (!crate) return;

      const count = unitsTaken(stock, chosen.remaining);
      const slots = gsap.utils.toArray<HTMLElement>("[data-slot]", crate).slice(0, Math.min(count, MAX_SLOTS));
      const birds = gsap.utils.toArray<HTMLElement>("[data-flock-token]", scope).slice(0, Math.min(count, MAX_FLOCK_TOKENS));
      const result = crate.querySelector("[data-crate-result]");
      const maize = "#F2C14E";

      if (isReducedMotion()) {
        gsap.set(slots, { backgroundColor: maize });
        gsap.set(birds, { opacity: 0.18 });
        return;
      }

      const step = 0.04;
      const timeline = gsap.timeline();
      slots.forEach((slot, index) => {
        timeline
          .set(slot, { backgroundColor: maize }, index * step)
          .fromTo(slot, { scale: 1.08 }, { scale: 1, duration: 0.18, ease: "power1.out" }, index * step);
      });
      birds.forEach((bird, index) => {
        timeline.to(bird, { opacity: 0.18, duration: 0.15, ease: "none" }, index * step);
      });
      if (result) {
        // Never makes someone wait long for the price and the button, even on a big crate.
        timeline.fromTo(result, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.25, ease: "power2.out" }, Math.min(slots.length * step, 0.9));
      }
    },
    { scope: root, dependencies: [chosen?.listingId, stock], revertOnUpdate: true },
  );

  function changeStock(direction: 1 | -1) {
    setStockByCommodity((current) => ({ ...current, [commodity.name]: stepStock(stock, direction) }));
  }

  async function follow() {
    setFollowMessage(null);
    if (!user || isExample) {
      setFollowMessage("Sign in to follow, and we'll text you.");
      return;
    }
    const response = await apiFetch(user, "/api/board/follow", { commodity: commodity.name }).catch(() => null);
    if (response?.ok) setFollows((current) => [...current, commodity.name]);
    else setFollowMessage("That didn't save. Please try again.");
  }

  const crateProps = (card: BoardCard) => ({
    card,
    stock,
    example: isExample,
    user,
    selected: card.listingId === selected,
    onToggle: () => {
      setSold(false);
      setSelected((current) => (current === card.listingId ? null : card.listingId));
    },
    onSold: () => {
      setSold(true);
      setSelected(null);
      setVersion((value) => value + 1);
    },
  });

  return (
    <div ref={root} className="market-board min-h-full text-market-ink">
      <div className="mx-auto w-full max-w-[1000px] px-4 py-6 md:px-6 md:py-8">
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="text-body-sm text-market-muted">
              {area} market board · {commodity.label}
            </p>
            <h1 className="mt-1 font-display text-[28px] leading-[1.2] font-medium">Who wants your {commodity.label} today?</h1>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-market-card-line bg-market-card p-1 pl-4">
            <span className="text-body-sm font-medium whitespace-nowrap">My {noun}</span>
            <button
              type="button"
              aria-label={`Take 5 off your ${noun}`}
              disabled={stock === 0}
              onClick={() => changeStock(-1)}
              className="ml-1 flex size-12 items-center justify-center rounded-full hover:bg-market-board disabled:opacity-40 lg:size-9"
            >
              <Minus aria-hidden="true" strokeWidth={1.5} className="size-4" />
            </button>
            <span aria-live="polite" className="font-num w-8 text-center font-medium">
              {stock}
            </span>
            <button
              type="button"
              aria-label={`Add 5 to your ${noun}`}
              onClick={() => changeStock(1)}
              className="flex size-12 items-center justify-center rounded-full hover:bg-market-board lg:size-9"
            >
              <Plus aria-hidden="true" strokeWidth={1.5} className="size-4" />
            </button>
          </div>
        </header>

        <div className="mt-3 flex flex-wrap gap-x-1">
          {COMMODITIES.map((item) => (
            <button
              key={item.name}
              type="button"
              aria-pressed={item.name === commodity.name}
              onClick={() => {
                setCommodityName(item.name);
                setSelected(null);
                setShowFull(false);
                setSold(false);
                setFollowMessage(null);
              }}
              className={cn(
                "min-h-12 rounded-full px-3 text-body-sm capitalize lg:min-h-9",
                item.name === commodity.name ? "bg-market-ink text-market-card" : "text-market-muted hover:text-market-ink",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <p className="text-body-sm text-market-muted">your {noun}</p>
          <div aria-hidden="true" className="mt-1.5 flex flex-wrap items-center gap-1">
            {Array.from({ length: tokens }, (_, index) => (
              <span key={index} data-flock-token className="h-2.5 w-3 rounded-full bg-market-maize" />
            ))}
            {stock > MAX_FLOCK_TOKENS && <span className="font-num ml-1 text-xs">+{stock - MAX_FLOCK_TOKENS}</span>}
          </div>
          <p aria-live="polite" className="mt-1.5 text-body-sm text-market-muted">
            {chosen && going > 0
              ? `${going} going, ${stock - going} left at home`
              : `${countWord(stock, words)} ready to sell`}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 border-t border-dashed border-market-dash pt-1">
          <p className="py-2 text-body-sm text-market-muted">
            Sort:{" "}
            {([["money", "most money"], ["nearest", "nearest"]] as const).map(([value, label], index) => (
              <span key={value}>
                {index > 0 && " / "}
                <button
                  type="button"
                  aria-pressed={sort === value}
                  onClick={() => setSort(value)}
                  className={cn(
                    "inline-flex min-h-12 items-center underline-offset-4 lg:min-h-0",
                    sort === value ? "font-medium text-market-ink underline" : "hover:text-market-ink",
                  )}
                >
                  {label}
                </button>
              </span>
            ))}
          </p>
        </div>

        {sold && (
          <p role="status" className="mt-2 font-medium">
            Done. Your sale is in My Bookings.
          </p>
        )}

        {cards === null ? (
          <p className="mt-6 text-market-muted">Finding buyers…</p>
        ) : open.length === 0 ? (
          <div className="mt-8 text-center">
            <EmptyCrate />
            <p className="mx-auto mt-4 max-w-[26rem]">
              No buyers want {commodity.label} near you today. We&apos;ll text you when one posts.
            </p>
            {follows.includes(commodity.name) ? (
              <p role="status" className="mt-4 font-medium">
                You&apos;re following {commodity.label}.
              </p>
            ) : (
              <button
                type="button"
                onClick={follow}
                className="mt-4 min-h-12 rounded-full bg-market-ink px-6 font-medium text-market-card"
              >
                Follow {commodity.label}
              </button>
            )}
            {followMessage && (
              <p role="status" className="mt-2 text-body-sm">
                {followMessage}{" "}
                {!user && (
                  <Link href="/auth/login" className="underline underline-offset-4">
                    Sign in
                  </Link>
                )}
              </p>
            )}
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {open.map((card) => (
              <CrateCard key={card.listingId} {...crateProps(card)} />
            ))}
          </ul>
        )}

        {full.length > 0 && (
          <div className="mt-4">
            <button
              type="button"
              aria-expanded={showFull}
              onClick={() => setShowFull((value) => !value)}
              className="min-h-12 text-body-sm text-market-muted underline underline-offset-4 hover:text-market-ink"
            >
              {showFull ? "Hide full crates" : "Show full crates"}
            </button>
            {showFull && (
              <ul className="mt-3 grid gap-4 md:grid-cols-2">
                {full.map((card) => (
                  <CrateCard key={card.listingId} {...crateProps(card)} />
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-6 space-y-1 text-xs leading-5 text-market-muted">
          {isExample && <p>These are examples, not real buyers.</p>}
          <p>Take-home is an estimate from the average weight. You&apos;re paid on the real weight at delivery.</p>
        </div>
      </div>
    </div>
  );
}
