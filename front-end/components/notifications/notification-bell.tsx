"use client";

import {
  Bell, Check, DollarSign, Package, ShieldAlert, Star, Truck, X, Loader2, RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getAuth } from "firebase/auth";

import app from "@/lib/firebase/config";
import { cn } from "@/lib/utils";

export type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  booking_id: string | null;
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
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

function notifLink(notif: Notification): string | null {
  const d = notif.data ?? {};
  if (notif.booking_id) return `/dashboard/bookings/${notif.booking_id}`;
  if (d.booking_id) return `/dashboard/bookings/${d.booking_id}`;
  if (notif.kind === "new_supply_listing") return `/dashboard/marketplace`;
  if (notif.kind === "new_demand" || d.listing_id) return `/dashboard/board`;
  return null;
}

function KindIcon({ kind }: { kind: string }) {
  const isPayout = kind.includes("payout") || kind.includes("payment") || kind.includes("receipt");
  const isBooking = kind.includes("booking") || kind.includes("confirm") || kind.includes("approval");
  const isAlert = kind.includes("dispute") || kind.includes("no_show") || kind.includes("paused") ||
    kind.includes("failed") || kind.includes("nocode") || kind.includes("declined");
  const isDelivery = kind.includes("delivery") || kind.includes("weigh") || kind.includes("record");
  const isDemand = kind.includes("demand") || kind.includes("supply") || kind.includes("offer") ||
    kind.includes("capacity") || kind.includes("freed");
  const isRating = kind.includes("rating") || kind.includes("review");

  if (isAlert) return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-danger/10">
      <ShieldAlert strokeWidth={1.5} className="size-4 text-danger" />
    </span>
  );
  if (isPayout) return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage-soft">
      <DollarSign strokeWidth={1.5} className="size-4 text-green" />
    </span>
  );
  if (isDelivery) return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-soft">
      <Truck strokeWidth={1.5} className="size-4 text-amber-700" />
    </span>
  );
  if (isBooking) return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage-soft">
      <Check strokeWidth={1.75} className="size-4 text-green" />
    </span>
  );
  if (isDemand) return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage-soft">
      <Package strokeWidth={1.5} className="size-4 text-green" />
    </span>
  );
  if (isRating) return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-soft">
      <Star strokeWidth={1.5} className="size-4 text-amber-700" />
    </span>
  );
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-line">
      <Bell strokeWidth={1.5} className="size-4 text-ink-muted" />
    </span>
  );
}

export function NotificationBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const token = await getAuth(app).currentUser?.getIdToken();
      const res = await fetch("/api/notifications", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = (await res.json()) as Notification[];
        setNotifications(Array.isArray(data) ? data : []);
      }
    } catch { /* silent */ } finally {
      if (!silent) setLoading(false);
    }
  }

  async function markRead(ids: string[]) {
    const token = await getAuth(app).currentUser?.getIdToken();
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ids }),
    }).catch(() => {});
    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)),
    );
  }

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 30_000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    const timer = setTimeout(() => markRead(unreadIds), 1500);
    return () => clearTimeout(timer);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "relative flex size-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-sage-soft hover:text-ink",
          open && "bg-sage-soft text-ink",
          className,
        )}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
      >
        <Bell strokeWidth={1.5} className="size-5" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-danger px-1 font-num text-[10px] font-bold leading-none text-paper"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[340px] overflow-hidden rounded-2xl border border-line bg-paper shadow-2xl md:w-[380px]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h3 className="font-medium text-ink">Notifications</h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => load()}
                aria-label="Refresh"
                className="flex size-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-sage-soft hover:text-ink"
              >
                {loading
                  ? <Loader2 strokeWidth={1.5} className="size-4 animate-spin" />
                  : <RefreshCw strokeWidth={1.5} className="size-4" />}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex size-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-sage-soft hover:text-ink"
              >
                <X strokeWidth={1.5} className="size-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="max-h-[460px] overflow-y-auto overscroll-contain">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 strokeWidth={1.5} className="size-5 animate-spin text-ink-muted" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Bell strokeWidth={1} className="mx-auto mb-3 size-8 text-ink-muted/30" />
                <p className="text-body-sm font-medium text-ink">All quiet</p>
                <p className="mt-1 text-body-sm text-ink-muted">
                  Booking confirmations, delivery updates and payments will appear here.
                </p>
              </div>
            ) : (
              <ul>
                {notifications.map((notif) => {
                  const link = notifLink(notif);
                  const inner = (
                    <div
                      className={cn(
                        "flex items-start gap-3 px-4 py-3.5 transition-colors",
                        !notif.read && "bg-sage-soft/20",
                        link && "cursor-pointer hover:bg-sage-soft/40",
                      )}
                    >
                      <KindIcon kind={notif.kind} />
                      <div className="min-w-0 flex-1">
                        <p className="text-body-sm font-medium text-ink leading-snug">
                          {notif.title || notif.kind.replace(/_/g, " ")}
                        </p>
                        <p className="mt-0.5 text-body-sm text-ink-muted leading-relaxed">
                          {notif.body || "Tap to view details."}
                        </p>
                        <p className="mt-1 font-num text-label text-ink-muted">
                          {relDate(notif.created_at)}
                        </p>
                      </div>
                      {!notif.read && (
                        <span aria-label="Unread" className="mt-2 size-2 shrink-0 rounded-full bg-green" />
                      )}
                    </div>
                  );

                  return (
                    <li key={notif.id} className="border-b border-line last:border-0">
                      {link ? (
                        <Link
                          href={link}
                          onClick={() => { setOpen(false); if (!notif.read) markRead([notif.id]); }}
                        >
                          {inner}
                        </Link>
                      ) : inner}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="border-t border-line px-4 py-2.5">
              <Link
                href="/dashboard/bookings"
                onClick={() => setOpen(false)}
                className="block text-center text-body-sm font-medium text-ink-muted transition-colors hover:text-green"
              >
                View all activity
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
