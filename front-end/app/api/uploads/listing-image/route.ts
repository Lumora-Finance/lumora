import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { connection } from "next/server";

import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * POST /api/uploads/listing-image?bucket=demand-listing-images|farmer-listing-images
 * Uploads a single image to the specified bucket and returns its public URL.
 */
export async function POST(request: Request) {
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const bucket = new URL(request.url).searchParams.get("bucket");
  if (bucket !== "demand-listing-images" && bucket !== "farmer-listing-images") {
    return Response.json({ ok: false, code: "invalid_bucket" }, { status: 400 });
  }

  const file = (await request.formData()).get("photo");
  if (!(file instanceof File)) return Response.json({ ok: false, code: "no_photo" }, { status: 400 });

  const extension = TYPES[file.type];
  if (!extension || file.size > MAX_BYTES) {
    return Response.json({ ok: false, code: "invalid_photo" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ ok: false, code: "server_error" }, { status: 500 });

  const storage = createClient(url, key, { auth: { persistSession: false } }).storage.from(bucket);
  const path = `${user.id}/${randomUUID()}.${extension}`;
  const { error } = await storage.upload(path, file, { contentType: file.type });
  if (error) return Response.json({ ok: false, code: "upload_failed", error: error.message }, { status: 500 });

  return Response.json({ ok: true, url: storage.getPublicUrl(path).data.publicUrl });
}
