import type { Template } from "./types";

/** Buyer: out of funds. */
export const listingPausedFunds: Template = () => ({
  subject: "Your request is paused",
  lines: ["A farmer tried to book, but your balance doesn't cover it. Add funds to keep taking bookings."],
  buttons: [{ label: "Add funds", href: "/dashboard/wallet" }],
});
