import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/** Stores a delivery photo under a random name and returns its address. */
export async function storeDeliveryPhoto(file: File, userId: string): Promise<string | null> {
  const extension = TYPES[file.type];
  if (!extension || file.size > MAX_PHOTO_BYTES) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase isn't configured");

  const storage = createClient(url, key, { auth: { persistSession: false } }).storage.from("delivery-photos");
  const path = `${userId}/${randomUUID()}.${extension}`;
  const { error } = await storage.upload(path, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  return storage.getPublicUrl(path).data.publicUrl;
}
