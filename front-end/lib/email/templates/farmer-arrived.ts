import { clock } from "../format";
import type { Template } from "./types";

/** Buyer: the code was entered. Weigh in. */
export const farmerArrived: Template = (d) => ({
  subject: `${d.farmer} has arrived with ${d.qty} ${d.unit}`,
  lines: [
    `Please weigh them and record it by ${clock(d.record_by as string)}.`,
    "If you don't, we pay the farmer the minimum weight and you get a strike.",
  ],
  buttons: [{ label: "Record the weight", href: `/dashboard/bookings/${d.booking_id}/record` }],
});
