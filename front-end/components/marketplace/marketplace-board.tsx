"use client";

import { Clock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuthUser } from "@/components/auth/use-auth-user";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNaira } from "@/lib/format";
import { cn } from "@/lib/utils";

const BOOKING_SIZE = 10;

type Listing = {
  id: string;
  buyer: string;
  area: string;
  price: number;
  left: number;
  total: number;
  day: string;
};

const PRODUCE: {
  name: string;
  spec: string;
  unit: string;
  unitPlural: string;
  priceUnit: string;
  listings: Listing[];
}[] = [
  {
    name: "Live broilers",
    spec: "Live broilers, 2.5–3.5 kg",
    unit: "bird",
    unitPlural: "birds",
    priceUnit: "kg",
    listings: [
      { id: "caterer-d", buyer: "Caterer D", area: "Angwan Rukuba", price: 3800, left: 40, total: 60, day: "Thu" },
      { id: "hotel-b", buyer: "Hotel B", area: "Rayfield", price: 3650, left: 25, total: 40, day: "Fri" },
      { id: "restaurant-a", buyer: "Restaurant A", area: "Rayfield", price: 3500, left: 50, total: 80, day: "Thu" },
      { id: "school-c", buyer: "School C", area: "Farin Gada", price: 3300, left: 0, total: 30, day: "Fri" },
    ],
  },
  {
    name: "Tomatoes",
    spec: "Fresh tomatoes, firm and ripe",
    unit: "basket",
    unitPlural: "baskets",
    priceUnit: "basket",
    listings: [
      { id: "hotel-f", buyer: "Hotel F", area: "Farin Gada", price: 28000, left: 12, total: 20, day: "Wed" },
      { id: "caterer-g", buyer: "Caterer G", area: "Bukuru", price: 26500, left: 20, total: 30, day: "Thu" },
    ],
  },
  {
    name: "Eggs",
    spec: "Table eggs, medium to large",
    unit: "crate",
    unitPlural: "crates",
    priceUnit: "crate",
    listings: [
      { id: "bakery-h", buyer: "Bakery H", area: "Bukuru", price: 5600, left: 60, total: 80, day: "Tue" },
      { id: "hotel-j", buyer: "Hotel J", area: "Rayfield", price: 5400, left: 35, total: 50, day: "Fri" },
    ],
  },
  {
    name: "Turkey",
    spec: "Live turkey, 6–9 kg",
    unit: "bird",
    unitPlural: "birds",
    priceUnit: "kg",
    listings: [
      { id: "caterer-k", buyer: "Caterer K", area: "Angwan Rukuba", price: 4150, left: 15, total: 25, day: "Sat" },
    ],
  },
];

export function MarketplaceBoard() {
  const router = useRouter();
  const { user, loading } = useAuthUser();
  const [selected, setSelected] = useState(PRODUCE[0].name);
  // How many this visitor has booked per listing. Example only: nothing is saved or sent.
  const [booked, setBooked] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!loading && !user) router.replace("/auth/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <main role="status" aria-label="Loading the marketplace" className="mx-auto w-full max-w-[1200px] flex-1 space-y-4 px-4 py-10 md:px-6 lg:px-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-11 w-full max-w-md" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </main>
    );
  }

  const produce = PRODUCE.find((item) => item.name === selected) ?? PRODUCE[0];
  const remaining = (listing: Listing) => listing.left - (booked[listing.id] ?? 0);
  const openPrices = produce.listings.filter((l) => remaining(l) > 0).map((l) => l.price);
  const highestBid = openPrices.length > 0 ? Math.max(...openPrices) : null;

  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-4 px-4 md:px-6 lg:px-8">
          <Link
            href="/"
            className="vt-logo inline-flex min-h-10 items-center gap-2 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Image src="/brand/lumora-mark.png" alt="" width={1024} height={945} preload className="h-6 w-auto md:h-7" />
            <span className="font-display text-xl font-medium">lumora</span>
          </Link>
          <Link
            href="/account"
            className="inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium transition-colors duration-200 ease-out hover:bg-sage-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Account
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 md:px-6 md:py-10 lg:px-8">
        <h1 className="text-title font-semibold">Buyers near you</h1>
        <p className="mt-1 text-ink-muted">
          Example board. Real buyers and bookings are coming soon, so nothing here is saved or sent.
        </p>

        {!user.emailVerified && (
          <p className="mt-4 flex flex-wrap items-center gap-x-2 text-body-sm">
            <Clock aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0" />
            Check your inbox to confirm your email.
            <Link
              href="/account"
              className="inline-flex min-h-10 items-center rounded-sm font-medium text-green underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              Resend the link
            </Link>
          </p>
        )}

        <div role="group" aria-label="Produce" className="mt-6 flex flex-wrap gap-2">
          {PRODUCE.map((item) => (
            <Button
              key={item.name}
              variant={item.name === produce.name ? "default" : "secondary"}
              aria-pressed={item.name === produce.name}
              onClick={() => setSelected(item.name)}
            >
              {item.name}
            </Button>
          ))}
        </div>

        <ul className="mt-6 overflow-hidden rounded-xl border border-line bg-card">
          {produce.listings.map((listing) => {
            const left = remaining(listing);
            const isFull = left === 0;
            const isHighest = listing.price === highestBid;
            const bookedCount = booked[listing.id] ?? 0;
            const quantity = Math.min(BOOKING_SIZE, left);

            return (
              <li key={listing.id} className="border-b border-line last:border-b-0">
                <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 p-4 md:grid-cols-[minmax(0,2fr)_auto_minmax(7rem,auto)_auto] md:gap-x-6 md:px-5">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {listing.buyer} <span className="font-normal text-ink-muted">· {listing.area}</span>
                    </p>
                    <p className="text-body-sm text-ink-muted">{produce.spec}</p>
                  </div>

                  <p
                    className={cn(
                      "font-num justify-self-end rounded-sm px-2 text-number font-medium",
                      isHighest && "bg-amber-soft text-amber",
                      isFull && "text-ink-muted",
                    )}
                  >
                    {formatNaira(listing.price, produce.priceUnit)}
                  </p>

                  <p className="text-body-sm text-ink-muted md:text-right">
                    <span className={cn("font-num text-number", !isFull && "text-ink")}>
                      {isFull ? "Full" : `${left} left`}
                    </span>{" "}
                    · {listing.day}
                  </p>

                  {bookedCount > 0 ? (
                    <p className="flex min-h-11 items-center justify-end gap-1.5 font-medium md:min-h-10 md:min-w-[6.5rem]">
                      <Clock aria-hidden="true" strokeWidth={1.5} className="size-4" />
                      Booked <span className="font-num text-number">{bookedCount}</span>
                    </p>
                  ) : (
                    <Button
                      variant="secondary"
                      disabled={isFull}
                      onClick={() => setBooked((current) => ({ ...current, [listing.id]: quantity }))}
                      aria-label={
                        isFull
                          ? `${listing.buyer} is full`
                          : `Book ${quantity} ${quantity === 1 ? produce.unit : produce.unitPlural} with ${listing.buyer}`
                      }
                      className="justify-self-end md:min-w-[6.5rem]"
                    >
                      Book slot
                    </Button>
                  )}
                </div>

                <div aria-hidden="true" className="h-1 bg-sage-soft">
                  <div
                    className="h-full rounded-r-[2px] bg-green transition-[width] duration-400 ease-out motion-reduce:transition-none"
                    style={{ width: `${(left / listing.total) * 100}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
