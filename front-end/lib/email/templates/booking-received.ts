import { dayName } from "../format";
import { VIEW_BOOKING, type Template } from "./types";

/** Buyer: a farmer booked. */
export const bookingReceived: Template = (d) => ({
  subject: `${d.farmer} booked ${d.qty} of your ${d.capacity_total} ${d.unit} for ${dayName(d.window_start)}`,
  lines: [
    d.capacity_remaining > 0 ? `You still need ${d.capacity_remaining}.` : "You have all you need for this day.",
    "Your delivery code is on the booking page. Read it out when the farmer arrives.",
  ],
  buttons: [VIEW_BOOKING],
});
