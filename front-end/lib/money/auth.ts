import { createRemoteJWKSet, jwtVerify } from "jose";

import type { MoneyDb } from "./db";

const FIREBASE_KEYS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export type MoneyUser = { id: string; phone: string; name: string; role: string };

/** The signed-in user behind a request, from their Firebase ID token. */
export async function requestUser(request: Request, db: MoneyDb): Promise<MoneyUser | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!token || !project) return null;
  try {
    const { payload } = await jwtVerify(token, FIREBASE_KEYS, {
      issuer: `https://securetoken.google.com/${project}`,
      audience: project,
    });
    if (!payload.sub) return null;
    return await db.rpc<MoneyUser | null>("money_user_by_firebase", { p_uid: payload.sub });
  } catch {
    return null;
  }
}
