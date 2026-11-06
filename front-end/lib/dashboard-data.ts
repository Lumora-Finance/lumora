/** What the dashboard's sections read from the API, as useDashboardData returns it. */
export type DashboardStats = { activePosts: number; upcomingBookings: number; monthlyKobo: number; monthlyCount: number };

export type DashboardBooking = {
  id: string;
  code: string;
  qty: number;
  status: string;
  window_start: string;
  is_buyer: boolean;
  arrived: boolean;
  commodity: string;
  unit_price_kobo: number;
  farmer?: string;
  contact?: { ok: boolean; name?: string };
};

export type DashboardPost = {
  id: string;
  spec: string | null;
  unit_price_kobo: number;
  capacity_per_day: number;
  status: "active" | "paused" | "closed";
  commodity: { id: string; name: string; unit: string } | null;
};

export type DashboardSettlement = {
  id: string;
  gross_kobo: number;
  fees_kobo: number;
  net_kobo: number;
  kind: string;
  created_at: string;
  booking: {
    code: string;
    slot: { listing: { commodity: { name: string; unit: string }; buyer: { id: string; name: string } } } | null;
  } | null;
};

const STILL_AHEAD = new Set(["pending_approval", "booked", "confirmed", "contested"]);

/** Bookings still to happen, soonest first. A delivery under way stays on the list until it's weighed. */
export const upcoming = (bookings: DashboardBooking[] | null | undefined) =>
  (Array.isArray(bookings) ? bookings : [])
    .filter((booking) => STILL_AHEAD.has(booking.status))
    .sort((a, b) => new Date(a.window_start).getTime() - new Date(b.window_start).getTime());

/** Who's on the other side, whichever side the viewer is. */
export const otherParty = (booking: DashboardBooking) =>
  booking.is_buyer ? (booking.farmer ?? "A farmer") : (booking.contact?.name ?? "Your buyer");

export type MoneyRow = { amount_kobo: number; direction: "credit" | "debit"; kind: string; created_at: string };

/** What a person's money chart counts: wallet funding for a buyer, delivery payouts for anyone selling. */
export const countsTowardsChart = (row: MoneyRow, role: string | null | undefined) =>
  row.direction === "credit" && row.kind === (role === "buyer" ? "deposit" : "trade");

/** The total for each of the last `count` months, oldest first. */
export function monthlyTotals(today: Date | null, rows: MoneyRow[], role: string | null | undefined, count: number) {
  return Array.from({ length: count }, (_, index) => {
    if (!today) return { name: "\u00A0", kobo: 0 };
    const start = new Date(today.getFullYear(), today.getMonth() - (count - 1 - index), 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const kobo = rows
      .filter((row) => {
        const at = new Date(row.created_at);
        return at >= start && at < end && countsTowardsChart(row, role);
      })
      .reduce((sum, row) => sum + (Number(row.amount_kobo) || 0), 0);
    return { name: new Intl.DateTimeFormat("en-GB", { month: "short" }).format(start), kobo };
  });
}
