"use client";

import { MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuthUser } from "@/components/auth/use-auth-user";
import { apiFetch } from "@/lib/logistics/client";
import { formatKobo } from "@/lib/money/rules";

type LiveBooking = {
  id: string;
  code: string;
  qty: number;
  status: string;
  is_buyer: boolean;
  arrived: boolean;
  commodity: string;
  unit_price_kobo: number;
  contact: { ok: boolean; name?: string; phone?: string; address?: string | null };
};

/** Real bookings. Phone and address only arrive for someone on the booking. Hidden with none. */
export function LiveBookings() {
  const { user } = useAuthUser();
  const [bookings, setBookings] = useState<LiveBooking[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    apiFetch(user, "/api/bookings")
      .then((response) => (response.ok ? response.json() : []))
      .then((rows: LiveBooking[]) => {
        if (!cancelled) setBookings(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (bookings.length === 0) return null;

  return (
    <section aria-label="Your live bookings" className="mx-auto w-full max-w-[720px] px-4 pt-8 md:px-6">
      <h2 className="text-title font-semibold text-ink">Live bookings</h2>
      <ul className="mt-4 space-y-3">
        {bookings.map((booking) => (
          <li key={booking.id} className="rounded-xl border border-line bg-white p-5">
            <p className="font-semibold text-ink">
              <span className="font-num">{booking.code}</span> · <span className="font-num">{booking.qty}</span> {booking.commodity} at{" "}
              <span className="font-num">{formatKobo(booking.unit_price_kobo)}</span>
            </p>
            {booking.contact.ok && (
              <div className="mt-2 space-y-1 text-ink">
                <p>{booking.contact.name}</p>
                <a href={`tel:${booking.contact.phone}`} className="font-num flex min-h-12 items-center gap-2 underline underline-offset-4 md:min-h-0">
                  <Phone aria-hidden="true" strokeWidth={1.5} className="size-4" />
                  {booking.contact.phone}
                </a>
                {booking.contact.address && (
                  <p className="flex items-start gap-2">
                    <MapPin aria-hidden="true" strokeWidth={1.5} className="mt-1 size-4 shrink-0" />
                    {booking.contact.address}
                  </p>
                )}
              </div>
            )}
            {booking.is_buyer && booking.arrived && booking.status === "confirmed" && (
              <Link
                href={`/dashboard/bookings/${booking.id}/record`}
                className="mt-3 inline-flex min-h-12 items-center rounded-md bg-primary px-4 font-medium text-primary-foreground hover:bg-green-hover"
              >
                Record delivery
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
