import { money } from "../format";
import { SEE_BOARD, type Template } from "./types";

/** Farmer: the buyer cancelled. */
export const buyerCancelled: Template = (d) => ({
  subject: `${d.buyer} cancelled your ${d.qty} ${d.unit}`,
  lines: d.fee_kobo
    ? [`They cancelled after the cut-off, so they pay you ${money(d.fee_kobo)}. It's on its way to you.`]
    : ["They cancelled before the cut-off, so there's nothing to do. This doesn't count against you."],
  buttons: [SEE_BOARD],
});
