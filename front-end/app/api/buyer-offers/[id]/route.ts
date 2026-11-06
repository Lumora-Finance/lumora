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

/**
 * DELETE /api/buyer-offers/[id] — buyer withdraws their own pending offer on a supply listing.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const supabase = supabaseAdmin();

  const { data: offer, error: fetchError } = await supabase
    .from("buyer_offers")
    .select("id, buyer_id, status")
    .eq("id", id)
    .single();

  if (fetchError || !offer) return new Response("Not found", { status: 404 });
  if ((offer as { buyer_id: string }).buyer_id !== user.id) return new Response("Forbidden", { status: 403 });
  if ((offer as { status: string }).status !== "pending") {
    return Response.json({ ok: false, code: "not_pending" }, { status: 409 });
  }

  const { error: updateError } = await supabase
    .from("buyer_offers")
    .update({ status: "withdrawn" })
    .eq("id", id);

  if (updateError) return Response.json({ ok: false, error: updateError.message }, { status: 500 });
  return Response.json({ ok: true });
}

/**
 * PATCH /api/buyer-offers/[id] — buyer edits their own pending offer (qty, note, price).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    qty?: number;
    note?: string | null;
    unitPriceKobo?: number | null;
  } | null;

  if (!body?.qty || body.qty < 1) {
    return Response.json({ ok: false, code: "invalid_qty" }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const { data: offer, error: fetchError } = await supabase
    .from("buyer_offers")
    .select("id, buyer_id, status")
    .eq("id", id)
    .single();

  if (fetchError || !offer) return new Response("Not found", { status: 404 });
  if ((offer as { buyer_id: string }).buyer_id !== user.id) return new Response("Forbidden", { status: 403 });
  if ((offer as { status: string }).status !== "pending") {
    return Response.json({ ok: false, code: "not_pending" }, { status: 409 });
  }

  const { error: updateError } = await supabase
    .from("buyer_offers")
    .update({
      qty: body.qty,
      note: body.note ?? null,
      ...(body.unitPriceKobo != null ? { unit_price_kobo: body.unitPriceKobo } : {}),
    })
    .eq("id", id);

  if (updateError) return Response.json({ ok: false, error: updateError.message }, { status: 500 });
  return Response.json({ ok: true });
}
