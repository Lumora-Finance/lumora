import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/**
 * GET /api/wallet
 * Returns the authenticated user's wallet balances and recent history.
 * Always returns clean data — zero balances and empty history when nothing exists.
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

  // Available balance from money_balances — handle both buyer and farmer buckets
  let available = 0;
  let reserved = 0;

  try {
    const { data: balances } = await supabase
      .from("money_balances")
      .select("bucket, balance_kobo")
      .eq("owner_id", user.id);

    const balanceMap = Object.fromEntries(
      (balances ?? []).map((b: { bucket: string; balance_kobo: number }) => [b.bucket, b.balance_kobo]),
    );

    available = balanceMap["buyer_available"] ?? balanceMap["farmer_pending"] ?? 0;
    reserved = balanceMap["buyer_reserved"] ?? 0;
  } catch {
    // Balances not available — return zeros
  }

  // Recent deposits (funding) for history
  let deposits: Record<string, unknown>[] | null = null;
  try {
    const { data } = await supabase
      .from("money_deposits")
      .select("flw_tx_id, amount_kobo, created_at, tx_ref")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    deposits = data as Record<string, unknown>[] | null;
  } catch { deposits = null; }

  // Recent settlements for history
  let settlements: Record<string, unknown>[] | null = null;
  try {
    const { data } = await supabase
      .from("money_settlements")
      .select("id, gross_kobo, net_kobo, fees_kobo, kind, created_at, booking:bookings(code, slot:slots(listing:demand_listings(commodity:commodities(name))))")
      .eq("farmer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    settlements = data as Record<string, unknown>[] | null;
  } catch { settlements = null; }

  // Recent withdrawal requests for history
  let withdrawals: Record<string, unknown>[] | null = null;
  try {
    const { data } = await supabase
      .from("withdrawal_requests")
      .select("id, amount_kobo, status, bank_name, requested_at")
      .eq("user_id", user.id)
      .order("requested_at", { ascending: false })
      .limit(10);
    withdrawals = data as Record<string, unknown>[] | null;
  } catch { withdrawals = null; }

  type HistoryItem = {
    id: string;
    kind: "funding" | "withdrawal" | "settlement";
    amount_kobo: number;
    status: "completed" | "pending" | "failed";
    label: string;
    created_at: string;
    ref: string;
  };

  const history: HistoryItem[] = [
    // Deposits (funding)
    ...(deposits ?? []).map((d: Record<string, unknown>) => ({
      id: `dep-${d.flw_tx_id}`,
      kind: "funding" as const,
      amount_kobo: Number(d.amount_kobo),
      status: "completed" as const,
      label: "Wallet funding",
      created_at: String(d.created_at),
      ref: String(d.tx_ref ?? "").slice(0, 12),
    })),
    // Settlements (trade payouts)
    ...(settlements ?? []).map((s: Record<string, unknown>) => ({
      id: String(s.id),
      kind: "settlement" as const,
      amount_kobo: Number(s.net_kobo),
      status: "completed" as const,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      label: (s.booking as any)?.slot?.listing?.commodity?.name ?? "Settlement",
      created_at: String(s.created_at),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref: (s.booking as any)?.code ?? "",
    })),
    // Withdrawals
    ...(withdrawals ?? []).map((w: Record<string, unknown>) => ({
      id: String(w.id),
      kind: "withdrawal" as const,
      amount_kobo: -Number(w.amount_kobo),
      status: (w.status === "paid" ? "completed" : w.status === "rejected" || w.status === "failed" ? "failed" : "pending") as "completed" | "pending" | "failed",
      label: `Withdrawal to ${w.bank_name}`,
      created_at: String(w.requested_at),
      ref: String(w.id).slice(0, 8).toUpperCase(),
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const totalIn = history
    .filter((h) => h.amount_kobo > 0 && h.status === "completed")
    .reduce((s, h) => s + h.amount_kobo, 0);

  const totalOut = history
    .filter((h) => h.amount_kobo < 0 && h.status === "completed")
    .reduce((s, h) => s + Math.abs(h.amount_kobo), 0);

  const pendingOut = history
    .filter((h) => h.amount_kobo < 0 && h.status === "pending")
    .reduce((s, h) => s + Math.abs(h.amount_kobo), 0);

  return Response.json({
    available_kobo: available,
    reserved_kobo: reserved,
    total_in_kobo: totalIn,
    total_out_kobo: totalOut,
    pending_kobo: pendingOut,
    history,
  });
}
