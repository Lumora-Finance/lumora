import { pricePer } from "../format";
import { SELL_TO_THEM, type Template } from "./types";

/** Followers: a new day of demand. */
export const newDemand: Template = (d) => ({
  subject: `${d.buyer} in ${d.area} wants ${d.goods}`,
  lines: [`They're paying ${pricePer(d.price_kobo, d.price_unit)}. First come, first served.`],
  buttons: [SELL_TO_THEM],
});
