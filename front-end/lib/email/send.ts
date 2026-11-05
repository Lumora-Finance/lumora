import { createElement } from "react";
import { render } from "react-email";

import type { MoneyDb } from "@/lib/money/db";
import { SITE_URL } from "@/lib/site";

import { signActionToken } from "./action-tokens";
import { notificationCopy } from "./copy";
import { EmailLayout } from "./templates/layout";
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

function buttonHref(button: EmailButton, email: ClaimedEmail, secret: string, siteUrl: string) {
  const token = button.action ? email.action_tokens[button.action] : undefined;
  if (token) return `${siteUrl}/action/${signActionToken(token.id, token.expires_at, secret)}`;
  if (button.href) return `${siteUrl}${button.href}`;
  return `${siteUrl}${email.booking_id ? `/dashboard/bookings/${email.booking_id}` : "/dashboard"}`;
}

export async function renderEmail(email: ClaimedEmail, secret: string, siteUrl: string = SITE_URL): Promise<OutgoingEmail> {
  const copy = notificationCopy(email.kind, email.data, email.created_at);
  const element = createElement(EmailLayout, {
    preview: copy.lines[0] ?? copy.subject,
    lines: copy.lines,
    image: copy.image,
    buttons: copy.buttons.map((button) => ({ label: button.label, href: buttonHref(button, email, secret, siteUrl) })),
  });
  return {
    id: email.id,
    to: email.to,
    subject: copy.subject,
    html: await render(element),
    text: await render(element, { plainText: true }),
  };
}

/**
 * Sends what's queued. A failure only ever reschedules that one email, because the money step that
 * queued it has already committed. Without a mailer or a signing secret nothing is claimed, so
 * emails wait in the queue rather than using up their retries.
 */
export async function sendEmails(deps: { db: MoneyDb; mailer: Mailer | null; secret: string | undefined; now?: Date }) {
  if (!deps.mailer || !deps.secret) return { sent: 0, failed: 0, configured: false };
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
