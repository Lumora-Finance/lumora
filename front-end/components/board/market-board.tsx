"use client";

import { Check, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useAuthUser } from "@/components/auth/use-auth-user";
import { Flip, gsap, isReducedMotion, useGSAP } from "@/lib/gsap/effects";
import type { BoardCard, Reliability } from "@/lib/logistics/board";
import { apiFetch } from "@/lib/logistics/client";
import {
  countWord, DEFAULT_FLOCK, MAX_SLOTS, stepStock, unitsTaken, unitWords,
} from "@/lib/logistics/crate";
import { reliabilityWords } from "@/lib/money/booking-view";
import { freeDeliveriesLeft } from "@/lib/pricing";

import { CardsSkeleton } from "@/components/loader/skeletons";
import { LumoraSelect } from "@/components/ui/lumora-select";
import { BuyerRadar } from "./buyer-radar";
import { cardTakeHome, CrateCard } from "./crate-card";
import { Segmented } from "./segmented";

// Static fallback list — replaced by DB data once it loads
const COMMODITIES_FALLBACK = [
  { name: "Live broilers", label: "chickens", unit: "kg", one: "chicken", many: "chickens", flock: true },
  { name: "Live Turkey", label: "turkeys", unit: "kg", one: "turkey", many: "turkeys", flock: true },
  { name: "Tomatoes", label: "tomatoes", unit: "basket", one: "basket of tomatoes", many: "baskets of tomatoes", flock: false },
  { name: "Eggs", label: "eggs", unit: "crate", one: "crate of eggs", many: "crates of eggs", flock: false },
] as const;

type CommodityMeta = {
  name: string;
  label: string;
  unit: string;
  one: string;
  many: string;
  flock: boolean;
};

function makeMeta(name: string, unit: string): CommodityMeta {
  const lower = name.toLowerCase();
  const isPoultry = lower.includes("broiler") || lower.includes("turkey") || lower.includes("fowl") || lower.includes("duck") || lower.includes("geese") || lower.includes("chick");
  const label = name.replace(/^live /i, "").toLowerCase();
  return {
    name,
    label,
    unit,
    one: isPoultry ? label.replace(/s$/, "") : `${unit} of ${label}`,
    many: isPoultry ? label : `${unit}s of ${label}`,
    flock: isPoultry,
  };
}

type Sort = "money" | "nearest";

const inDays = (days: number, hour: number) => {
  const date = new Date(Date.now() + days * 86_400_000);
  date.setUTCHours(hour - 1, 0, 0, 0); // Lagos is UTC+1.
  return date.toISOString();
};

const example = (id: string, buyer: string, area: string, km: number, priceKobo: number, remaining: number, commodity: CommodityMeta, days: number, collects = false, weights = [2.5, 3.5]): BoardCard => ({
  images: [], buyerId: null, listingId: id, slotId: id, buyer, area, km, priceKobo, priceUnit: commodity.unit, remaining, minQty: 1,
  windowStart: inDays(days, 7), windowEnd: inDays(days, 11), collects, plainName: commodity.one, plainPlural: commodity.many, spec: null,
  commodity: commodity.name, minWeightKg: weights[0], maxWeightKg: weights[1], urgent: false, pinned: false,
});

/** Shown only when the live board can't be reached, and labelled as examples. */
const exampleCards = (): BoardCard[] => [
  example("e1", "Caterer D", "Angwan Rukuba", 9, 380_000, 40, COMMODITIES_FALLBACK[0], 2, true),
  example("e2", "Rayfield Restaurant", "Rayfield", 3, 350_000, 12, COMMODITIES_FALLBACK[0], 1),
  example("e3", "Hotel B", "Barkin Ladi", 39, 340_000, 90, COMMODITIES_FALLBACK[0], 3),
  example("e4", "Bukuru Grill", "Bukuru", 1, 360_000, 0, COMMODITIES_FALLBACK[0], 2),
  example("e5", "Caterer D", "Angwan Rukuba", 9, 2_800_000, 14, COMMODITIES_FALLBACK[2], 2, false, [1, 1]),
  example("e6", "Bakery H", "Bukuru", 1, 560_000, 25, COMMODITIES_FALLBACK[3], 1, true, [1, 1]),
];

