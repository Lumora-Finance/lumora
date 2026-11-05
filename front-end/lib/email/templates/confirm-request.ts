import { dayAndClock, relativeDay, windowText } from "../format";
import type { Template } from "./types";

/** Farmer: confirm before the cut-off. */
export const confirmRequest: Template = (d, { now }) => ({
  subject: `Please confirm: ${d.qty} ${d.unit} for ${d.buyer} ${relativeDay(d.window_start, now)}`,
  lines: [
    `${windowText(d.window_start, d.window_end)}. Booking code ${d.code}.`,
    `Tell us by ${dayAndClock(d.cutoff_at)}, or we give your place to another farmer.`,
  ],
  buttons: [{ label: "Yes, I'll be there", action: "confirm" }, { label: "I can't make it", action: "cancel_farmer" }],
});
