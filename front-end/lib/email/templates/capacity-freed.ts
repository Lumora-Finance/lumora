import { dayName, pricePer } from "../format";
import { SELL_TO_THEM, type Template } from "./types";

/** Nearby followers: quantity came free. */
export const capacityFreed: Template = (d) => ({
  subject: `${d.buyer} now needs ${d.qty} ${d.goods} on ${dayName(d.window_start)} at ${pricePer(d.price_kobo, d.price_unit)}`,
  lines: ["First come, first served."],
  buttons: [SELL_TO_THEM],
});
