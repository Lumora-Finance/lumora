import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/** GET /api/admin/users — all registered users. */
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

    const { data, error } = await supabase
      .from("users")
      .select("id, name, phone, role, area, is_admin, verified, created_at")
      .order("created_at", { ascending: false });

    if (error) return Response.json([]);
    return Response.json(data ?? []);
  } catch {
    return Response.json([]);
  }
}
