/** One booking, as the server sends it to one side. Words and rules stay out of here. */
export type BookingView = {
  id: string;
  role: "farmer" | "buyer";
  status: string;
  closed_reason: string | null;
  code: string;
  qty: number;
  unit: string;
  goods: string;
  farmer: string;
  buyer: string;
  area: string | null;
  price_kobo: number;
  price_unit: string;
  reserve_kobo: number;
  window_start: string;
  window_end: string;
  cutoff_at: string;
  confirm_deadline: string;
  approval_deadline: string | null;
  arrived_at: string | null;
  late_notice_at: string | null;
  late_expected_at: string | null;
  late_check_at: string | null;
  keep_waiting_at: string | null;
  code_locked: boolean;
  is_backup: boolean;
  no_show_at: string;
  no_code_until: string;
  record_by: string | null;
  delivery_code: string | null;
  address: string | null;
  collects: boolean;
  contact: { ok: boolean; name?: string; phone?: string; address?: string | null };
  reliability: { on_time: number; total: number };
  delivery: {
    measured_kg: number; gross_kobo: number; units_received: number; units_declined: number;
    scale_photo: string | null; reply_deadline: string; farmer_reply: string;
  } | null;
  settlement: { gross_kobo: number; fees_kobo: number; farmer_fee_kobo: number; net_kobo: number } | null;
  payout_status: "paid" | "sending" | null;
  report: { status: string; buyer_deadline_at: string; decision: string | null } | null;
  backup: { status: string; qty: number; price_kobo: number; deadline_at: string; remaining: number } | null;
};

const before = (moment: string | null, now: Date) => moment !== null && now.getTime() < new Date(moment).getTime();
const after = (moment: string, now: Date) => now.getTime() >= new Date(moment).getTime();

/** Which controls apply right now. The database has the final say on all of them. */
export function bookingOptions(view: BookingView, now: Date) {
  const waiting = view.status === "confirmed" && !view.arrived_at;
  const isFarmer = view.role === "farmer";
  const isBuyer = view.role === "buyer";
  const notArrived = !view.arrived_at;
  return {
    confirm: isFarmer && view.status === "booked" && before(view.confirm_deadline, now),
    cancel: isFarmer
      ? ["pending_approval", "booked", "confirmed"].includes(view.status) && notArrived
      : ["booked", "confirmed"].includes(view.status) && notArrived,
    cancelCounts: isFarmer ? view.status === "confirmed" && after(view.cutoff_at, now) : after(view.cutoff_at, now),
    runningLate: isFarmer && waiting && before(view.no_show_at, now),
    enterCode: isFarmer && ["confirmed", "contested"].includes(view.status) && notArrived && !view.code_locked,
    noCode: isFarmer && waiting && after(view.window_start, now) && before(view.no_code_until, now),
    weighReply: isFarmer && view.status === "delivered",
    answerApproval: isBuyer && view.status === "pending_approval",
    showCode: isBuyer && ["booked", "confirmed", "contested"].includes(view.status) && notArrived,
    findBackup: isBuyer && waiting && !view.is_backup && !view.backup && after(view.window_start, now),
    keepWaiting: isBuyer && waiting && view.late_check_at !== null && view.keep_waiting_at === null && !view.backup,
    weighIn: isBuyer && view.status === "confirmed" && view.arrived_at !== null,
    gateDecline: isBuyer && view.status === "contested",
  };
}

export type TimelineStep = { label: string; done: boolean; current: boolean };

const CONFIRMED = new Set(["confirmed", "contested", "delivered", "disputed", "settled"]);
const WEIGHED = new Set(["delivered", "disputed", "settled"]);

/** Booked, Confirmed, Arrived, Weighed, Paid. A booking that ended early stops where it got to. */
export function timelineSteps(view: BookingView): TimelineStep[] {
  const reached = [
    !["pending_approval", "declined"].includes(view.status),
    CONFIRMED.has(view.status) || view.arrived_at !== null,
    view.arrived_at !== null,
    WEIGHED.has(view.status),
    view.status === "settled" && view.payout_status !== "sending",
  ];
  const labels = ["Booked", "Confirmed", "Arrived", "Weighed", "Paid"];
  const next = reached.lastIndexOf(true) + 1;
  return labels.map((label, index) => ({ label, done: reached[index], current: index === next }));
}

/** How a booking ended, in plain words. Null while it's still going. */
export function endedWords(view: BookingView): string | null {
  switch (view.status) {
    case "released":
      return view.closed_reason === "backup_not_needed"
        ? "No longer needed. The first farmer arrived, and this doesn't count against anyone."
        : "Released, because it wasn't confirmed by the cut-off.";
    case "declined":
      return "The buyer couldn't take this booking.";
    case "no_show":
      return "Missed. No delivery code was entered in time.";
    case "cancelled":
      if (view.closed_reason === "buyer_declined_delivery") return "The buyer declined this delivery at the gate. No penalty for either side.";
      if (view.closed_reason === "buyer_fault") return "Our team found the buyer at fault. The farmer got the late-cancel fee.";
      if (view.closed_reason === "no_fault") return "Our team found nobody at fault. The money went back to the buyer.";
      return view.closed_reason === "buyer_cancelled" ? "The buyer cancelled." : "The farmer cancelled.";
    default:
      return null;
  }
}

/** "18 of 19 on time", or a plain word for someone new. */
export const reliabilityWords = ({ on_time, total }: { on_time: number; total: number }) =>
  total === 0 ? "New farmer, no deliveries yet" : `${on_time} of ${total} on time`;
