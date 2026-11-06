import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/**
 * GET /api/dashboard/transactions
 *
 * Returns every money movement for the signed-in user, newest first:
 *  - Wallet deposits (external → buyer_available)
 *  - Trade settlements (farmer payout credited from a delivery)
 *  - Wallet withdrawals (buyer_available / farmer_paid → external)
 *  - Escrow holds and releases (buyer_available ↔ buyer_reserved)
 *  - Any other ledger entry that involves the user
 *
 * Each row is normalised to:
 *   { id, kind, label, amount_kobo, direction, status, ref, created_at, detail }
 */
export async function GET(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const uid = user.id;

  // 1. All ledger rows where this user is either sender or receiver
  const { data: ledger } = await supabase
    .from("money_ledger")
    .select("id, from_bucket, from_owner, to_bucket, to_owner, amount_kobo, booking_id, reason, created_at")
    .or(`from_owner.eq.${uid},to_owner.eq.${uid}`)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!ledger || ledger.length === 0) return Response.json([]);

  // 2. Gather booking IDs so we can join commodity/code info
  const bookingIds = [...new Set(ledger.map((r) => r.booking_id).filter(Boolean))] as string[];

  let bookingMap: Record<string, { code: string; commodity: string }> = {};
  if (bookingIds.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, code, slot:slots(listing:demand_listings(commodity:commodities(name)))")
      .in("id", bookingIds);

    for (const b of bookings ?? []) {
      const raw = b as {
        id: string; code: string;
        slot?: { listing?: { commodity?: { name?: string } } } | null;
      };
      bookingMap[raw.id] = {
        code: raw.code,
        commodity: raw.slot?.listing?.commodity?.name ?? "Trade",
      };
    }
  }

  // 3. Also pull deposit refs for labelling
  const { data: deposits } = await supabase
    .from("money_deposits")
    .select("amount_kobo, tx_ref, created_at")
    .eq("buyer_id", uid)
    .order("created_at", { ascending: false })
    .limit(50);

  // Build a quick lookup: round amount+timestamp key → tx_ref
  const depositRef = new Map<string, string>();
  for (const d of deposits ?? []) {
    const key = `${d.amount_kobo}`;
    if (!depositRef.has(key)) depositRef.set(key, String(d.tx_ref ?? ""));
  }

  // 4. Normalise every ledger row into a unified transaction shape
  type TxRow = {
    id: string;
    kind: "deposit" | "withdrawal" | "trade" | "hold" | "release" | "fee" | "other";
    label: string;
    amount_kobo: number;
    /** credit = money came in for this user, debit = money went out */
    direction: "credit" | "debit";
    status: "completed" | "pending";
    ref: string;
    created_at: string;
    detail: string;
  };

  const rows: TxRow[] = ledger.map((r) => {
    const isCredit = r.to_owner === uid;
    const booking = r.booking_id ? bookingMap[r.booking_id] : null;
    const reason: string = r.reason ?? "";

    let kind: TxRow["kind"] = "other";
    let label = reason;

    if (r.from_bucket === "external" && r.to_bucket === "buyer_available") {
      kind = "deposit";
      label = "Wallet funding";
    } else if ((r.from_bucket === "buyer_available" || r.from_bucket === "farmer_paid") && r.to_bucket === "external") {
      kind = "withdrawal";
      label = "Withdrawal";
    } else if (r.to_bucket === "farmer_pending" || r.to_bucket === "farmer_paid") {
      kind = "trade";
      label = booking ? `${booking.commodity} — delivery payout` : "Trade settlement";
    } else if (r.from_bucket === "buyer_available" && r.to_bucket === "buyer_reserved") {
      kind = "hold";
      label = booking ? `Hold for ${booking.commodity} booking` : "Booking hold";
    } else if (r.from_bucket === "buyer_reserved" && r.to_bucket === "buyer_available") {
      kind = "release";
      label = booking ? `Hold released — ${booking.commodity}` : "Hold released";
    } else if (r.to_bucket === "lumora_revenue" || r.from_bucket === "lumora_revenue") {
      kind = "fee";
      label = reason.includes("deposit") ? "Provider fee on deposit" : "Platform fee";
    }

    const ref = booking?.code
      ?? (kind === "deposit" ? (depositRef.get(String(r.amount_kobo)) ?? "").slice(0, 12) : "")
      ?? String(r.id).slice(0, 8).toUpperCase();

    return {
      id: String(r.id),
      kind,
      label,
      amount_kobo: Number(r.amount_kobo),
      direction: isCredit ? "credit" : "debit",
      status: "completed",
      ref,
      created_at: r.created_at,
      detail: booking ? `Booking ${booking.code} · ${booking.commodity}` : reason,
    };
  });

  return Response.json(rows);
}
