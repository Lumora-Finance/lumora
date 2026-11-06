import { connection } from "next/server";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/** POST /api/bookings/[id]/otp — farmer submits the 6-digit OTP given by buyer */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => null)) as { otp?: string } | null;
  if (!body?.otp || !/^\d{6}$/.test(body.otp)) {
    return Response.json({ ok: false, code: "invalid_otp", message: "OTP must be 6 digits" }, { status: 400 });
  }

  const { id } = await params;
  try {
    const result = await db.rpc("logistics_confirm_otp", {
      p_booking: id,
      p_farmer: user.id,
      p_otp: body.otp,
      p_now: new Date().toISOString(),
    });
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    // The code was right, but the money couldn't move. Nothing was saved, so it can be tried again.
    const short = error instanceof Error && error.message.includes("money_balances");
    await db
      .rpc("money_alert", { p_kind: "otp_settlement_failed", p_detail: { booking_id: id, short_of_funds: short } })
      .catch(() => null);
    return Response.json(
      short
        ? { ok: false, code: "buyer_short_of_funds", message: "The code is right, but the buyer doesn't have enough in their wallet to pay you yet. Ask them to add funds, then try again." }
        : { ok: false, code: "otp_failed", message: "That didn't go through. Please try again." },
      { status: short ? 409 : 500 },
    );
  }
}
