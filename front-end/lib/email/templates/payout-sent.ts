import { money } from "../format";
import type { Template } from "./types";

/** Farmer: the money reached their bank. */
export const payoutSent: Template = (d) => ({
  subject: `${money(d.amount_kobo ?? 0)} has been sent to your bank account`,
  lines: ["Thank you for delivering with Lumora."],
  buttons: [{ label: "See my money", href: "/dashboard/wallet" }],
});
