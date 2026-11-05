import type { Metadata } from "next";

import { ActionScreen } from "@/components/bookings/action-screen";

// Each link is different and only the person it was sent to can use it, so there's nothing to prerender.
export const instant = false;

// The token in this address must never reach search engines or another site's logs.
export const metadata: Metadata = { title: "Lumora", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function ActionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ActionScreen token={token} />;
}
