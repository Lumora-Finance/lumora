import type { Template } from "./types";

/** Buyer: two buyer-fault strikes. */
export const listingsPausedReview: Template = () => ({
  subject: "Your requests are paused for review",
  lines: ["You've had two strikes in 30 days for not giving farmers the delivery code. Our team will contact you."],
  buttons: [{ label: "See my requests", href: "/dashboard/posts" }],
});
