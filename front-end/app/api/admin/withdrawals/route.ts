import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";
import { notify } from "@/lib/notify";

const VALID_ACTIONS = new Set(["approved", "rejected", "paid"]);

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// ─── GET /api/admin/withdrawals?status=pending|approved|rejected|paid|all ──

export async function GET(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!user.is_admin) return new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "pending";

  const supabase = supabaseAdmin();

  let query = supabase
    .from("withdrawal_requests")
    .select("*, user:users(id, name, phone, area)")
    .order("requested_at", { ascending: false });

  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json(data ?? []);
}

// ─── PATCH /api/admin/withdrawals ──────────────────────────────────────────
/**
 * Body: { id, action: "approved" | "rejected" | "paid", admin_note? }
 *
 * approved  — admin has manually sent the money from their bank to the user.
 *             Notifies user that payment is on its way.
 * rejected  — refunds the full gross amount back to user's wallet via
 *             money_refund_withdrawal(). Notifies user with 3-business-day message.
 * paid      — admin confirms the user received the money (terminal state).
 *             Notifies user.
 */
export async function PATCH(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!user.is_admin) return new Response("Forbidden", { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    action?: string;
    admin_note?: string;
  } | null;

  if (!body?.id || !body?.action) {
    return Response.json({ ok: false, code: "missing_fields" }, { status: 400 });
  }
  if (!VALID_ACTIONS.has(body.action)) {
    return Response.json({ ok: false, code: "invalid_action" }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // Fetch the withdrawal request
  const { data: wr, error: fetchErr } = await supabase
    .from("withdrawal_requests")
    .select("*")
    .eq("id", body.id)
    .single();

  if (fetchErr || !wr) {
    return Response.json({ ok: false, code: "not_found" }, { status: 404 });
  }

  const gross = `₦${(wr.amount_kobo / 100).toLocaleString("en-NG")}`;
  const netKobo: number = wr.net_kobo ?? Math.floor(wr.amount_kobo * 0.985);
  const net = `₦${(netKobo / 100).toLocaleString("en-NG")}`;

  // ── REJECT ────────────────────────────────────────────────────────────────
  if (body.action === "rejected") {
    if (wr.status !== "pending") {
      return Response.json({ ok: false, code: "wrong_status", error: "Can only reject a pending request" }, { status: 409 });
    }

    // Refund the full gross amount back to wallet
    const refundResult = await db.rpc<{ ok: boolean; code?: string }>(
      "money_refund_withdrawal",
      { p_user_id: wr.user_id, p_amount_kobo: wr.amount_kobo, p_withdrawal_id: wr.id },
    );

    if (!refundResult?.ok) {
      return Response.json(
        { ok: false, code: refundResult?.code ?? "refund_failed", error: "Could not refund wallet. Please try again." },
        { status: 500 },
      );
    }

    await supabase
      .from("withdrawal_requests")
      .update({ status: "rejected", admin_note: body.admin_note ?? null, resolved_at: new Date().toISOString(), resolved_by: user.id })
      .eq("id", body.id);

    const noteText = body.admin_note?.trim() ? ` Reason: ${body.admin_note.trim()}.` : "";
    void notify(db, {
      userId: wr.user_id,
      kind: "payment_failed",
      title: "Withdrawal rejected",
      body: `Your withdrawal of ${gross} was not approved.${noteText} ${gross} has been refunded to your Lumora wallet. If it doesn't appear within 3 business days please contact support.`,
      data: { withdrawal_id: wr.id },
    }).catch(() => null);

    return Response.json({ ok: true, action: "rejected" });
  }

  // ── APPROVE ───────────────────────────────────────────────────────────────
  if (body.action === "approved") {
    if (wr.status !== "pending") {
      return Response.json({ ok: false, code: "wrong_status", error: "Can only approve a pending request" }, { status: 409 });
    }

    const { error: updateErr } = await supabase
      .from("withdrawal_requests")
      .update({ status: "approved", admin_note: body.admin_note ?? null, resolved_at: new Date().toISOString(), resolved_by: user.id })
      .eq("id", body.id);

    if (updateErr) return Response.json({ ok: false, error: updateErr.message }, { status: 500 });

    void notify(db, {
      userId: wr.user_id,
      kind: "payout_sent",
      title: "Withdrawal approved — payment on its way",
      body: `Your withdrawal of ${gross} was approved. ${net} is being transferred to ${wr.account_name} (${wr.bank_name} · ${wr.account_number}).`,
      data: { withdrawal_id: wr.id },
    }).catch(() => null);

    return Response.json({ ok: true, action: "approved" });
  }

  // ── PAID ─────────────────────────────────────────────────────────────────
  if (body.action === "paid") {
    if (wr.status !== "approved") {
      return Response.json({ ok: false, code: "wrong_status", error: "Can only mark an approved request as paid" }, { status: 409 });
    }

    const { error: updateErr } = await supabase
      .from("withdrawal_requests")
      .update({ status: "paid", admin_note: body.admin_note ?? wr.admin_note })
      .eq("id", body.id);

    if (updateErr) return Response.json({ ok: false, error: updateErr.message }, { status: 500 });

    void notify(db, {
      userId: wr.user_id,
      kind: "payout_sent",
      title: "Withdrawal paid ✓",
      body: `${net} has been sent to ${wr.account_name} (${wr.bank_name}). Check your bank account shortly.`,
      data: { withdrawal_id: wr.id },
    }).catch(() => null);

    return Response.json({ ok: true, action: "paid" });
  }

  return Response.json({ ok: false, code: "unhandled" }, { status: 400 });
}
