import type { MoneyDb } from "@/lib/money/db";

import { notificationCopy } from "./copy";
import type { EmailButton, Facts } from "./templates/types";

export type OutgoingEmail = { id: string; to: string; subject: string; html: string; text: string };
export type Mailer = { send(email: OutgoingEmail): Promise<void> };

type ClaimedEmail = {
  id: string;
  to: string;
  kind: string;
  data: Facts;
  booking_id: string | null;
  created_at: string;
  action_tokens: Record<string, { id: string; expires_at: string }>;
};

/**
 * Email rendering has been removed (react-email stripped).  This stub exists so
 * that `sendEmails` compiles without the dependency.  Because `createResendMailer`
 * always returns null, this function is never called in production.
 */
export async function renderEmail(_email: ClaimedEmail, _secret: string, _siteUrl?: string): Promise<OutgoingEmail> {
  return { id: _email.id, to: _email.to, subject: "Lumora", html: "", text: "" };
}

/**
 * Sends what's queued.  Without a mailer (always null now) or a signing secret
 * nothing is claimed, so emails wait in the queue forever rather than using up
 * their retries.  In-app notifications are unaffected.
 */
export async function sendEmails(deps: { db: MoneyDb; mailer: Mailer | null; secret: string | undefined; now?: Date }) {
  if (!deps.mailer || !deps.secret) return { sent: 0, failed: 0, configured: false };
  // With the null mailer this path is unreachable, but keep the logic intact
  // so re-enabling email later is trivial.
  const at = (deps.now ?? new Date()).toISOString();
  const claimed = await deps.db.rpc<ClaimedEmail[]>("money_email_claim", { p_now: at });
  const outcome = { sent: 0, failed: 0, configured: true };

  for (const email of claimed) {
    try {
      await deps.mailer.send(await renderEmail(email, deps.secret));
      await deps.db.rpc("money_email_sent", { p_id: email.id, p_now: at });
      outcome.sent += 1;
    } catch (error) {
      await deps.db.rpc("money_email_failed", {
        p_id: email.id,
        p_error: error instanceof Error ? error.message : "unknown",
        p_now: at,
      });
      outcome.failed += 1;
    }
  }
  return outcome;
}

// Re-export for callers that import notificationCopy from here.
export { notificationCopy };
export type { EmailButton };
