import { clock } from "../format";
import { VIEW_BOOKING, type Template } from "./types";

/** Buyer, in the app only: the farmer is running late. */
export const runningLate: Template = (d) => ({
  subject: d.expected_at ? `${d.farmer} is running late, expected around ${clock(d.expected_at)}` : `${d.farmer} is running late`,
  lines: [`Booking ${d.code}, ${d.qty} ${d.unit}.`],
  buttons: [VIEW_BOOKING],
});
