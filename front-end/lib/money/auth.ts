import { createRemoteJWKSet, jwtVerify } from "jose";

import type { MoneyDb } from "./db";

const FIREBASE_KEYS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export type MoneyUser = { id: string; phone: string; name: string; role: string };

/** The verified Firebase uid behind a request. They may not have a row in `users` yet. */
export async function firebaseUid(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!token || !project) return null;
  try {
    const { payload } = await jwtVerify(token, FIREBASE_KEYS, {
      issuer: `https://securetoken.google.com/${project}`,
      audience: project,
    });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/** The signed-in user behind a request, from their Firebase ID token. */
export async function requestUser(request: Request, db: MoneyDb): Promise<MoneyUser | null> {
  const uid = await firebaseUid(request);
  if (!uid) return null;
  return db.rpc<MoneyUser | null>("money_user_by_firebase", { p_uid: uid });
}
