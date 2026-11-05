import { clock, pricePer } from "../format";
import { SELL_TO_THEM, type Template } from "./types";

/** Farmers with stock nearby: an urgent need. */
export const backupRequest: Template = (d) => ({
  subject: `Urgent: ${d.buyer} needs ${d.qty} ${d.goods} today by ${clock(d.deadline_at as string)}`,
  lines: [
    `${pricePer(d.price_kobo, d.price_unit)}, delivered to ${d.area}${d.distance_km == null ? "" : `, about ${Math.max(d.distance_km, 1)} km from you`}.`,
    "First come, first served. If they stop needing them, we tell you straight away and it doesn't count against you.",
  ],
  buttons: [SELL_TO_THEM],
});
