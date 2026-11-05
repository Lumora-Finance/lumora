"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuthUser } from "@/components/auth/use-auth-user";
import { apiFetch } from "@/lib/logistics/client";
import { cn } from "@/lib/utils";

type Item = { id: string; title: string; body: string; href: string; read: boolean; createdAt: string };

const POLL_MS = 60_000;

const ago = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
};

/** The top bar's bell: unread count, and a list where each item opens its booking. */
export function NotificationBell({ className }: { className?: string }) {
  const { user } = useAuthUser();
  const root = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const response = await apiFetch(user, "/api/notifications").catch(() => null);
    if (!response?.ok) return;
    const data = (await response.json()) as { unread: number; items: Item[] };
    setItems(data.items);
    setUnread(data.unread);
  }, [user]);

  useEffect(() => {
    // Loading from the API is the external system this effect stays in step with.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  async function markRead(id?: string) {
    if (!user) return;
    setItems((current) => current.map((item) => (!id || item.id === id ? { ...item, read: true } : item)));
    setUnread((count) => (id ? Math.max(count - 1, 0) : 0));
    await apiFetch(user, "/api/notifications", { id }).catch(() => null);
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn("relative flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-sage-soft hover:text-ink", className)}
      >
        <Bell strokeWidth={1.5} className="size-5" />
        {unread > 0 && (
          <span className="font-num absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber px-1 text-[10px] leading-none font-medium text-ink">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-14 z-40 flex max-h-[70svh] flex-col overflow-hidden rounded-xl border border-line bg-white sm:absolute sm:inset-x-auto sm:top-11 sm:right-0 sm:w-[360px]">
          <div className="flex items-center justify-between border-b border-line px-4 py-2">
            <h2 className="font-semibold text-ink">Notifications</h2>
            {unread > 0 && (
              <button type="button" onClick={() => markRead()} className="min-h-9 text-body-sm text-ink-muted underline underline-offset-4 hover:text-ink">
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-ink-muted">Nothing yet. Updates on your bookings show up here.</p>
          ) : (
            <ul className="overflow-y-auto">
              {items.map((item) => (
                <li key={item.id} className="border-b border-line last:border-b-0">
                  <Link
                    href={item.href}
                    onClick={() => {
                      setOpen(false);
                      if (!item.read) void markRead(item.id);
                    }}
                    className={cn("block px-4 py-3 hover:bg-sage-soft", !item.read && "bg-amber-soft/40")}
                  >
                    <span className={cn("block text-body-sm text-ink", !item.read && "font-medium")}>{item.title}</span>
                    {item.body && <span className="mt-0.5 block text-body-sm text-ink-muted">{item.body}</span>}
                    <span className="mt-1 block text-xs text-ink-muted">{ago(item.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
