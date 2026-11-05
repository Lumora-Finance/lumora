import { kilos, money } from "../format";
import { VIEW_BOOKING, type Template } from "./types";

/** Farmer: settled, with the breakdown. */
export const payoutBreakdown: Template = (d) => {
  const earned = d.measured_kg
    ? `${money(d.gross_kobo ?? 0)} for ${kilos(d.measured_kg)} kg`
    : `${money(d.gross_kobo ?? 0)} for the minimum weight`;
  const fee = d.farmer_fee_kobo ? `, minus Lumora's 1% (${money(d.farmer_fee_kobo)})` : ". No Lumora fee on your first deliveries";
  const owed = d.fees_owed_kobo ? `, minus ${money(d.fees_owed_kobo)} you owed for a missed delivery` : "";
  return {
    subject: `You've earned ${money(d.net_kobo ?? 0)} from ${d.buyer}`,
    lines: [`${earned}${fee}${owed}.`, "It reaches your bank account within 24 hours."],
    buttons: [VIEW_BOOKING],
  };
};
