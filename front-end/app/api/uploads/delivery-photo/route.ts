import { storeDeliveryPhoto } from "@/lib/logistics/storage";
import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

export async function POST(request: Request) {
  const user = await requestUser(request, serverMoneyDb());
  if (!user) return new Response("Unauthorized", { status: 401 });
  const file = (await request.formData()).get("photo");
  if (!(file instanceof File)) return Response.json({ ok: false, code: "no_photo" }, { status: 400 });
  const url = await storeDeliveryPhoto(file, user.id);
  if (!url) return Response.json({ ok: false, code: "invalid_photo" }, { status: 400 });
  return Response.json({ ok: true, url });
}
