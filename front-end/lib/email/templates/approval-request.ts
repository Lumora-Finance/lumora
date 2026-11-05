import { dayName } from "../format";
import type { Template } from "./types";

/** Buyer: approve a first-time farmer. */
export const approvalRequest: Template = (d) => ({
  subject: `Approve ${d.farmer}? ${d.qty} ${d.unit} for ${dayName(d.window_start)}`,
  lines: [
    `${d.farmer} hasn't delivered to you before and wants to sell you ${d.qty} ${d.unit}.`,
    "If you don't answer in 2 hours, the booking goes ahead.",
  ],
  buttons: [{ label: "Approve", action: "approve" }, { label: "Decline", action: "decline" }],
});
