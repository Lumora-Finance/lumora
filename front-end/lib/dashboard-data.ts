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
