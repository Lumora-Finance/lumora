/**
 * GET /api/wallet/banks
 * Returns the list of Nigerian banks from Paystack.
 * Cached for 24 hours — the list rarely changes.
 */
export async function GET() {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    // Demo fallback
    return Response.json([
      { name: "GTBank", code: "058" },
      { name: "Access Bank", code: "044" },
      { name: "UBA", code: "033" },
      { name: "Zenith Bank", code: "057" },
      { name: "First Bank", code: "011" },
      { name: "Stanbic IBTC", code: "221" },
      { name: "Opay", code: "100004" },
      { name: "Kuda Bank", code: "090267" },
      { name: "Wema Bank", code: "035" },
      { name: "Fidelity Bank", code: "070" },
    ]);
  }

  const res = await fetch("https://api.paystack.co/bank?currency=NGN&perPage=100", {
    headers: { Authorization: `Bearer ${secretKey}` },
    next: { revalidate: 86400 }, // cache 24h
  });

  if (!res.ok) {
    return Response.json({ error: "Could not fetch banks" }, { status: 502 });
  }

  const data = (await res.json()) as { data?: Array<{ name: string; code: string }> };
  const banks = (data.data ?? [])
    .filter((b) => b.name && b.code)
    .sort((a, b) => a.name.localeCompare(b.name));

  return Response.json(banks);
}
