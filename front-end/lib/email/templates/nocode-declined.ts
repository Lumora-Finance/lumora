import { VIEW_BOOKING, type Template } from "./types";

/** Farmer: the buyer declined at the gate. */
export const nocodeDeclined: Template = (d) => ({
  subject: `${d.buyer} declined this delivery`,
  lines: [
    `Please take your ${d.unit} back. This doesn't count against you or the buyer.`,
    `Their reason: ${(d.reason ?? "other").replaceAll("_", " ")}.`,
  ],
  buttons: [VIEW_BOOKING],
});
