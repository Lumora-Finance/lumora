import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";
import { notifyDeliveryRecorded } from "@/lib/notify";

type Body = { unitsReceived?: number; declined?: unknown[]; measuredKg?: number; scalePhotos?: string[] };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const body = ((await request.json().catch(() => null)) ?? {}) as Body;
  const declined = Array.isArray(body.declined) ? body.declined : [];
  const result = await db.rpc("logistics_record_delivery", {
    p_booking: id,
    p_buyer: user.id,
    p_units_received: body.unitsReceived ?? 0,
    p_units_declined: declined.length,
    p_decline_reasons: declined,
    p_measured_kg: body.measuredKg ?? 0,
    p_scale_photos: body.scalePhotos ?? [],
  });

  // Notify the buyer (who just recorded) and, if available, the farmer
  if (result.ok) {
    void notifyDeliveryRecorded(db, user.id, {
      bookingId: id,
      code: String(result.code ?? ""),
      accepted: body.unitsReceived ?? 0,
      unit: "units",
      kg: body.measuredKg ?? 0,
    }).catch(() => null);

    // Also notify the farmer if their id is returned
    if (result.farmer_id && result.farmer_id !== user.id) {
      void notifyDeliveryRecorded(db, String(result.farmer_id), {
        bookingId: id,
        code: String(result.code ?? ""),
        accepted: body.unitsReceived ?? 0,
        unit: "units",
        kg: body.measuredKg ?? 0,
      }).catch(() => null);
    }
  }

  return Response.json(result, { status: result.ok ? 200 : 409 });
}
