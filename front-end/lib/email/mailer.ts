import type { Mailer } from "./send";

/**
 * Email sending has been removed from the app (resend/react-email stripped).
 * This always returns null, so `sendEmails` becomes a no-op: emails stay queued
 * in the database but nothing is claimed or sent.  In-app notifications (the bell)
 * are unaffected because they read the `notifications` table directly.
 */
export function createResendMailer(): Mailer | null {
  return null;
}
