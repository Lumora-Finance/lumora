import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/** GET /api/admin/stats — platform-wide counts for the admin overview. */
export async function GET(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role !== "admin") return new Response("Forbidden", { status: 403 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const [users, listings, bookings, disputes, payouts, alerts] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("demand_listings").select("id", { count: "exact", head: true }),
    supabase.from("bookings").select("id", { count: "exact", head: true }),
    supabase.from("disputes").select("id", { count: "exact", head: true }),
    supabase.from("money_payouts").select("id", { count: "exact", head: true }),
    supabase.from("money_alerts").select("id", { count: "exact", head: true }),
  ]);

  return Response.json({
    users: users.count ?? 0,
    listings: listings.count ?? 0,
    bookings: bookings.count ?? 0,
    disputes: disputes.count ?? 0,
    payouts: payouts.count ?? 0,
    alerts: alerts.count ?? 0,
  });
}
