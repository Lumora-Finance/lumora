"use client";

import { Bell, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuthUser } from "@/components/auth/use-auth-user";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";

export function DashboardHeader() {
  const { user } = useAuthUser();
  const [mobileOpen, setMobileOpen] = useState(false);

  const photoURL = user?.photoURL ?? null;
  const displayName = user?.displayName ?? user?.email?.split("@")[0] ?? "You";
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();

  const [greeting, setGreeting] = useState("Good morning");
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
  }, []);

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
          <button
            aria-label="Notifications"
            className="relative flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-sage-soft hover:text-ink"
          >
            <Bell strokeWidth={1.5} className="size-5" />
            <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-amber" />
          </button>

          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
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
            Here's what's happening on your account today.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Notifications */}
          <button
            aria-label="Notifications"
            className="relative flex size-9 items-center justify-center rounded-full border border-line bg-paper text-ink-muted hover:bg-sage-soft hover:text-ink"
          >
            <Bell strokeWidth={1.5} className="size-5" />
            <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-amber" />
          </button>

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

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-field/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className={cn(
              "absolute left-0 top-0 flex h-full w-64 flex-col bg-paper shadow-xl",
              "transition-transform duration-300",
            )}
          >
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-sage-soft hover:text-ink"
            >
              <X strokeWidth={1.5} className="size-5" />
            </button>
            <Sidebar />
          </div>
        </div>
      )}
    </>
  );
}
