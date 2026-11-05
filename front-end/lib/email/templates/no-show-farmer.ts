import { money } from "../format";
import { VIEW_BOOKING, type Template } from "./types";

/** Farmer: what the no-show means. */
export const noShowFarmer: Template = (d) => ({
  subject: `You missed your delivery to ${d.buyer}`,
  lines: [
    `No delivery code was entered for ${d.qty} ${d.unit}, so the booking is marked as missed and you have a strike.`,
    d.fee_kobo
      ? `A fee of ${money(d.fee_kobo)} comes off your next payout and goes to ${d.buyer}.`
      : "This is your first one, so there's no fee. From the next one, a fee comes off your payout.",
    "Two missed deliveries in 30 days stop you booking for 14 days.",
  ],
  buttons: [VIEW_BOOKING],
});
