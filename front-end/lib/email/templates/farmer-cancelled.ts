import { dayName } from "../format";
import { VIEW_BOOKING, type Template } from "./types";

/** Buyer: a farmer cancelled in time. */
export const farmerCancelled: Template = (d) => ({
  subject: `${d.farmer} cancelled ${d.qty} ${d.unit} for ${dayName(d.window_start)}`,
  lines: [`Your money is back in your balance. You now need ${d.capacity_remaining} more, and others can book them.`],
  buttons: [VIEW_BOOKING],
});
