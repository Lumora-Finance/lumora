import { VIEW_BOOKING, type Template } from "./types";

/** Farmer: the buyer didn't answer. */
export const nocodeWithOps: Template = (d) => ({
  subject: `Our team is looking at your booking for ${d.buyer}`,
  lines: ["The buyer didn't answer in time. We'll decide within 24 hours and email you both."],
  buttons: [VIEW_BOOKING],
});
