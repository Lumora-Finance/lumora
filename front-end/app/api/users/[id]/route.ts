import { connection } from "next/server";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/** GET /api/users/[id] — public profile for any user. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  try {
    const [profile, listings] = await Promise.all([
      db.rpc("logistics_public_profile", { p_user: id }),
      db.rpc("logistics_user_listings", { p_user: id }),
    ]);
    if (!profile) return Response.json({ ok: false, code: "not_found" }, { status: 404 });
    return Response.json({ ...profile, listings: listings ?? [] });
  } catch {
    return Response.json({ ok: false, code: "error" }, { status: 500 });
  }
}
