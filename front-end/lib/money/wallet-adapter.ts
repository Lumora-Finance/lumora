import type { MoneyDb } from "./db";

/**
 * The only TypeScript that names a ledger function. Booking and settlement call the same `wallet_*`
 * functions from SQL, because they have to share one transaction. A different wallet means
 * replacing those functions. See "Needed from the wallet owner" in docs/money-flow.md.
 */
export type WalletAdapter = {
  getAvailable(buyerId: string): Promise<number>;
  reserve(bookingId: string, buyerId: string, amountKobo: number): Promise<void>;
  release(bookingId: string, amountKobo: number, reason: string): Promise<void>;
  settle(bookingId: string, farmerId: string, amountKobo: number): Promise<void>;
  markPaid(payoutId: string): Promise<void>;
  feeFromNextPayout(farmerId: string, amountKobo: number, reason: string): Promise<void>;
};

export function createWalletAdapter(db: MoneyDb): WalletAdapter {
  return {
    getAvailable: async (buyerId) =>
      Number(await db.rpc("wallet_get_available", { p_buyer: buyerId })),
    reserve: async (bookingId, buyerId, amountKobo) => {
      await db.rpc("wallet_reserve", { p_booking: bookingId, p_buyer: buyerId, p_amount: amountKobo });
    },
    release: async (bookingId, amountKobo, reason) => {
      await db.rpc("wallet_release", { p_booking: bookingId, p_amount: amountKobo, p_reason: reason });
    },
    settle: async (bookingId, farmerId, amountKobo) => {
      await db.rpc("wallet_settle", { p_booking: bookingId, p_farmer: farmerId, p_amount: amountKobo });
    },
    markPaid: async (payoutId) => {
      await db.rpc("wallet_mark_paid", { p_payout: payoutId });
    },
    feeFromNextPayout: async (farmerId, amountKobo, reason) => {
      await db.rpc("wallet_fee_from_next_payout", {
        p_farmer: farmerId,
        p_amount: amountKobo,
        p_reason: reason,
      });
    },
    // TODO(wallet owner): withdraw(userId, amountKobo). `wallet_withdraw` doesn't exist yet, and
    // api/wallet/withdraw sends transfers without touching the ledger.
  };
}
