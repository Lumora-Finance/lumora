import { money } from "../format";
import { VIEW_BOOKING, type Template } from "./types";

/** Buyer: the weight wasn't recorded in time. */
export const noRecordBuyer: Template = (d) => ({
  subject: `You didn't record booking ${d.code} in time`,
  lines: [`We paid ${d.farmer} ${money(d.paid_kobo ?? 0)} for the minimum weight, and you have a strike.`],
  buttons: [VIEW_BOOKING],
});
