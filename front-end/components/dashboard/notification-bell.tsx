"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { getAuth } from "firebase/auth";
import { cn } from "@/lib/utils";
import app from "@/lib/firebase/config";

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  data: Record<string, string>;
  read: boolean;
  created_at: string;
};

function relDate(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

function notifLink(notif: Notification): string | null {
  const d = notif.data;
  if (d.listing_id) return `/dashboard/marketplace/${d.listing_id}`;
  if (d.booking_id) return `/dashboard/bookings/${d.booking_id}`;
  return null;
}

const KIND_STYLE: Record<string, string> = {
  offer_received: "bg-amber-soft text-amber",
  offer_accepted: "bg-sage-soft text-green",
  delivery_otp: "bg-danger/10 text-danger",
  booking_accepted: "bg-sage-soft text-green",
  payment_received: "bg-sage-soft text-green",
  booking_revoked: "bg-danger/10 text-danger",
  delivery_confirmed: "bg-sage-soft text-green",
};

const KIND_ICON: Record<string, string> = {
  offer_received: "💼",
  offer_accepted: "✅",
  delivery_otp: "🔑",
  payment_received: "💰",
  booking_revoked: "❌",
  delivery_confirmed: "✅",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

  async function load() {
    setLoading(true);
    try {
      const token = await getAuth(app).currentUser?.getIdToken();
      const res = await fetch("/api/notifications", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = (await res.json()) as Notification[];
        setNotifications(Array.isArray(data) ? data : []);
      }
    } catch { /* */ } finally {
      setLoading(false);
    }
  }

  async function markRead(ids: string[]) {
    const token = await getAuth(app).currentUser?.getIdToken();
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ ids }),
    }).catch(() => {});
    setNotifications((prev) => prev.map((n) => ids.includes(n.id) ? { ...n, read: true } : n));
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) {
      // Mark all unread as read when panel opens
      const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
      if (unreadIds.length > 0) setTimeout(() => markRead(unreadIds), 1000);
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex size-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-sage-soft hover:text-ink"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
      >
        <Bell strokeWidth={1.5} className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-danger font-num text-label font-bold text-paper">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[340px] overflow-hidden rounded-2xl border border-line bg-paper shadow-2xl md:w-[380px]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <h3 className="text-body font-medium text-ink">Notifications</h3>
            <div className="flex items-center gap-2">
              {loading && <Loader2 className="size-4 animate-spin text-ink-muted" />}
              <button onClick={() => setOpen(false)} className="flex size-7 items-center justify-center rounded-full text-ink-muted hover:bg-sage-soft hover:text-ink">
                <X strokeWidth={1.5} className="size-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-body-sm text-ink-muted">No notifications yet.</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const link = notifLink(notif);
                const Inner = (
                  <div className={cn(
                    "flex items-start gap-3 px-4 py-3.5 transition-colors",
                    notif.read ? "opacity-60" : "bg-sage-soft/20",
                    link && "hover:bg-sage-soft/40 cursor-pointer",
                  )}>
                    <span className="mt-0.5 text-xl shrink-0">{KIND_ICON[notif.kind] ?? "🔔"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm font-medium text-ink">{notif.title}</p>
                      <p className="mt-0.5 text-body-sm text-ink-muted leading-relaxed">{notif.body}</p>
                      <p className="mt-1 font-num text-label text-ink-muted">{relDate(notif.created_at)}</p>
                    </div>
                    {!notif.read && (
                      <span className="mt-2 size-2 shrink-0 rounded-full bg-green" />
                    )}
                  </div>
                );

                return (
                  <div key={notif.id} className="border-b border-line last:border-0">
                    {link ? (
                      <Link href={link} onClick={() => { setOpen(false); markRead([notif.id]); }}>
                        {Inner}
                      </Link>
                    ) : Inner}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
