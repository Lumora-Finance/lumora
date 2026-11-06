import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/** Once the farmer marks delivery, until the money moves or the booking ends. */
const CODE_STATUSES = new Set(["confirmed", "contested", "delivered"]);

/** The code made when the farmer marked delivery. It lives on the notification sent to the buyer. */
async function latestDeliveryOtp(buyerId: string, bookingId: string): Promise<string | null> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const { data } = await supabase
    .from("notifications")
    .select("data")
    .eq("user_id", buyerId)
    .eq("kind", "delivery_otp")
    .eq("data->>booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1);
  const otp = (data?.[0]?.data as { otp?: unknown } | undefined)?.otp;
  return typeof otp === "string" ? otp : null;
}

/** One booking, as this viewer's side sees it. The database checks they're on it. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Personal to each request, so it must never be prerendered at build time.
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const view = await db.rpc("money_booking_view", { p_booking: id, p_viewer: user.id });
  // Only ever the buyer: the farmer has to be given this code in person.
  if (view.ok && view.role === "buyer" && view.arrived_at && CODE_STATUSES.has(String(view.status))) {
    view.delivery_otp = await latestDeliveryOtp(user.id, id).catch(() => null);
  }
  return Response.json(view, { status: view.ok ? 200 : 404 });
}
