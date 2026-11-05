import { money } from "../format";
import { VIEW_BOOKING, type Template } from "./types";

/** Both sides: a weight dispute opened. */
export const disputeOpened: Template = (d) => ({
  subject: d.side === "buyer" ? `${d.farmer} says something's wrong with booking ${d.code}` : `We're looking at your booking for ${d.buyer}`,
  lines: d.side === "buyer"
    ? [`${money(d.disputed_kobo ?? 0)} is on hold while we look at it. We decide within 48 hours.`]
    : [`${money(d.undisputed_kobo ?? 0)} is being paid now, and ${money(d.disputed_kobo ?? 0)} is on hold. We decide within 48 hours.`],
  buttons: [VIEW_BOOKING],
});
