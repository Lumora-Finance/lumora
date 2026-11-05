import { dayAndClock, dayName, windowText } from "../format";
import { VIEW_BOOKING, type Template } from "./types";

/** Farmer: the booking went through. */
export const bookingConfirmed: Template = (d, { now }) => ({
  subject: `Booked: ${d.qty} ${d.unit} for ${d.buyer}, ${dayName(d.window_start)}`,
  lines: [
    `${windowText(d.window_start, d.window_end)}, ${d.collects ? "they come to your farm" : d.address ?? d.area ?? "address on your booking"}.`,
    `Booking code ${d.code}.`,
    ...(now.getTime() < new Date(d.cutoff_at).getTime() ? [`You can cancel for free until ${dayAndClock(d.cutoff_at)}.`] : []),
  ],
  buttons: [VIEW_BOOKING],
});
