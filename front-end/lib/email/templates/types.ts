/** The facts a message is written from. Every booking message has the first group. */
export type Facts = {
  booking_id: string; code: string; qty: number; unit: string; goods: string; farmer: string; buyer: string;
  area: string | null; price_kobo: number; price_unit: string; window_start: string; window_end: string;
  cutoff_at: string; capacity_total: number; capacity_remaining: number; address: string | null; collects: boolean;
  reason?: string; side?: "farmer" | "buyer"; decision?: string; released?: number;
  fee_kobo?: number; released_kobo?: number; gross_kobo?: number; net_kobo?: number; farmer_fee_kobo?: number;
  fees_owed_kobo?: number; buyer_fee_kobo?: number; paid_kobo?: number; final_kobo?: number; amount_kobo?: number;
  undisputed_kobo?: number; disputed_kobo?: number; measured_kg?: number | null; scale_photo?: string;
  units_received?: number; units_declined?: number; expected_at?: string | null; record_by?: string; respond_by?: string;
  reply_by?: string; until?: string; deadline_at?: string; distance_km?: number | null;
};

/** A button either runs an action through a signed link or opens a page. No href means the booking. */
export type EmailButton = { label: string; action?: string; href?: string };

export type EmailCopy = { subject: string; lines: string[]; buttons: EmailButton[]; image?: { src: string; alt: string } };

export type Template = (facts: Facts, context: { now: Date }) => EmailCopy;

export const VIEW_BOOKING: EmailButton = { label: "View booking" };
export const SEE_BOARD: EmailButton = { label: "See other buyers near you", href: "/dashboard/board" };
export const SELL_TO_THEM: EmailButton = { label: "Sell to them", href: "/dashboard/board" };
export const BANK_DETAILS: EmailButton = { label: "Check my bank account", href: "/dashboard/wallet" };