export function MarketBoard() {
  const { user, loading } = useAuthUser();
  const root = useRef<HTMLDivElement>(null);
  const [cards, setCards] = useState<BoardCard[] | null>(null);
  const [isExample, setIsExample] = useState(false);
  const [area, setArea] = useState("Jos");
  const [commodityName, setCommodityName] = useState<string>(COMMODITIES_FALLBACK[0].name);
  const [commodities, setCommodities] = useState<CommodityMeta[]>([...COMMODITIES_FALLBACK]);
  const [stockByCommodity, setStockByCommodity] = useState<Record<string, number>>({});
  const [follows, setFollows] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>("money");
  const [selected, setSelected] = useState<string | null>(null);
  const [showFull, setShowFull] = useState(false);
  const [sold, setSold] = useState<false | { bookingId?: string }>(false);
  const [reliability, setReliability] = useState<Reliability | null>(null);
  const [freeLeft, setFreeLeft] = useState(0);
  const [version, setVersion] = useState(0);
  const [followMessage, setFollowMessage] = useState<string | null>(null);

  // Fetch all commodities from DB for the dropdown
  useEffect(() => {
    fetch("/api/commodities")
      .then((r) => r.ok ? r.json() : null)
      .then((data: Array<{ label: string; items: Array<{ name: string; unit: string }> }> | null) => {
        if (!Array.isArray(data)) return;
        const flat: CommodityMeta[] = data.flatMap((cat) =>
          cat.items.map((item) => makeMeta(item.name, item.unit)),
        );
        if (flat.length > 0) setCommodities(flat);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
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
          reliability: Reliability; completedDeliveries: number;
        };
        if (cancelled) return;
        setIsExample(false);
        setArea(data.area ?? "Jos");
        setCards(data.cards);
        setStockByCommodity((current) => ({ ...data.stock, ...current }));
        setFollows(data.follows);
        setReliability(data.reliability);
        setFreeLeft(freeDeliveriesLeft(data.completedDeliveries));
      })
      .catch(showExamples);
    return () => {
      cancelled = true;
    };
  }, [user, loading, version]);

  const commodity = commodities.find((item) => item.name === commodityName) ?? commodities[0] ?? COMMODITIES_FALLBACK[0];
  const words = unitWords(commodity.unit, commodity.one, commodity.many);
  const stock = stockByCommodity[commodity.name] ?? DEFAULT_FLOCK;
  const noun = commodity.flock ? "flock" : "stock";

  // Urgent requests sent to this farmer are at the top whichever produce is showing.
  const pinned = (cards ?? []).filter((card) => card.pinned && card.remaining > 0);
  const ordered = (cards ?? [])
    .filter((card) => card.commodity === commodity.name && !pinned.includes(card))
    .sort((a, b) =>
      sort === "nearest"
        ? (a.km ?? Infinity) - (b.km ?? Infinity) || cardTakeHome(b, stock, freeLeft) - cardTakeHome(a, stock, freeLeft)
        : cardTakeHome(b, stock, freeLeft) - cardTakeHome(a, stock, freeLeft) || b.priceKobo - a.priceKobo,
    );
  const open = ordered.filter((card) => card.remaining > 0);
  const full = ordered.filter((card) => card.remaining === 0);

  const chosen = [...pinned, ...open].find((card) => card.listingId === selected) ?? null;
  const going = chosen ? unitsTaken(stock, chosen.remaining) : 0;

  // Your flock fills their crate. Reverted on each change, so a new choice starts clean.
  useGSAP(
    () => {
      const scope = root.current;
      if (!scope || !chosen) return;
      const crate = scope.querySelector(`[data-crate="${chosen.listingId}"]`);
      if (!crate) return;
      const slots = gsap.utils.toArray<HTMLElement>("[data-slot]", crate).slice(0, Math.min(unitsTaken(stock, chosen.remaining), MAX_SLOTS));
      const filled = "#C08A2E";
      if (isReducedMotion()) {
        gsap.set(slots, { backgroundColor: filled });
        return;
      }
      const step = Math.min(0.03, 0.6 / Math.max(slots.length, 1));
      const timeline = gsap.timeline();
      slots.forEach((slot, index) => {
        timeline
          .set(slot, { backgroundColor: filled }, index * step)
          .fromTo(slot, { scale: 0.4 }, { scale: 1, duration: 0.35, ease: "back.out(2.6)" }, index * step);
      });
    },
    { scope: root, dependencies: [chosen?.listingId, stock], revertOnUpdate: true },
  );

  // Switching produce: the title rises, and the buyers sweep in from the side you're moving towards.
  const tabDirection = useRef(1);
  useGSAP(
    () => {
      const scope = root.current;
      if (!scope || cards === null || isReducedMotion()) return;
      const items = scope.querySelectorAll("[data-list] [data-card], section:not([aria-label])");
      gsap.fromTo(scope.querySelector("[data-title]"), { yPercent: 110 }, { yPercent: 0, duration: 0.7, ease: "expo.out", clearProps: "transform" });
      gsap.fromTo(items, { opacity: 0, x: 36 * tabDirection.current }, { opacity: 1, x: 0, duration: 0.65, ease: "expo.out", stagger: 0.05, clearProps: "transform,opacity" });
    },
    { scope: root, dependencies: [commodityName, cards === null] },
  );

  function changeCommodity(name: string) {
    const from = commodities.findIndex((item) => item.name === commodityName);
    const to = commodities.findIndex((item) => item.name === name);
    tabDirection.current = to >= from ? 1 : -1;
    setCommodityName(name);
    setSelected(null);
    setShowFull(false);
    setSold(false);
    setFollowMessage(null);
  }

  // Re-sorting: every card glides to its new place instead of jumping there.
  const flipFrom = useRef<ReturnType<typeof Flip.getState> | null>(null);
  function changeSort(next: Sort) {
    if (!isReducedMotion() && root.current) {
      flipFrom.current = Flip.getState(root.current.querySelectorAll("[data-list] [data-card]"));
    }
    setSort(next);
  }
  useLayoutEffect(() => {
    if (!flipFrom.current) return;
    const animation = Flip.from(flipFrom.current, { duration: 0.6, ease: "expo.inOut", stagger: 0.02 });
    flipFrom.current = null;
    return () => {
      animation.progress(1).kill();
    };
  }, [sort]);

  // The number steps up or down with the tap.
  const lastStock = useRef(stock);
  useGSAP(
    () => {
      const direction = Math.sign(stock - lastStock.current);
      lastStock.current = stock;
      if (!direction || isReducedMotion()) return;
      gsap.fromTo(root.current?.querySelector("[data-stock]") ?? null, { yPercent: 45 * direction, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: "expo.out", clearProps: "transform,opacity", overwrite: true });
    },
    { scope: root, dependencies: [stock] },
  );

  // Saved so backup requests can find this farmer. A quick run of taps saves once.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function changeStock(direction: 1 | -1) {
    const qty = stepStock(stock, direction);
    setStockByCommodity((current) => ({ ...current, [commodity.name]: qty }));
    if (!user || isExample) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void apiFetch(user, "/api/board/stock", { commodity: commodity.name, qty }).catch(() => null);
    }, 800);
  }

  async function follow() {
    setFollowMessage(null);
    if (!user || isExample) {
      setFollowMessage("Sign in to follow, and we'll email you.");
      return;
    }
    const response = await apiFetch(user, "/api/board/follow", { commodity: commodity.name }).catch(() => null);
    if (response?.ok) setFollows((current) => [...current, commodity.name]);
    else setFollowMessage("That didn't save. Please try again.");
  }

  const crateProps = (card: BoardCard) => ({
    card,
    stock,
    freeLeft,
    example: isExample,
    user,
    selected: card.listingId === selected,
    onToggle: () => {
      setSold(false);
      setSelected((current) => (current === card.listingId ? null : card.listingId));
    },
    onSold: (bookingId?: string) => {
      setSold({ bookingId });
      setSelected(null);
      setVersion((value) => value + 1);
    },
  });

  const label = commodity.label;
  const others = commodities.filter((item) => item.name !== commodity.name)
    .map((item) => ({ ...item, count: (cards ?? []).filter((card) => card.commodity === item.name && card.remaining > 0).length }))
    .filter((item) => item.count > 0);
  const goingShare = stock > 0 ? (going / stock) * 100 : 0;
  const stockName = commodity.flock ? "My flock" : "My stock";
  const stockWords = countWord(stock, words).replace(/^\d+ /, "");

  return (
    <div ref={root} className="mx-auto w-full max-w-[1120px] px-4 py-5 text-ink md:px-6 lg:px-8 lg:py-7">
      <header>
        <p className="text-body-sm text-ink-muted">{area} market board</p>
        <h1 className="mt-1 overflow-hidden pb-1 font-display text-[26px] leading-[1.2] font-medium sm:text-[32px]">
          <span data-title className="block">Who wants your {label}?</span>
        </h1>
      </header>

      <div className="mt-4 max-w-[520px]">
        <LumoraSelect
          value={commodityName}
          onChange={changeCommodity}
          placeholder="Choose a commodity…"
          options={commodities.map((item) => {
            const count = (cards ?? []).filter((card) => card.commodity === item.name && card.remaining > 0).length;
            return {
              value: item.name,
              label: item.name,
              hint: count > 0 ? `${count} buyer${count !== 1 ? "s" : ""} available` : undefined,
            };
          })}
        />
      </div>

      {sold && (
        <p role="status" className="mt-4 rounded-2xl bg-sage-soft px-4 py-3 font-medium text-ink">
          Done.{" "}
          <Link href={sold.bookingId ? `/dashboard/bookings/${sold.bookingId}` : "/dashboard/bookings"} className="underline underline-offset-4">
            See your booking
          </Link>
        </p>
      )}

      <div className="mt-4 grid items-start gap-4 lg:mt-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-5">
        <aside aria-label={stockName} className="rounded-[20px] bg-field p-5 text-paper lg:sticky lg:top-6">
          <p className="font-num text-[11px] leading-4 tracking-[0.08em] text-sage uppercase">{stockName}</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label={`Take 5 off your ${noun}`}
              disabled={stock === 0}
              onClick={() => changeStock(-1)}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-paper/10 transition-[background-color,transform] duration-150 [-webkit-tap-highlight-color:transparent] hover:bg-paper/20 focus-visible:ring-3 focus-visible:ring-sage focus-visible:outline-none active:scale-90 disabled:opacity-40 motion-reduce:active:scale-100"
            >
              <Minus aria-hidden="true" strokeWidth={1.75} className="size-4" />
            </button>
            <span className="min-w-0 overflow-hidden text-center">
              <span data-stock aria-live="polite" className="block font-num text-[44px] leading-[1.1] font-medium">
                {stock}
              </span>
            </span>
            <button
              type="button"
              aria-label={`Add 5 to your ${noun}`}
              onClick={() => changeStock(1)}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-paper/10 transition-[background-color,transform] duration-150 [-webkit-tap-highlight-color:transparent] hover:bg-paper/20 focus-visible:ring-3 focus-visible:ring-sage focus-visible:outline-none active:scale-90 motion-reduce:active:scale-100"
            >
              <Plus aria-hidden="true" strokeWidth={1.75} className="size-4" />
            </button>
          </div>
          <p className="text-center text-body-sm text-paper/70">{stockWords} ready to sell</p>

          {/* How much of what you have is going to the buyer you've picked. */}
          <div aria-hidden="true" className="mt-4 h-1.5 overflow-hidden rounded-full bg-paper/15">
            <div
              className="h-full origin-left rounded-full bg-amber transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
              style={{ transform: `scaleX(${goingShare / 100})` }}
            />
          </div>
          <p aria-live="polite" className="mt-2 text-xs text-paper/70">
            {chosen && going > 0 ? `${going} going, ${stock - going} left at home` : "Pick a buyer to see what goes"}
          </p>

          {((reliability && reliability.total > 0) || (!isExample && freeLeft > 0)) && (
            <div className="mt-4 space-y-1 border-t border-paper/15 pt-3 text-xs text-paper/70">
              {reliability && reliability.total > 0 && <p>Your record: {reliabilityWords(reliability)}</p>}
              {!isExample && freeLeft > 0 && <p>No Lumora fee on your next {freeLeft === 1 ? "delivery" : `${freeLeft} deliveries`}</p>}
            </div>
          )}
        </aside>

        <div className="min-w-0">
          {pinned.length > 0 && (
            <section aria-label="Urgent" className="mb-5">
              <h2 className="font-medium text-ink">They need this today</h2>
              <ul className="mt-3 grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
                {pinned.map((card) => (
                  <CrateCard key={card.listingId} {...crateProps(card)} />
                ))}
              </ul>
            </section>
          )}

          {cards === null ? (
            <CardsSkeleton cards={4} label="Finding buyers" className="xl:grid-cols-2" />
          ) : open.length === 0 ? (
            <section className="rounded-[20px] border border-line bg-white px-5 py-8 text-center sm:py-10">
              <BuyerRadar area={area} />
              <h2 className="mt-5 font-display text-[22px] leading-[1.25] font-medium text-balance">
                No buyers want {label} near {area} yet
              </h2>
              <p className="mx-auto mt-1.5 max-w-[26rem] text-body-sm text-ink-muted">
                We&apos;re watching. We&apos;ll email you the moment one posts.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                {follows.includes(commodity.name) ? (
                  <p role="status" className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl bg-sage-soft px-4 text-body-sm font-medium text-green">
                    <Check aria-hidden="true" strokeWidth={2.5} className="size-4" />
                    Following {label}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={follow}
                    className="min-h-11 rounded-2xl bg-green px-5 font-medium text-paper transition-[background-color,transform] duration-150 hover:bg-green-hover focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98] motion-reduce:active:scale-100"
                  >
                    Tell me about {label}
                  </button>
                )}
                {others.slice(0, 2).map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => changeCommodity(item.name)}
                    className="min-h-11 rounded-2xl border border-line px-4 text-body-sm font-medium text-ink transition-colors duration-150 hover:border-sage focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {item.count} {item.count === 1 ? "buyer wants" : "buyers want"} {item.label}
                  </button>
                ))}
              </div>
              {followMessage && (
                <p role="status" className="mt-3 text-body-sm text-ink-muted">
                  {followMessage}{" "}
                  {!user && (
                    <Link href="/auth/login" className="underline underline-offset-4">
                      Sign in
                    </Link>
                  )}
                </p>
              )}
            </section>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Commodity picker — also shown here so switching produce is fast from the list */}
                  <div className="w-[200px] shrink-0 sm:w-[220px]">
                    <LumoraSelect
                      value={commodityName}
                      onChange={changeCommodity}
                      placeholder="Choose a commodity…"
                      options={commodities.map((item) => {
                        const count = (cards ?? []).filter((card) => card.commodity === item.name && card.remaining > 0).length;
                        return {
                          value: item.name,
                          label: item.name,
                          hint: count > 0 ? `${count} buyer${count !== 1 ? "s" : ""} available` : undefined,
                        };
                      })}
                    />
                  </div>
                  <h2 className="font-medium text-ink">
                    <span className="font-num">{open.length}</span> {open.length === 1 ? "buyer" : "buyers"} near you
                  </h2>
                </div>
                <Segmented
                  label="Sort"
                  className="w-[220px]"
                  value={sort}
                  onChange={changeSort}
                  options={[{ value: "money", label: "Most money" }, { value: "nearest", label: "Nearest" }]}
                />
              </div>
              <ul data-list className="mt-3 grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
                {open.map((card) => (
                  <CrateCard key={card.listingId} {...crateProps(card)} />
                ))}
              </ul>
            </>
          )}

          {full.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                aria-expanded={showFull}
                onClick={() => setShowFull((value) => !value)}
                className="min-h-11 text-body-sm text-ink-muted underline underline-offset-4 hover:text-ink"
              >
                {showFull ? "Hide full buyers" : `Show ${full.length} full ${full.length === 1 ? "buyer" : "buyers"}`}
              </button>
              {showFull && (
                <ul className="mt-3 grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
                  {full.map((card) => (
                    <CrateCard key={card.listingId} {...crateProps(card)} />
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-5 space-y-1 text-xs leading-5 text-ink-muted">
            {isExample && <p>These are examples, not real buyers.</p>}
            <p>Take-home is an estimate from the average weight. You&apos;re paid on the real weight at delivery.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
