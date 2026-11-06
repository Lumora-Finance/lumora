import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/** GET /api/admin/stats — comprehensive platform stats for the admin overview. */
export async function GET(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!user.is_admin) return new Response("Forbidden", { status: 403 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // ── Parallel fetches ────────────────────────────────────────────────────
  const [
    usersRes,
    listingsRes,
    bookingsRes,
    settlementsRes,
    payoutsRes,
    alertsRes,
    disputesRes,
    recentBookingsRes,
    recentUsersRes,
    commodityRes,
    bookingStatusRes,
    weeklyRes,
  ] = await Promise.all([
    // Counts
    supabase.from("users").select("id, role, created_at", { count: "exact" }),
    supabase.from("demand_listings").select("id, status, created_at", { count: "exact" }),
    supabase.from("bookings").select("id, status, unit_price_kobo, qty, created_at", { count: "exact" }),
    // Financial
    supabase.from("money_settlements")
      .select("gross_kobo, fees_kobo, farmer_fee_kobo, net_kobo, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("money_payouts")
      .select("amount_kobo, fee_kobo, status, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    // Alerts & disputes
    supabase.from("money_alerts").select("id, resolved_at", { count: "exact" }),
    supabase.from("disputes").select("id, status", { count: "exact" }),
    // Activity feed: recent bookings
    supabase.from("bookings")
      .select("id, code, qty, status, created_at, farmer:users!bookings_farmer_id_fkey(name), listing:demand_listings(commodity:commodities(name))")
      .order("created_at", { ascending: false })
      .limit(8),
    // Recent users
    supabase.from("users")
      .select("id, name, role, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    // Commodity breakdown
    supabase.from("bookings")
      .select("qty, status, listing:demand_listings!inner(commodity:commodities!inner(name))")
      .in("status", ["settled", "delivered", "confirmed", "booked"]),
    // Booking status breakdown
    supabase.from("bookings")
      .select("status"),
    // Weekly settlements (last 8 weeks)
    supabase.from("money_settlements")
      .select("gross_kobo, fees_kobo, created_at")
      .gte("created_at", new Date(Date.now() - 56 * 86_400_000).toISOString())
      .order("created_at", { ascending: true }),
  ]);

  // ── Totals ───────────────────────────────────────────────────────────────
  const totalRevenue = (settlementsRes.data ?? []).reduce((s, t) => s + (t.fees_kobo ?? 0), 0);
  const totalGross = (settlementsRes.data ?? []).reduce((s, t) => s + (t.gross_kobo ?? 0), 0);
  const totalPayouts = (payoutsRes.data ?? [])
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + (p.amount_kobo ?? 0), 0);
  const pendingPayouts = (payoutsRes.data ?? [])
    .filter((p) => p.status !== "paid" && p.status !== "failed")
    .reduce((s, p) => s + (p.amount_kobo ?? 0), 0);

  // ── User breakdown by role ───────────────────────────────────────────────
  const usersByRole = (usersRes.data ?? []).reduce((acc: Record<string, number>, u) => {
    const role = u.role ?? "unknown";
    acc[role] = (acc[role] ?? 0) + 1;
    return acc;
  }, {});

  // ── Booking status breakdown ─────────────────────────────────────────────
  const bookingsByStatus = (bookingStatusRes.data ?? []).reduce((acc: Record<string, number>, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {});

  // ── Commodity breakdown ──────────────────────────────────────────────────
  const commodityMap: Record<string, number> = {};
  for (const b of commodityRes.data ?? []) {
    const name = (b.listing as unknown as { commodity: { name: string } } | null)?.commodity?.name ?? "Other";
    commodityMap[name] = (commodityMap[name] ?? 0) + (b.qty ?? 0);
  }
  const commodityBreakdown = Object.entries(commodityMap)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 6);

  // ── Listing status breakdown ─────────────────────────────────────────────
  const listingsByStatus = (listingsRes.data ?? []).reduce((acc: Record<string, number>, l) => {
    acc[l.status ?? "unknown"] = (acc[l.status ?? "unknown"] ?? 0) + 1;
    return acc;
  }, {});

  // ── Weekly revenue (last 8 weeks) ────────────────────────────────────────
  const weeklyMap: Record<string, { gross: number; fees: number }> = {};
  for (const s of weeklyRes.data ?? []) {
    const d = new Date(s.created_at);
    // ISO week label: "Mon DD"
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const label = monday.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
    if (!weeklyMap[label]) weeklyMap[label] = { gross: 0, fees: 0 };
    weeklyMap[label].gross += s.gross_kobo ?? 0;
    weeklyMap[label].fees += s.fees_kobo ?? 0;
  }
  const weeklyRevenue = Object.entries(weeklyMap).map(([week, v]) => ({
    week,
    grossNaira: Math.round(v.gross / 100),
    feesNaira: Math.round(v.fees / 100),
  }));

  // ── User growth (last 8 weeks) ───────────────────────────────────────────
  const userGrowthMap: Record<string, number> = {};
  for (const u of usersRes.data ?? []) {
    const d = new Date(u.created_at);
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const label = monday.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
    userGrowthMap[label] = (userGrowthMap[label] ?? 0) + 1;
  }
  const userGrowth = Object.entries(userGrowthMap)
    .map(([week, count]) => ({ week, count }))
    .slice(-8);

  // ── Recent activity feed ─────────────────────────────────────────────────
  const recentActivity = (recentBookingsRes.data ?? []).map((b) => ({
    id: b.id,
    code: b.code,
    qty: b.qty,
    status: b.status,
    created_at: b.created_at,
    farmer: (b.farmer as unknown as { name: string } | null)?.name ?? "—",
    commodity: (b.listing as unknown as { commodity: { name: string } } | null)?.commodity?.name ?? "Produce",
  }));

  return Response.json({
    // KPI counts
    totalUsers: usersRes.count ?? 0,
    totalListings: listingsRes.count ?? 0,
    totalBookings: bookingsRes.count ?? 0,
    openAlerts: (alertsRes.data ?? []).filter((a) => !a.resolved_at).length,
    openDisputes: (disputesRes.data ?? []).filter((d) => d.status === "open").length,

    // Financial KPIs (in kobo)
    totalGrossKobo: totalGross,
    totalRevenueKobo: totalRevenue,
    totalPayoutsKobo: totalPayouts,
    pendingPayoutsKobo: pendingPayouts,

    // Breakdowns for charts
    usersByRole,
    bookingsByStatus,
    listingsByStatus,
    commodityBreakdown,

    // Time series
    weeklyRevenue,
    userGrowth,

    // Activity feed
    recentActivity,
    recentUsers: recentUsersRes.data ?? [],
  });
}
