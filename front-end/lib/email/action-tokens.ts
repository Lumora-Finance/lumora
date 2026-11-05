import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The link in an email button: `<token id>.<expiry in seconds>.<signature>`. The signature means a
 * link can't be made up or stretched past its deadline. The database row behind the id is what makes
 * it single-use and ties it to one person. Pressing the button still needs that person signed in.
 */
const sign = (body: string, secret: string) => createHmac("sha256", secret).update(body).digest("base64url");

export function signActionToken(id: string, expiresAt: string | Date, secret: string): string {
  const body = `${id}.${Math.floor(new Date(expiresAt).getTime() / 1000)}`;
  return `${body}.${sign(body, secret)}`;
}

export type VerifiedToken = { ok: true; id: string } | { ok: false; code: "invalid" | "expired" };

export function verifyActionToken(token: string, secret: string | undefined, now: Date = new Date()): VerifiedToken {
  const [id, expiry, signature, extra] = token.split(".");
  if (!secret || !id || !expiry || !signature || extra !== undefined) return { ok: false, code: "invalid" };
  const expected = Buffer.from(sign(`${id}.${expiry}`, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, code: "invalid" };
  if (now.getTime() >= Number(expiry) * 1000) return { ok: false, code: "expired" };
  return { ok: true, id };
}
