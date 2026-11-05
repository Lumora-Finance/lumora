import { SEE_BOARD, type Template } from "./types";

/** Farmer: the buyer said no. */
export const bookingDeclined: Template = (d) => ({
  subject: `${d.buyer} couldn't take this booking`,
  lines: [`${d.buyer} couldn't take your ${d.qty} ${d.unit}. This doesn't count against you.`],
  buttons: [SEE_BOARD],
});
