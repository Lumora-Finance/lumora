import { requestUser } from "@/lib/money/auth";
import { bookSlot } from "@/lib/money/booking";
import { serverMoneyDb } from "@/lib/money/db";

/**
 * POST /api/money/slots/:id/book
 *
 * Body:
 *   qty               – number of units to book (required)
 *   offeredPriceKobo  – the price the farmer accepts (optional).
 *                       Must be within the listing's price range
 *                       [unit_price_min_kobo, unit_price_kobo].
 *                       Defaults to the listing's max price when omitted.
 *
 * The buyer's wallet is always charged at the listing's MAX price upfront.
 * At settlement, the difference (max − offered) × measured_weight is
 * automatically refunded to the buyer's wallet in the same transaction.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    qty?: number;
    offeredPriceKobo?: number;
  } | null;

  if (!Number.isInteger(body?.qty) || (body?.qty ?? 0) <= 0) {
    return Response.json({ ok: false, code: "invalid_quantity" }, { status: 400 });
  }

  // Validate offered price is a positive integer if provided
  if (
    body?.offeredPriceKobo !== undefined &&
    (!Number.isInteger(body.offeredPriceKobo) || body.offeredPriceKobo <= 0)
  ) {
    return Response.json({ ok: false, code: "invalid_price" }, { status: 400 });
  }

  const result = await bookSlot(
    {
      slotId: id,
      farmerId: user.id,
      qty: body?.qty as number,
      offeredPriceKobo: body?.offeredPriceKobo,
    },
    { db },
  );

  return Response.json(result, { status: result.ok ? 200 : 409 });
}
