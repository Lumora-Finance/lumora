"use client";

import {
  BarChart3,
  BookOpen,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  MapPin,
  ShoppingBag,
  Store,
  User,
  Wallet,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";

import { cn } from "@/lib/utils";
import { getFirebaseAuth } from "@/lib/firebase/auth";
import { useAuthUser } from "@/components/auth/use-auth-user";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/marketplace", label: "Marketplace", icon: Store },
  { href: "/dashboard/board", label: "Buyers near you", icon: MapPin },
  { href: "/dashboard/bookings", label: "My Bookings", icon: BookOpen },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { href: "/dashboard/transactions", label: "Transactions", icon: BarChart3 },
  { href: "/dashboard/posts", label: "My Posts", icon: ShoppingBag },
  { href: "/dashboard/profile", label: "Profile", icon: User },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthUser();

  const photoURL = user?.photoURL ?? null;
  const displayName = user?.displayName ?? user?.email?.split("@")[0] ?? "You";
  const email = user?.email ?? "";
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();

  async function handleSignOut() {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
    router.replace("/auth/login");
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <aside
      className="relative flex h-full w-64 flex-col overflow-hidden bg-field"
      style={{
        /* Diagonal stripe pattern using repeating-linear-gradient */
        backgroundImage: `
          repeating-linear-gradient(
            135deg,
            transparent,
            transparent 28px,
            rgba(143,184,164,0.04) 28px,
            rgba(143,184,164,0.04) 29px
          )
        `,
      }}
    >
      {/* Top decorative arc */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-sage/5 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-8 top-32 size-32 rounded-full bg-green/10 blur-3xl"
      />

      {/* Logo notch — paper cutout like the landing hero */}
      <div className="relative shrink-0 px-5 py-5">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/60"
        >
          <Image
            src="/brand/lumora-mark.png"
            alt="Lumora"
            width={28}
            height={28}
            className="shrink-0"
          />
          <span className="font-display text-[1.15rem] font-medium tracking-tight text-paper">
            lumora
          </span>
        </Link>

        {/* Decorative ledger lines under logo */}
        <div aria-hidden className="mt-4 space-y-1.5">
          <span className="block h-px w-full bg-sage/15" />
          <span className="block h-px w-2/3 bg-sage/10" />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <p className="mb-3 px-3 font-num text-label font-medium uppercase tracking-widest text-sage/40">
          Navigation
        </p>
        <ul className="space-y-1">
          {NAV.map(({ href, label, icon: Icon, exact }, index) => {
            const active = isActive(href, exact);

            // Each nav item gets a slightly different organic shape
            const shapes = [
              "rounded-[12px_4px_12px_4px]",
              "rounded-[4px_12px_4px_12px]",
              "rounded-[12px_12px_4px_4px]",
              "rounded-[4px_4px_12px_12px]",
              "rounded-[12px_4px_4px_12px]",
              "rounded-[4px_12px_12px_4px]",
              "rounded-[8px_8px_8px_8px]",
            ];
            const shape = shapes[index % shapes.length];

            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "group relative flex items-center gap-3 px-3 py-2.5 text-body-sm font-medium transition-all duration-200",
                    shape,
                    active
                      ? "bg-sage/20 text-paper shadow-[inset_0_0_0_1px_rgba(143,184,164,0.25)]"
                      : "text-sage/60 hover:bg-sage/10 hover:text-paper",
                  )}
                >
                  {/* Active left stripe */}
                  {active && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-sage"
                    />
                  )}

                  <Icon
                    strokeWidth={active ? 2 : 1.5}
                    className={cn(
                      "size-[17px] shrink-0 transition-all duration-200",
                      active ? "text-sage" : "text-sage/50 group-hover:text-sage/80",
                    )}
                  />
                  {label}

                  {label === "Messages" && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber px-1.5 font-num text-label font-medium text-ink">
                      2
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom decorative shape */}
      <div aria-hidden className="pointer-events-none absolute bottom-28 left-0 right-0 px-5">
        <span className="block h-px w-full bg-sage/10" />
        <span className="mt-1.5 block h-px w-1/2 bg-sage/8" />
      </div>

      {/* User card */}
      <div className="shrink-0 p-3">
        <div
          className="overflow-hidden rounded-[12px_4px_12px_12px] bg-sage/10 p-3"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(143,184,164,0.04) 6px, rgba(143,184,164,0.04) 7px)`,
          }}
        >
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="relative size-9 shrink-0 overflow-hidden rounded-[8px_2px_8px_2px] bg-field-soft ring-1 ring-sage/30">
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
                <span className="flex h-full w-full items-center justify-center font-num text-label font-medium text-sage">
                  {initials}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-body-sm font-medium text-paper">{displayName}</p>
              <p className="truncate font-num text-label text-sage/60">{email}</p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="mt-3 flex w-full items-center gap-2.5 rounded-[6px_2px_6px_6px] px-2.5 py-2 text-label font-medium text-sage/60 transition-colors hover:bg-danger/20 hover:text-danger"
          >
            <LogOut strokeWidth={1.5} className="size-3.5 shrink-0" />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
