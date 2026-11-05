import { money } from "../format";
import { BANK_DETAILS, type Template } from "./types";

/** Farmer: money is waiting for a bank account. */
export const payoutNeedsAccount: Template = (d) => ({
  subject: `Your ${money(d.amount_kobo ?? 0)} is ready`,
  lines: ["Add a bank account in your name so we can send it."],
  buttons: [BANK_DETAILS],
});
