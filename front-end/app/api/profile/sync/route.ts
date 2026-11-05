import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { firebaseUid } from "@/lib/money/auth";

/**
 * POST /api/profile/sync
 * Body: { email, display_name, photo_url }
 *
 * Upserts a row in the `profiles` table keyed on firebase_uid.
 * Called from onboarding and whenever the user's Firebase profile changes.
 */
export async function POST(request: Request) {
  await connection();

  const uid = await firebaseUid(request);
  if (!uid) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    display_name?: string;
    photo_url?: string;
  } | null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase.rpc("upsert_profile", {
    p_firebase_uid: uid,
    p_email: body?.email ?? "",
    p_display_name: body?.display_name ?? "",
    p_photo_url: body?.photo_url ?? "",
  });

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, profile: data });
}
