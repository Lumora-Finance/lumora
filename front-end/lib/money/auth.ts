import { createRemoteJWKSet, jwtVerify } from "jose";

import type { MoneyDb } from "./db";

const FIREBASE_KEYS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export type MoneyUser = { id: string; phone: string; name: string; role: string; email?: string | null };

/** The verified identity behind a request. They may not have a row in `users` yet. */
export async function firebaseIdentity(request: Request): Promise<{ uid: string; email: string | null } | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!token || !project) return null;
  try {
    const { payload } = await jwtVerify(token, FIREBASE_KEYS, {
      issuer: `https://securetoken.google.com/${project}`,
      audience: project,
    });
    if (!payload.sub) return null;
    return { uid: payload.sub, email: typeof payload.email === "string" ? payload.email.toLowerCase() : null };
  } catch {
    return null;
  }
}

export const firebaseUid = async (request: Request) => (await firebaseIdentity(request))?.uid ?? null;

/**
 * The signed-in user behind a request. Their sign-in email is where notifications go, so it's kept
 * up to date here. Failing to save it must never stop what they came to do.
 */
export async function requestUser(request: Request, db: MoneyDb): Promise<MoneyUser | null> {
  const identity = await firebaseIdentity(request);
  if (!identity) return null;
  const user = await db.rpc<MoneyUser | null>("money_user_by_firebase", { p_uid: identity.uid });
  if (user && identity.email && user.email !== identity.email) {
    await db.rpc("money_set_email", { p_user: user.id, p_email: identity.email }).catch(() => {});
  }
  return user;
}
