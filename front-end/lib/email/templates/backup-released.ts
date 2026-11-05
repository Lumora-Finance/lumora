import { SEE_BOARD, type Template } from "./types";

/** Backup farmer: no longer needed. */
export const backupReleased: Template = (d) => ({
  subject: `Sorry, ${d.buyer} doesn't need these now`,
  lines: [
    `The first farmer arrived, so ${d.buyer} doesn't need your ${d.qty} ${d.unit} after all. Please don't set off.`,
    "We're sorry. This doesn't count against you.",
  ],
  buttons: [SEE_BOARD],
});
