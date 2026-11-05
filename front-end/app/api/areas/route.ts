import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/areas?q=bukuru
 * Public — no auth needed. Returns Plateau State areas from DB.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  let query = supabase
    .from("areas")
    .select("name, lga, lat, lng")
    .order("position");

  if (q) query = query.ilike("name", `%${q}%`);

  const { data, error } = await query.limit(40);
  if (error) return Response.json([]);
  return Response.json(data ?? []);
}
