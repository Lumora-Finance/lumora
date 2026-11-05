import { serverMoneyDb } from "@/lib/money/db";
import { createFlutterwaveClient } from "@/lib/money/flutterwave";
import { runMoneyJob, runReconciliation } from "@/lib/money/jobs";
import { secretMatches } from "@/lib/money/secret";
import { createSmsSender } from "@/lib/money/sms-sender";

/** `?task=reconcile` runs the nightly check. Otherwise this is the 5-minute job. */
export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!secretMatches(token, process.env.CRON_SECRET)) {
    return new Response("Forbidden", { status: 403 });
  }

  const db = serverMoneyDb();
  const flutterwave = createFlutterwaveClient();
  if (new URL(request.url).searchParams.get("task") === "reconcile") {
    return Response.json(await runReconciliation({ db, flutterwave }));
  }
  return Response.json(await runMoneyJob({ db, flutterwave, sms: createSmsSender() }));
}
