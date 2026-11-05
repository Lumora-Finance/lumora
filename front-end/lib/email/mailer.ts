import { Resend } from "resend";

import type { Mailer } from "./send";

/** Null until RESEND_API_KEY and EMAIL_FROM are set. The row id stops a retry delivering twice. */
export function createResendMailer(): Mailer | null {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return null;
  const resend = new Resend(key);
  return {
    async send(email) {
      const { error } = await resend.emails.send(
        { from, to: email.to, subject: email.subject, html: email.html, text: email.text },
        { idempotencyKey: email.id },
      );
      if (error) throw new Error(error.message);
    },
  };
}
