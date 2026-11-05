import { clock, kilos, money } from "../format";
import type { Template } from "./types";

/** Farmer: the buyer recorded a weight. */
export const weighIn: Template = (d) => ({
  subject: `${kilos(d.measured_kg ?? 0)} kg × ${money(d.price_kobo)} = ${money(d.gross_kobo ?? 0)}`,
  lines: [
    `${d.buyer} accepted ${d.units_received} of your ${d.qty} ${d.unit}${d.units_declined ? ` and declined ${d.units_declined}` : ""}.`,
    `If this is right, tap Confirm. If we don't hear from you by ${clock(d.reply_by as string)}, we pay this amount.`,
  ],
  image: d.scale_photo ? { src: d.scale_photo, alt: "Photo of the scale" } : undefined,
  buttons: [{ label: "Confirm", action: "confirm_weight" }, { label: "Something's wrong", action: "dispute" }],
});
