import { kilos, money, pricePer } from "../format";
import { VIEW_BOOKING, type Template } from "./types";

/** Buyer: settled, with the receipt. */
export const receipt: Template = (d) => ({
  subject: `Receipt: ${money(d.gross_kobo ?? 0)} to ${d.farmer} (${d.code})`,
  lines: [
    `${d.measured_kg ? `${kilos(d.measured_kg)} kg` : "Minimum weight"} at ${pricePer(d.price_kobo, d.price_unit)} = ${money(d.gross_kobo ?? 0)}.`,
    `Lumora's 1%: ${money(d.buyer_fee_kobo ?? 0)}. Back in your balance: ${money(d.released_kobo ?? 0)}.`,
  ],
  buttons: [VIEW_BOOKING],
});
