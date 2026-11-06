import { connection } from "next/server";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";
import { notifyBookingRevoked } from "@/lib/notify";

/** POST /api/bookings/[id]/revoke — farmer or buyer cancels a booking before delivery */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const result = await db.rpc("logistics_revoke_booking", {
    p_booking: id,
    p_user: user.id,
    p_now: new Date().toISOString(),
  });

  // Notify the user who triggered the cancellation
  if (result.ok) {
    void notifyBookingRevoked(db, user.id, {
      bookingId: id,
      code: String(result.code ?? id.slice(0, 8).toUpperCase()),
      revokedBy: "farmer",
    }).catch(() => null);
  }

  return Response.json(result, { status: result.ok ? 200 : 400 });
}
