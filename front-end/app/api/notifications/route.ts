import { connection } from "next/server";

import { notificationCopy } from "@/lib/email/copy";
import type { Facts } from "@/lib/email/templates/types";
import { requestUser } from "@/lib/money/auth";
import { serverMoneyDb } from "@/lib/money/db";

type Row = { id: string; kind: string; booking_id: string | null; data: Facts; read_at: string | null; created_at: string };

/** The bell. Words come from the same templates as the emails, so the two can't drift apart. */
export async function GET(request: Request) {
  // Personal to each request, so it must never be prerendered at build time.
  await connection();
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { unread, items } = await db.rpc<{ unread: number; items: Row[] }>("money_notifications", { p_user: user.id });
  return Response.json({
    unread,
    items: items.map((row) => {
      const copy = notificationCopy(row.kind, row.data, row.created_at);
      return {
        id: row.id,
        title: copy.subject,
        body: copy.lines[0] ?? "",
        href: row.booking_id
          ? `/dashboard/bookings/${row.booking_id}`
          : copy.buttons.find((button) => button.href)?.href ?? "/dashboard",
        read: row.read_at !== null,
        createdAt: row.created_at,
      };
    }),
  });
}

/** Marks one as read, or with no id, all of them. */
export async function POST(request: Request) {
  const db = serverMoneyDb();
  const user = await requestUser(request, db);
  if (!user) return new Response("Unauthorized", { status: 401 });
  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  return Response.json(await db.rpc("money_notifications_read", { p_user: user.id, p_id: body?.id ?? null }));
}
