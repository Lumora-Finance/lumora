import { requestUser } from "@/lib/money/auth";
import { bookSlot } from "@/lib/money/booking";
import { serverMoneyDb } from "@/lib/money/db";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { qty?: number } | null;
  if (!Number.isInteger(body?.qty)) return Response.json({ ok: false, code: "invalid_quantity" }, { status: 400 });

  const result = await bookSlot(
    { slotId: id, farmerId: user.id, qty: body?.qty as number },
    { db },
  );
  return Response.json(result, { status: result.ok ? 200 : 409 });
}
