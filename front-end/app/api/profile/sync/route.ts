import { connection } from "next/server";

import { firebaseUid } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

/**
 * POST /api/profile/sync
 * Body: { email, display_name, photo_url }
 *
 * Syncs Firebase auth data into the users table.
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

  // Use logistics_save_profile to update the users table via the existing RPC.
  // The firebase_uid is the key — it upserts name and phone.
  // For display_name and photo_url, we update directly.
  const db = serverMoneyDb();

  // First ensure the user row exists (logistics_save_profile handles upsert by firebase_uid)
  // Then update display_name and photo_url
  try {
    // Update display_name and photo_url on the users table directly
    // The user must already exist (created via onboarding or /api/me POST)
    const supabaseModule = await import("@supabase/supabase-js");
    const supabase = supabaseModule.createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const { error } = await supabase
      .from("users")
      .update({
        display_name: body?.display_name ?? null,
        photo_url: body?.photo_url ?? null,
        email: body?.email ?? null,
      })
      .eq("firebase_uid", uid);

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
