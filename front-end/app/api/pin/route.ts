import { createHash } from "node:crypto";
import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function hashPin(pin: string): string {
  // Salted SHA-256. Add PIN_SALT to .env.local for extra security.
  const salt = process.env.PIN_SALT ?? "lumora-pin-v1";
  return createHash("sha256").update(`${salt}:${pin}`).digest("hex");
}

/** GET /api/pin — check whether the current user has a PIN set. */
export async function GET(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data } = await supabaseAdmin()
    .from("transaction_pins")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  return Response.json({ has_pin: !!data });
}

/** POST /api/pin { pin: "1234" } — set or replace the PIN. */
export async function POST(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => null)) as { pin?: string } | null;
  if (!body?.pin || !/^\d{4}$/.test(body.pin)) {
    return Response.json(
      { ok: false, code: "invalid_pin", message: "PIN must be exactly 4 digits" },
      { status: 400 },
    );
  }

  const { error } = await supabaseAdmin()
    .from("transaction_pins")
    .upsert(
      { user_id: user.id, pin_hash: hashPin(body.pin), updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

/** PATCH /api/pin { pin: "1234" } — verify the PIN. Returns { valid: boolean }. */
export async function PATCH(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => null)) as { pin?: string } | null;
  if (!body?.pin || !/^\d{4}$/.test(body.pin)) {
    return Response.json({ ok: false, code: "invalid_pin" }, { status: 400 });
  }

  const { data } = await supabaseAdmin()
    .from("transaction_pins")
    .select("pin_hash")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return Response.json({ ok: false, valid: false, code: "no_pin" }, { status: 404 });

  const valid = data.pin_hash === hashPin(body.pin);
  return Response.json({ ok: valid, valid });
}
