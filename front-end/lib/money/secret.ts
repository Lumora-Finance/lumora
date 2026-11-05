import { timingSafeEqual } from "node:crypto";

/** Fails closed: an unset secret matches nothing. */
export function secretMatches(given: string | null | undefined, secret: string | undefined) {
  if (!secret || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
