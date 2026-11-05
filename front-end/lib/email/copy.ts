import { TEMPLATES } from "./templates";
import type { EmailCopy, Facts } from "./templates/types";

/** The words for a notification, in the bell and in the email alike. Unknown kinds stay readable. */
export function notificationCopy(kind: string, data: Facts, createdAt: string): EmailCopy {
  const template = TEMPLATES[kind];
  if (!template) return { subject: "You have an update on Lumora", lines: [], buttons: [] };
  return template(data, { now: new Date(createdAt) });
}
