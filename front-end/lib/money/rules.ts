/**
 * The money rules. The SQL function `money_rule` holds the same numbers, because deadlines are
 * enforced in the database (true is 1 there). A test fails if the two disagree. See docs/money-flow.md.
 */
export const RULES = {
  CONFIRM_REQUEST_HOURS_BEFORE_CUTOFF: 12,
  CONFIRM_REMINDER_HOURS_BEFORE_CUTOFF: 2,
  FIRST_TIME_APPROVAL_HOURS: 2,
  LATE_CHECK_AT_WINDOW_FRACTION: 0.5,
  BACKUP_NOTIFY_MAX: 15,
  FREED_NOTIFY_MAX: 10,
  NEARBY_KM: 50,
  REOPEN_LEAD_HOURS: 4,
  NO_SHOW_GRACE_HOURS: 2,
  NOCODE_GRACE_HOURS: 1,
  NOCODE_BUYER_RESPONSE_MINUTES: 30,
  NOCODE_OPS_DECISION_HOURS: 24,
  BUYER_RECORD_HOURS: 2,
  FARMER_REPLY_HOURS: 2,
  DISPUTE_DECISION_HOURS: 48,
  OVER_CAP_REFUND_HOURS: 48,
  WEIGHT_TOLERANCE: 0.01,
  NO_SHOW_FEE_PCT: 5,
  LATE_CANCEL_FEE_PCT: 5,
  FIRST_NO_SHOW_IS_WARNING: true,
  NO_SHOW_PAUSE_COUNT: 2,
  NO_SHOW_PAUSE_WINDOW_DAYS: 30,
  NO_SHOW_PAUSE_DAYS: 14,
  BUYER_FEE_PCT: 1,
  FARMER_FEE_PCT: 1,
  FREE_FARMER_DELIVERIES: 3,
  NEW_FARMER_FIRST_BOOKING_CAP: 20,
  CODE_MAX_ATTEMPTS: 5,
  REFUSED_CODE_PAUSE_COUNT: 2,
  REFUSED_CODE_WINDOW_DAYS: 30,
  NEW_BUYER_FUNDING_CAP_KOBO: 50_000_000,
  NEW_BUYER_COMPLETED_DELIVERIES: 5,
  PAIR_MIN_TRADES: 5,
  PAIR_SHARE: 0.8,
  PAYOUT_ALERT_ATTEMPTS: 3,
  EMAIL_MAX_ATTEMPTS: 6,
  EMAIL_RETRY_MINUTES: 5,
  SMS_RATE_LIMIT: 10,
  SMS_RATE_WINDOW_MINUTES: 10,
} as const;

/**
 * Reads a naira amount from Flutterwave into kobo by its digits, so no float arithmetic touches
 * money. Returns null for anything that isn't a plain amount with at most two decimals.
 */
export function nairaToKobo(amount: number | string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(amount).trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

/** Writes kobo as the naira amount Flutterwave expects, also by digits. */
export function koboToNaira(kobo: number): string {
  if (!Number.isSafeInteger(kobo) || kobo < 0) throw new Error("Invalid kobo amount");
  const fraction = kobo % 100;
  const whole = (kobo - fraction) / 100;
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, "0")}`;
}

export function formatKobo(kobo: number): string {
  const fraction = kobo % 100;
  const whole = (kobo - fraction) / 100;
  const text = new Intl.NumberFormat("en-NG").format(whole);
  return fraction === 0 ? `₦${text}` : `₦${text}.${String(fraction).padStart(2, "0")}`;
}

const nameParts = (name: string) =>
  name
    .toUpperCase()
    .replace(/[^A-Z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/**
 * Does a bank's account name belong to this farmer? Ignores case and word order, and lets an
 * initial stand for a name ("A. BELLO" matches "Amina Bello"). Every registered name has to be
 * accounted for, and the account can't name anyone else.
 */
export function namesMatch(registered: string, resolved: string): boolean {
  const wanted = nameParts(registered);
  const found = nameParts(resolved);
  if (wanted.length === 0 || found.length < 2) return false;

  const unused = [...found];
  for (const part of wanted) {
    const at = unused.findIndex(
      (other) =>
        other === part ||
        (other.length === 1 && part.startsWith(other)) ||
        (part.length === 1 && other.startsWith(part)),
    );
    if (at === -1) return false;
    unused.splice(at, 1);
  }
  // A bank may hold a middle name the farmer didn't register, but only one.
  return unused.length <= 1;
}
