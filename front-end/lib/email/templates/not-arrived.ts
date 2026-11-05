import { clock } from "../format";
import type { Template } from "./types";

/** Buyer: halfway through the window, no code and no word. */
export const notArrived: Template = (d) => ({
  subject: `${d.farmer} hasn't arrived yet`,
  lines: [
    `${d.farmer} is due by ${clock(d.window_end)} with ${d.qty} ${d.unit}, and hasn't said they're running late.`,
    "We can ask other farmers nearby. If they arrive first, we close the request and you pay nothing extra.",
  ],
  buttons: [{ label: "Find backup farmers", action: "find_backup" }, { label: "Keep waiting", action: "keep_waiting" }],
});
