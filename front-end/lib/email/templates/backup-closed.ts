import { VIEW_BOOKING, type Template } from "./types";

/** Buyer: what happened to the backup request. */
export const backupClosed: Template = (d) => {
  const words: Record<string, string> = {
    filled: "Backup farmers have booked everything you asked for.",
    original_arrived: d.released
      ? `${d.farmer} arrived, so we closed the request and released ${d.released} backup booking${d.released === 1 ? "" : "s"}.`
      : `${d.farmer} arrived, so we closed the request.`,
    buyer_cancelled: "You cancelled this booking, so we closed the request.",
    deadline: "The time you set has passed, so we closed the request.",
  };
  return {
    subject: `Backup request for ${d.code}: ${d.reason === "filled" ? "filled" : "closed"}`,
    lines: [words[d.reason ?? "deadline"] ?? words.deadline],
    buttons: [VIEW_BOOKING],
  };
};
