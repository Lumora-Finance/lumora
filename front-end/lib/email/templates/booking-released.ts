import { dayAndClock } from "../format";
import { SEE_BOARD, type Template } from "./types";

/** Farmer: not confirmed in time. */
export const bookingReleased: Template = (d) => ({
  subject: `Your booking for ${d.buyer} was released`,
  lines: [
    `You didn't confirm ${d.qty} ${d.unit} by ${dayAndClock(d.cutoff_at)}, so we offered them to other farmers.`,
    "This isn't a strike. You can sell to other buyers on the board.",
  ],
  buttons: [SEE_BOARD],
});
