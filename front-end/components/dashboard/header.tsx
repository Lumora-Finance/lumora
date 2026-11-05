"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useProfile } from "@/components/auth/use-profile";
import { RouteProgress } from "@/components/loader/route-progress";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useDrawer } from "@/lib/gsap/use-drawer";
import { useToday } from "@/lib/use-today";
import { Sidebar } from "./sidebar";

export function DashboardHeader() {
  const { user, profile } = useProfile();
  const [mobileOpen, setMobileOpen] = useState(false);

  const photoURL = profile?.photo_url ?? user?.photoURL ?? null;
  const displayName = profile?.display_name ?? user?.displayName ?? user?.email?.split("@")[0] ?? "You";
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();

  const hour = useToday()?.getHours() ?? 9;
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Tapping a link in the menu means they're done with it.
  const pathname = usePathname();
  const [menuPath, setMenuPath] = useState(pathname);
  if (pathname !== menuPath) {
    setMenuPath(pathname);
    setMobileOpen(false);
  }
  const backdrop = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const drawer = useDrawer({ open: mobileOpen, onClose: () => setMobileOpen(false), items: "a, button", backdrop, panel });

  return (
    <>
      {/* Mobile top bar */}
      <header className="flex h-14 items-center justify-between border-b border-line bg-paper px-4 lg:hidden">
        <div className="flex items-center gap-2.5">
          <Image
            src="/brand/lumora-mark.png"
            alt="Lumora"
            width={24}
            height={24}
            className="shrink-0"
          />
          <span className="font-display text-[1rem] font-medium tracking-tight text-ink">
            lumora
          </span>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell />

          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            className="flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-sage-soft hover:text-ink"
          >
            <Menu strokeWidth={1.5} className="size-5" />
          </button>
        </div>
      </header>

      {/* Desktop top bar inside dashboard */}
      <div className="hidden h-16 items-center justify-between border-b border-line bg-paper px-6 lg:flex">
        <div>
          <p className="text-heading font-medium text-ink">
            {greeting},{" "}
            <span className="text-green">{displayName.split(" ")[0]}</span>
          </p>
          <p className="text-body-sm text-ink-muted">
            Here&apos;s what&apos;s happening on your account today.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Notifications */}
          <NotificationBell className="border border-line bg-paper" />

          {/* Avatar */}
          <Link
            href="/dashboard/profile"
            className="relative size-9 overflow-hidden rounded-full bg-sage-soft ring-2 ring-transparent transition hover:ring-green focus-visible:outline-none focus-visible:ring-green"
          >
            {photoURL ? (
              <Image
                src={photoURL}
                alt={displayName}
                fill
                className="object-cover"
                referrerPolicy="no-referrer"
                sizes="36px"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-num text-label font-medium text-green">
                {initials}
              </span>
            )}
          </Link>
        </div>
      </div>

      <RouteProgress area={profile?.area} />

      {/* On the body, so nothing on the page can sit over it or scroll behind it. */}
      {drawer.shown &&
        createPortal(
          <div className="fixed inset-0 z-50 overflow-hidden lg:hidden">
            <div
              ref={backdrop}
              aria-hidden="true"
              className="absolute inset-0 bg-field/60 backdrop-blur-[2px]"
              onClick={() => setMobileOpen(false)}
            />
            <div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              tabIndex={-1}
              {...drawer.swipe}
              className="absolute top-0 left-0 flex h-full w-[min(18rem,84vw)] touch-pan-y flex-col overflow-hidden rounded-r-[24px] bg-field outline-none will-change-transform [&>*]:w-full"
            >
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="absolute top-3 right-3 z-10 flex size-11 items-center justify-center rounded-full text-paper/70 transition-colors duration-150 hover:bg-paper/10 hover:text-paper focus-visible:ring-3 focus-visible:ring-sage focus-visible:outline-none [&&]:w-11"
              >
                <X aria-hidden="true" strokeWidth={1.5} className="size-5" />
              </button>
              <Sidebar />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
