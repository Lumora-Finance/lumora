import { clock } from "../format";
import type { Template } from "./types";

/** Farmer: the reminder, 2 hours before the cut-off. */
export const confirmReminder: Template = (d) => ({
  subject: `Reminder: please confirm ${d.qty} ${d.unit} for ${d.buyer}`,
  lines: [`You have until ${clock(d.cutoff_at)}. After that we give your place to another farmer.`],
  buttons: [{ label: "Yes, I'll be there", action: "confirm" }, { label: "I can't make it", action: "cancel_farmer" }],
});
