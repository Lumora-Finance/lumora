import { timingSafeEqual } from "node:crypto";

import { koboToNaira, nairaToKobo } from "./rules";

/** Details checked against the v3 docs are listed in docs/money-flow.md, as are the ones that aren't. */
export type FlwTransaction = {
  id: number;
  status: string;
  amountKobo: number | null;
  currency: string;
  txRef: string;
  paymentType: string;
  feeKobo: number;
};

export type FlwTransfer = {
  id: number;
  status: string;
  reference: string;
  amountKobo: number | null;
  feeKobo: number;
};

export type FlutterwaveClient = {
  verifyTransaction(id: number): Promise<FlwTransaction>;
  getTransfer(id: number): Promise<FlwTransfer>;
  findTransferByReference(reference: string): Promise<FlwTransfer | null>;
  createTransfer(input: {
    reference: string;
    amountKobo: number;
    bankCode: string;
    accountNumber: string;
    accountName: string | null;
  }): Promise<FlwTransfer>;
  retryTransfer(id: number): Promise<FlwTransfer>;
  resolveAccount(bankCode: string, accountNumber: string): Promise<string>;
  ledgerBalanceKobo(): Promise<number>;
  refund(transactionId: number, amountKobo: number): Promise<void>;
  createVirtualAccount(input: {
    txRef: string;
    email: string;
    bvn: string;
    name: string;
  }): Promise<{ accountNumber: string; bankName: string; orderRef: string | null }>;
};

/** Flutterwave refused the request, as opposed to a network failure where the outcome is unknown. */
export class FlutterwaveRejected extends Error {}

/** Fails closed: no secret set, or no header, means the webhook isn't trusted. */
export function verifyWebhookSignature(header: string | null, secretHash: string | undefined) {
  if (!secretHash || !header) return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(secretHash);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const toKobo = (value: unknown) => (value === null || value === undefined ? null : nairaToKobo(value as string));

type RawTransfer = { id: number; status: string; reference: string; amount: unknown; fee?: unknown };

const toTransfer = (raw: RawTransfer): FlwTransfer => ({
  id: raw.id,
  status: String(raw.status).toUpperCase(),
  reference: raw.reference,
  amountKobo: toKobo(raw.amount),
  feeKobo: toKobo(raw.fee) ?? 0,
});

export function createFlutterwaveClient(
  secretKey = process.env.FLUTTERWAVE_SECRET_KEY,
  fetcher: typeof fetch = fetch,
  baseUrl = "https://api.flutterwave.com/v3",
): FlutterwaveClient {
  async function call<T>(path: string, init?: { method: string; body?: unknown }): Promise<T> {
    if (!secretKey) throw new Error("FLUTTERWAVE_SECRET_KEY is not set");
    const response = await fetcher(`${baseUrl}${path}`, {
      method: init?.method ?? "GET",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const payload = (await response.json().catch(() => null)) as { status?: string; message?: string; data?: T } | null;
    if (response.status >= 500 || !payload) throw new Error(`Flutterwave ${path}: HTTP ${response.status}`);
    if (!response.ok || payload.status !== "success") {
      throw new FlutterwaveRejected(payload.message ?? `Flutterwave ${path}: HTTP ${response.status}`);
    }
    return payload.data as T;
  }

  return {
    async verifyTransaction(id) {
      const data = await call<{
        id: number; status: string; amount: unknown; currency: string; tx_ref: string;
        payment_type: string; app_fee?: unknown;
      }>(`/transactions/${id}/verify`);
      return {
        id: data.id,
        status: String(data.status).toLowerCase(),
        amountKobo: toKobo(data.amount),
        currency: data.currency,
        txRef: data.tx_ref,
        paymentType: data.payment_type,
        feeKobo: toKobo(data.app_fee) ?? 0,
      };
    },
    getTransfer: async (id) => toTransfer(await call<RawTransfer>(`/transfers/${id}`)),
    async findTransferByReference(reference) {
      const rows = await call<RawTransfer[]>(`/transfers?reference=${encodeURIComponent(reference)}`);
      // The docs don't promise this parameter filters, so each row is checked.
      const match = rows.find((row) => row.reference === reference);
      return match ? toTransfer(match) : null;
    },
    async createTransfer({ reference, amountKobo, bankCode, accountNumber, accountName }) {
      return toTransfer(
        await call<RawTransfer>("/transfers", {
          method: "POST",
          body: {
            account_bank: bankCode,
            account_number: accountNumber,
            amount: Number(koboToNaira(amountKobo)),
            currency: "NGN",
            reference,
            narration: "Lumora payout",
            beneficiary_name: accountName ?? undefined,
          },
        }),
      );
    },
    retryTransfer: async (id) => toTransfer(await call<RawTransfer>(`/transfers/${id}/retries`, { method: "POST" })),
    async resolveAccount(bankCode, accountNumber) {
      const data = await call<{ account_name: string }>("/accounts/resolve", {
        method: "POST",
        body: { account_number: accountNumber, account_bank: bankCode },
      });
      return data.account_name;
    },
    async ledgerBalanceKobo() {
      const data = await call<{ ledger_balance: unknown }>("/balances/NGN");
      const kobo = toKobo(data.ledger_balance);
      if (kobo === null) throw new Error("Unreadable Flutterwave balance");
      return kobo;
    },
    async refund(transactionId, amountKobo) {
      await call(`/transactions/${transactionId}/refund`, {
        method: "POST",
        body: { amount: Number(koboToNaira(amountKobo)) },
      });
    },
    async createVirtualAccount({ txRef, email, bvn, name }) {
      const data = await call<{ account_number: string; bank_name: string; order_ref?: string }>(
        "/virtual-account-numbers",
        { method: "POST", body: { tx_ref: txRef, email, bvn, is_permanent: true, narration: name } },
      );
      return { accountNumber: data.account_number, bankName: data.bank_name, orderRef: data.order_ref ?? null };
    },
  };
}
