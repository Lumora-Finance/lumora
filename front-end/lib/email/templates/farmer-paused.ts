import { dayMonth } from "../format";
import { VIEW_BOOKING, type Template } from "./types";

/** Farmer: booking is paused. */
export const farmerPaused: Template = (d) => ({
  subject: `You can't book until ${dayMonth(d.until as string)}`,
  lines: [
    "You've missed two deliveries in 30 days, so booking is paused for 14 days.",
    `You can book again from ${dayMonth(d.until as string)}. Deliveries you already have still stand.`,
  ],
  buttons: [VIEW_BOOKING],
});
