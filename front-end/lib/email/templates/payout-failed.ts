import { money } from "../format";
import { BANK_DETAILS, type Template } from "./types";

/** Farmer: the bank transfer failed. */
export const payoutFailed: Template = (d) => ({
  subject: `We couldn't send your ${money(d.amount_kobo ?? 0)}`,
  lines: ["Your money is safe. Please check your bank account details, and we'll try again tomorrow."],
  buttons: [BANK_DETAILS],
});
