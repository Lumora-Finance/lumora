import { money } from "../format";
import { VIEW_BOOKING, type Template } from "./types";

/** Both sides: a weight dispute was decided. */
export const disputeDecided: Template = (d) => ({
  subject: `Our decision on booking ${d.code}`,
  lines: [`The final amount for this delivery is ${money(d.final_kobo ?? 0)}.`],
  buttons: [VIEW_BOOKING],
});
