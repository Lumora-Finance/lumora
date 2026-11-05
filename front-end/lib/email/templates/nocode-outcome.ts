import { money } from "../format";
import { VIEW_BOOKING, type Template } from "./types";

/** Both sides: ops decided about the code. */
export const nocodeOutcome: Template = (d) => {
  const farmerWords: Record<string, string> = {
    buyer_fault: `The buyer was at fault, so they pay you ${money(d.fee_kobo ?? 0)}. It's on its way to you.`,
    farmer_fault: "We found the delivery wasn't made, so it counts as a missed delivery.",
    no_fault: "We found nobody at fault. There's no fee and no strike.",
  };
  const buyerWords: Record<string, string> = {
    buyer_fault: `We found the code should have been given. The farmer gets ${money(d.fee_kobo ?? 0)}, the rest is back in your balance, and you have a strike.`,
    farmer_fault: "We found the delivery wasn't made. Your money is back in your balance.",
    no_fault: "We found nobody at fault. Your money is back in your balance, with no strike.",
  };
  return {
    subject: `Our decision on booking ${d.code}`,
    lines: [(d.side === "buyer" ? buyerWords : farmerWords)[d.decision ?? "no_fault"]],
    buttons: [VIEW_BOOKING],
  };
};
