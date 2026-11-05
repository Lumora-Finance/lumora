import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/** GET /api/admin/transactions — all settlements. */
export async function GET(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role !== "admin") return new Response("Forbidden", { status: 403 });

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const { data } = await supabase
      .from("money_settlements")
      .select("id, gross_kobo, fees_kobo, net_kobo, kind, created_at, booking:bookings(code), farmer:users(name)")
      .order("created_at", { ascending: false })
      .limit(100);

    return Response.json(data ?? []);
  } catch {
    return Response.json([]);
  }
}
