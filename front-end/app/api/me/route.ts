import { connection } from "next/server";

import { firebaseIdentity, firebaseUid, requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";
import { normalisePhone, validPhone } from "@/lib/logistics/location-input";

export async function GET(request: Request) {
  // Personal to each request, so it must never be prerendered at build time.
  await connection();
  const db = serverMoneyDb();
  const uid = await firebaseUid(request);
  if (!uid) return new Response("Unauthorized", { status: 401 });
  const user = await requestUser(request, db);
  if (!user) return Response.json(null);
  return Response.json(await db.rpc("logistics_my_profile", { p_user: user.id }));
}

export async function POST(request: Request) {
  const db = serverMoneyDb();
  const identity = await firebaseIdentity(request);
  if (!identity) return new Response("Unauthorized", { status: 401 });
  const body = (await request.json().catch(() => null)) as { name?: string; phone?: string; role?: string } | null;
  if (!body?.name?.trim() || !validPhone(body.phone)) {
    return Response.json({ ok: false, code: "invalid_details" }, { status: 400 });
  }
  const result = await db.rpc("logistics_save_profile", {
    p_firebase_uid: identity.uid,
    p_name: body.name.trim(),
    p_phone: normalisePhone(body.phone),
    p_role: body.role ?? "",
  });
  // Notifications go to the sign-in email, so a new account has one from the start.
  if (result.ok && identity.email) {
    await db.rpc("money_set_email", { p_user: result.id, p_email: identity.email }).catch(() => {});
  }
  return Response.json(result, { status: result.ok ? 200 : 409 });
}
