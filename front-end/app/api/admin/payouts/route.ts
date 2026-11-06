import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/** GET /api/admin/payouts — all money payouts. */
export async function GET(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!user.is_admin) return new Response("Forbidden", { status: 403 });

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const { data } = await supabase
      .from("money_payouts")
      .select("id, amount_kobo, status, fee_kobo, attempts, created_at, paid_at, farmer:users(name)")
      .order("created_at", { ascending: false })
      .limit(100);

    return Response.json(data ?? []);
  } catch {
    return Response.json([]);
  }
}
