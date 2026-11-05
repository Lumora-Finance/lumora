import { connection } from "next/server";

import { serverMoneyDb } from "@/lib/money/db";
import { createPaystackClient } from "@/lib/money/paystack";
import { runMoneyJob, runReconciliation } from "@/lib/money/jobs";
import { secretMatches } from "@/lib/money/secret";
import { createSmsSender } from "@/lib/money/sms-sender";


/** `?task=reconcile` runs the nightly check. Otherwise this is the 5-minute job. */
export async function GET(request: Request) {
  // Personal to each request, so it must never be prerendered at build time.
  await connection();
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!secretMatches(token, process.env.CRON_SECRET)) {
    return new Response("Forbidden", { status: 403 });
  }

  const db = serverMoneyDb();
  const paystack = createPaystackClient();

  if (new URL(request.url).searchParams.get("task") === "reconcile") {
    return Response.json(await runReconciliation({ db, paystack }));
  }

  return Response.json(await runMoneyJob({ db, paystack, sms: createSmsSender() }));
}
