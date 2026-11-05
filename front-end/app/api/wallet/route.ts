import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/**
 * GET /api/wallet
 * Returns the authenticated user's wallet balances and recent history.
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

  // Available balance from money_balances
  const { data: balances } = await supabase
    .from("money_balances")
    .select("bucket, balance_kobo")
    .eq("owner_id", user.id);

  const balanceMap = Object.fromEntries(
    (balances ?? []).map((b: { bucket: string; balance_kobo: number }) => [b.bucket, b.balance_kobo]),
  );

  const available = balanceMap["buyer_available"] ?? balanceMap["farmer_pending"] ?? 0;
  const reserved = balanceMap["buyer_reserved"] ?? 0;

  // Recent settlements for history
  const { data: settlements } = await supabase
    .from("money_settlements")
    .select("id, gross_kobo, net_kobo, kind, created_at, booking:bookings(code, slot:slots(listing:demand_listings(commodity:commodities(name))))")
    .eq("farmer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Recent withdrawal requests for history
  const { data: withdrawals } = await supabase
    .from("withdrawal_requests")
    .select("id, amount_kobo, status, bank_name, requested_at")
    .eq("user_id", user.id)
    .order("requested_at", { ascending: false })
    .limit(10);

  // Merge and sort history
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
    ...(withdrawals ?? []).map((w: Record<string, unknown>) => ({
      id: String(w.id),
      kind: "withdrawal" as const,
      amount_kobo: -Number(w.amount_kobo),
      status: (w.status === "paid" ? "completed" : w.status === "rejected" ? "failed" : "pending") as "completed" | "pending" | "failed",
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
