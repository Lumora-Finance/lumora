/** The one-button screen behind each email link. Safe for the browser: words only. */
export const ACTION_SCREENS: Record<string, { title: string; body: string; button: string; done: string }> = {
  confirm: {
    title: "Confirm you'll be there",
    body: "We'll keep your place, and the buyer will expect you in the delivery window.",
    button: "Yes, I'll be there",
    done: "You're confirmed. See you on delivery day.",
  },
  cancel_farmer: {
    title: "Cancel this booking",
    body: "Before the cut-off this is free. After it, cancelling counts as a missed delivery.",
    button: "I can't make it",
    done: "Your booking is cancelled.",
  },
  approve: {
    title: "Approve this farmer",
    body: "They're booked straight away, and your money stays reserved for them.",
    button: "Approve",
    done: "Approved. The farmer has been told.",
  },
  decline: {
    title: "Decline this farmer",
    body: "Your money goes back to your balance, and others can book this quantity.",
    button: "Decline",
    done: "Declined. Your money is back in your balance.",
  },
  find_backup: {
    title: "Find backup farmers",
    body: "We'll email nearby farmers with stock, at the same price, until two hours after your window. You can change the price or time on the booking page instead. If the first farmer arrives first, we close the request.",
    button: "Find backup farmers",
    done: "We've asked nearby farmers. You'll hear when they book.",
  },
  keep_waiting: {
    title: "Keep waiting",
    body: "We won't ask other farmers. You can still find a backup from the booking page.",
    button: "Keep waiting",
    done: "Okay. We'll let you know when they arrive.",
  },
  confirm_weight: {
    title: "Confirm the weight",
    body: "We'll pay this amount. It reaches your bank account within 24 hours.",
    button: "Confirm",
    done: "Thank you. Your payout is on its way.",
  },
  dispute: {
    title: "Something's wrong",
    body: "We pay the recorded amount now and hold the difference while we look at it. We decide within 48 hours.",
    button: "Something's wrong",
    done: "We've got it. The recorded amount is on its way, and we're looking at the rest.",
  },
};
