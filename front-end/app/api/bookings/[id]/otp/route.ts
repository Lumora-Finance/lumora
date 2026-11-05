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
  const result = await db.rpc("logistics_confirm_otp", {
    p_booking: id,
    p_farmer: user.id,
    p_otp: body.otp,
    p_now: new Date().toISOString(),
  });

  return Response.json(result, { status: result.ok ? 200 : 400 });
}
