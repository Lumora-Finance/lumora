import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Everything goes through database functions, so rules can't be bypassed from the app. */
export type MoneyDb = {
  rpc<T = MoneyResult>(fn: string, args?: Record<string, unknown>): Promise<T>;
};

export type MoneyResult = { ok: boolean; code?: string; duplicate?: boolean; [key: string]: unknown };

let client: SupabaseClient | undefined;

/** Server only. The service role bypasses row-level security. */
export function serverMoneyDb(): MoneyDb {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  client ??= createClient(url, key, { auth: { persistSession: false } });
  const supabase = client;

  return {
    async rpc<T>(fn: string, args: Record<string, unknown> = {}) {
      const { data, error } = await supabase.rpc(fn, args);
      if (error) throw new Error(`${fn}: ${error.message}`);
      return data as T;
    },
  };
}
