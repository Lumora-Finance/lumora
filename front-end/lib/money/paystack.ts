import { createHmac, timingSafeEqual } from "node:crypto";

const BASE_URL = "https://api.paystack.co";

export class PaystackRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaystackRejected";
  }
}

export type PaystackTransactionResult = {
  id: number;
  reference: string;
  status: string;
  amountKobo: number | null;
  feeKobo: number;
  currency: string;
  paymentChannel: string;
};

export type PaystackTransferResult = {
  id: number;
  reference: string;
  status: string;
  amountKobo: number;
  feeKobo: number;
};

export type PaystackClient = {
  /** Initialise a one-time Paystack payment page (Checkout). */
  initializeTransaction(params: {
    reference: string;
    amountKobo: number;
    email: string;
    callbackUrl?: string;
    channels?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<{ authorizationUrl: string; accessCode: string }>;

  /** Verify a transaction by reference. */
  verifyTransaction(reference: string): Promise<PaystackTransactionResult>;

  /** Issue a refund for a Paystack transaction. */
  refund(transactionId: number, amountKobo: number): Promise<void>;

  /** Resolve bank account (verify account number). Returns account name. */
  resolveAccount(bankCode: string, accountNumber: string): Promise<string>;

  /** Create a Paystack customer. Returns customer_code. */
  createCustomer(params: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }): Promise<string>;

  /** Create a dedicated virtual account for a customer. */
  createDedicatedVirtualAccount(params: { customerId: string }): Promise<{
    accountNumber: string;
    bankName: string;
  }>;

  /** Create a transfer recipient. Returns recipient_code. */
  createTransferRecipient(params: {
    bankCode: string;
    accountNumber: string;
    accountName: string;
  }): Promise<string>;

  /** Create a transfer. Returns minimal transfer info. */
  createTransfer(params: {
    reference: string;
    amountKobo: number;
    recipientCode: string;
    reason?: string;
  }): Promise<PaystackTransferResult>;

  /** Find a transfer by reference. Returns null when not found. */
  findTransferByReference(reference: string): Promise<PaystackTransferResult | null>;

  /** Fetch a transfer by transfer_code. */
  getTransfer(transferCode: string): Promise<PaystackTransferResult>;

  /** Balance of the Paystack balance ledger in kobo. */
  ledgerBalanceKobo(): Promise<number>;
};

async function paystackPost(secretKey: string, path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { status: boolean; message?: string; data?: unknown };
  if (!json.status) throw new PaystackRejected(json.message ?? `POST ${path} failed`);
  return json.data;
}

async function paystackGet(secretKey: string, path: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const json = (await res.json()) as { status: boolean; message?: string; data?: unknown };
  if (!json.status) throw new PaystackRejected(json.message ?? `GET ${path} failed`);
  return json.data;
}

export function createPaystackClient(secretKey?: string): PaystackClient {
  const key = secretKey ?? process.env.PAYSTACK_SECRET_KEY ?? "";

  return {
    async initializeTransaction({ reference, amountKobo, email, callbackUrl, channels, metadata }) {
      const data = (await paystackPost(key, "/transaction/initialize", {
        reference,
        amount: amountKobo,
        email,
        callback_url: callbackUrl,
        channels,
        metadata,
      })) as { authorization_url: string; access_code: string };
      return { authorizationUrl: data.authorization_url, accessCode: data.access_code };
    },

    async verifyTransaction(reference) {
      const data = (await paystackGet(
        key,
        `/transaction/verify/${encodeURIComponent(reference)}`,
      )) as {
        id: number;
        reference: string;
        status: string;
        amount: number;
        fees: number | null;
        currency: string;
        channel: string;
      };
      return {
        id: data.id,
        reference: data.reference,
        status: data.status,
        amountKobo: data.amount ?? null,
        feeKobo: data.fees ?? 0,
        currency: data.currency ?? "NGN",
        paymentChannel: data.channel ?? "unknown",
      };
    },

    async refund(transactionId, amountKobo) {
      await paystackPost(key, "/refund", {
        transaction: transactionId,
        amount: amountKobo,
      });
    },

    async resolveAccount(bankCode, accountNumber) {
      const data = (await paystackGet(
        key,
        `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      )) as { account_name: string };
      return data.account_name;
    },

    async createCustomer({ email, firstName, lastName, phone }) {
      const data = (await paystackPost(key, "/customer", {
        email,
        first_name: firstName,
        last_name: lastName,
        phone,
      })) as { customer_code: string };
      return data.customer_code;
    },

    async createDedicatedVirtualAccount({ customerId }) {
      const data = (await paystackPost(key, "/dedicated_account", {
        customer: customerId,
        preferred_bank: "wema-bank",
      })) as { account_number: string; bank: { name: string } };
      return { accountNumber: data.account_number, bankName: data.bank.name };
    },

    async createTransferRecipient({ bankCode, accountNumber, accountName }) {
      const data = (await paystackPost(key, "/transferrecipient", {
        type: "nuban",
        name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: "NGN",
      })) as { recipient_code: string };
      return data.recipient_code;
    },

    async createTransfer({ reference, amountKobo, recipientCode, reason }) {
      const data = (await paystackPost(key, "/transfer", {
        source: "balance",
        reference,
        amount: amountKobo,
        recipient: recipientCode,
        reason: reason ?? "Lumora payout",
      })) as { id: number; reference: string; status: string; amount: number; transfer_charge: number };
      return {
        id: data.id,
        reference: data.reference,
        status: data.status,
        amountKobo: data.amount,
        feeKobo: data.transfer_charge ?? 0,
      };
    },

    async findTransferByReference(reference) {
      try {
        const data = (await paystackGet(
          key,
          `/transfer?reference=${encodeURIComponent(reference)}&perPage=1`,
        )) as Array<{ id: number; reference: string; status: string; amount: number; transfer_charge: number }>;
        if (!Array.isArray(data) || data.length === 0) return null;
        const t = data[0];
        return { id: t.id, reference: t.reference, status: t.status, amountKobo: t.amount, feeKobo: t.transfer_charge ?? 0 };
      } catch {
        return null;
      }
    },

    async getTransfer(transferCode) {
      const data = (await paystackGet(key, `/transfer/${encodeURIComponent(transferCode)}`)) as {
        id: number;
        reference: string;
        status: string;
        amount: number;
        transfer_charge: number;
      };
      return {
        id: data.id,
        reference: data.reference,
        status: data.status,
        amountKobo: data.amount,
        feeKobo: data.transfer_charge ?? 0,
      };
    },

    async ledgerBalanceKobo() {
      const data = (await paystackGet(key, "/balance")) as
        | { balance: number }
        | Array<{ balance: number; currency: string }>;
      if (Array.isArray(data)) {
        const ngn = data.find((b) => b.currency === "NGN");
        return ngn?.balance ?? 0;
      }
      return (data as { balance: number }).balance ?? 0;
    },
  };
}

/** Verify Paystack's HMAC-SHA512 webhook signature. Fails closed: with no key set, nothing is trusted. */
export function verifyWebhookSignature(
  signature: string | null | undefined,
  rawBody: string,
  secretKey: string | undefined,
): boolean {
  if (!secretKey || !signature) return false;
  const expected = Buffer.from(createHmac("sha512", secretKey).update(rawBody).digest("hex"));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
