import { VIEW_BOOKING, type Template } from "./types";

/** Farmer: a first-time booking is waiting for the buyer. */
export const bookingPending: Template = (d) => ({
  subject: `${d.buyer} is checking your booking`,
  lines: [
    `You've asked to sell ${d.qty} ${d.unit} to ${d.buyer}. They look at first-time farmers first.`,
    "We hold your place while they do. If they don't answer in 2 hours, you're booked.",
  ],
  buttons: [VIEW_BOOKING],
});
