import { money } from "../format";
import { VIEW_BOOKING, type Template } from "./types";

/** Buyer: the farmer didn't come. */
export const noShowBuyer: Template = (d) => ({
  subject: `${d.farmer} didn't deliver. Your money is back`,
  lines: [`${money(d.released_kobo ?? 0)} is back in your balance. ${d.qty} ${d.unit} from booking ${d.code} didn't arrive.`],
  buttons: [VIEW_BOOKING],
});
