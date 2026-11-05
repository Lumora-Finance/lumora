import { approvalRequest } from "./approval-request";
import { backupClosed } from "./backup-closed";
import { backupReleased } from "./backup-released";
import { backupRequest } from "./backup-request";
import { bookingConfirmed } from "./booking-confirmed";
import { bookingDeclined } from "./booking-declined";
import { bookingPending } from "./booking-pending";
import { bookingReceived } from "./booking-received";
import { bookingReleased } from "./booking-released";
import { buyerCancelled } from "./buyer-cancelled";
import { capacityFreed } from "./capacity-freed";
import { confirmReminder } from "./confirm-reminder";
import { confirmRequest } from "./confirm-request";
import { disputeDecided } from "./dispute-decided";
import { disputeOpened } from "./dispute-opened";
import { farmerArrived } from "./farmer-arrived";
import { farmerCancelled } from "./farmer-cancelled";
import { farmerPaused } from "./farmer-paused";
import { listingPausedFunds } from "./listing-paused-funds";
import { listingsPausedReview } from "./listings-paused-review";
import { newDemand } from "./new-demand";
import { noRecordBuyer } from "./no-record-buyer";
import { noShowBuyer } from "./no-show-buyer";
import { noShowFarmer } from "./no-show-farmer";
import { nocodeBuyer } from "./nocode-buyer";
import { nocodeDeclined } from "./nocode-declined";
import { nocodeOutcome } from "./nocode-outcome";
import { nocodeWithOps } from "./nocode-with-ops";
import { notArrived } from "./not-arrived";
import { payoutBreakdown } from "./payout-breakdown";
import { payoutFailed } from "./payout-failed";
import { payoutNeedsAccount } from "./payout-needs-account";
import { payoutSent } from "./payout-sent";
import { receipt } from "./receipt";
import { runningLate } from "./running-late";
import { weighIn } from "./weigh-in";
import type { Template } from "./types";

/** One template per event. The key is the `kind` that SQL writes on the notification. */
export const TEMPLATES: Record<string, Template> = {
  approval_request: approvalRequest,
  backup_closed: backupClosed,
  backup_released: backupReleased,
  backup_request: backupRequest,
  booking_confirmed: bookingConfirmed,
  booking_declined: bookingDeclined,
  booking_pending: bookingPending,
  booking_received: bookingReceived,
  booking_released: bookingReleased,
  buyer_cancelled: buyerCancelled,
  capacity_freed: capacityFreed,
  confirm_reminder: confirmReminder,
  confirm_request: confirmRequest,
  dispute_decided: disputeDecided,
  dispute_opened: disputeOpened,
  farmer_arrived: farmerArrived,
  farmer_cancelled: farmerCancelled,
  farmer_paused: farmerPaused,
  listing_paused_funds: listingPausedFunds,
  listings_paused_review: listingsPausedReview,
  new_demand: newDemand,
  no_record_buyer: noRecordBuyer,
  no_show_buyer: noShowBuyer,
  no_show_farmer: noShowFarmer,
  nocode_buyer: nocodeBuyer,
  nocode_declined: nocodeDeclined,
  nocode_outcome: nocodeOutcome,
  nocode_with_ops: nocodeWithOps,
  not_arrived: notArrived,
  payout_breakdown: payoutBreakdown,
  payout_failed: payoutFailed,
  payout_needs_account: payoutNeedsAccount,
  payout_sent: payoutSent,
  receipt: receipt,
  running_late: runningLate,
  weigh_in: weighIn,
};
