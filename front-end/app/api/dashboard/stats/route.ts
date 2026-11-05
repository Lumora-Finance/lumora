import { connection } from "next/server";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/**
 * Summary numbers for the dashboard hero strip:
 * - activePosts      – listings the user currently has in "active" status
 * - upcomingBookings – bookings in "booked" or "confirmed" state for future slots
 * - monthlyKobo      – net payout for the current calendar month (kobo)
 * - monthlyCount     – number of settled deliveries in the current calendar month
 */
export async function GET(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  try {
    const result = await db.rpc<{
      active_posts: number;
      upcoming_bookings: number;
      monthly_kobo: number;
      monthly_count: number;
    }>("logistics_dashboard_stats", { p_user: user.id });

    return Response.json({
      activePosts: result?.active_posts ?? 0,
      upcomingBookings: result?.upcoming_bookings ?? 0,
      monthlyKobo: result?.monthly_kobo ?? 0,
      monthlyCount: result?.monthly_count ?? 0,
    });
  } catch {
    return Response.json({
      activePosts: 0,
      upcomingBookings: 0,
      monthlyKobo: 0,
      monthlyCount: 0,
    });
  }
}
