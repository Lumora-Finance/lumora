import { normalisePhone, readLocationChoice, validPhone, type LocationChoice } from "@/lib/logistics/location-input";
import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

export async function POST(request: Request) {
  const db = serverMoneyDb();
  const agent = await requestUser(request, db);
  if (!agent) return new Response("Unauthorized", { status: 401 });
  if (agent.role !== "agent" && agent.role !== "admin") return new Response("Forbidden", { status: 403 });

  const body = ((await request.json().catch(() => null)) ?? {}) as LocationChoice & { name?: string; phone?: string };
  const choice = readLocationChoice(body);
  if (!body.name?.trim() || !validPhone(body.phone) || !choice) {
    return Response.json({ ok: false, code: "invalid_details" }, { status: 400 });
  }
  const result = await db.rpc("logistics_agent_add_farmer", {
    p_agent: agent.id,
    p_name: body.name.trim(),
    p_phone: normalisePhone(body.phone),
    p_area: choice.area,
    p_lat: choice.kind === "gps" ? choice.lat : null,
    p_lng: choice.kind === "gps" ? choice.lng : null,
    p_accuracy: choice.kind === "gps" ? choice.accuracyM : null,
    p_address: body.address ?? null,
  });
  return Response.json(result, { status: result.ok ? 200 : 409 });
}
