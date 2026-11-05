import { readLocationChoice, type LocationChoice } from "@/lib/logistics/location-input";
import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

export async function POST(request: Request) {
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = ((await request.json().catch(() => null)) ?? {}) as LocationChoice;
  const choice = readLocationChoice(body);
  if (!choice) return Response.json({ ok: false, code: "invalid_location" }, { status: 400 });

  // The source is decided here, so a client can't claim a reading it didn't take.
  const result = await db.rpc("logistics_save_location", {
    p_user: user.id,
    p_area: choice.area,
    p_lat: choice.kind === "gps" ? choice.lat : null,
    p_lng: choice.kind === "gps" ? choice.lng : null,
    p_source: choice.kind === "gps" ? "device_gps" : "area_pick",
    p_accuracy: choice.kind === "gps" ? choice.accuracyM : null,
    p_address: body.address ?? null,
  });
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
