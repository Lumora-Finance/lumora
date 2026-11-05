import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

const VALID_STATUSES = new Set(["pending", "approved", "rejected", "paid"]);

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/** GET /api/admin/withdrawals?status=pending|approved|rejected|paid|all */
export async function GET(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role !== "admin") return new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "pending";

  const supabase = supabaseAdmin();

  let query = supabase
    .from("withdrawal_requests")
    .select("*, user:users(id, name, phone, area)")
    .order("requested_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json(data ?? []);
}

/** PATCH /api/admin/withdrawals  { id, status, admin_note? } */
export async function PATCH(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role !== "admin") return new Response("Forbidden", { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    status?: string;
    admin_note?: string;
  } | null;

  if (!body?.id || !body?.status) {
    return Response.json({ ok: false, code: "missing_fields" }, { status: 400 });
  }
  if (!VALID_STATUSES.has(body.status)) {
    return Response.json({ ok: false, code: "invalid_status" }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const { error } = await supabase
    .from("withdrawal_requests")
    .update({
      status: body.status,
      admin_note: body.admin_note ?? null,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq("id", body.id);

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
