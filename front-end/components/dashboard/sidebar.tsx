"use client";

import {
  BarChart3,
  BookOpen,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  ShoppingBag,
  Store,
  User,
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
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/dashboard/bookings", label: "My Bookings", icon: BookOpen },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
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
    <aside className="flex h-full w-60 flex-col border-r border-line bg-paper">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-line px-5">
        <Image
          src="/brand/lumora-mark.png"
          alt="Lumora"
          width={28}
          height={28}
          className="shrink-0"
        />
        <span className="font-display text-[1.1rem] font-medium tracking-tight text-ink">
          lumora
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2.5 text-body font-medium transition-colors duration-150",
                    active
                      ? "bg-sage-soft text-green"
                      : "text-ink-muted hover:bg-sage-soft/60 hover:text-ink",
                  )}
                >
                  <Icon
                    strokeWidth={active ? 2 : 1.5}
                    className={cn(
                      "size-[18px] shrink-0 transition-colors duration-150",
                      active ? "text-green" : "text-ink-muted group-hover:text-ink",
                    )}
                  />
                  {label}
                  {label === "Messages" && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-green px-1.5 font-num text-label font-medium text-paper">
                      2
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User + sign out */}
      <div className="shrink-0 border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-md px-3 py-2.5">
          {/* Avatar */}
          <div className="relative size-8 shrink-0 overflow-hidden rounded-full bg-sage-soft">
            {photoURL ? (
              <Image
                src={photoURL}
                alt={displayName}
                fill
                className="object-cover"
                referrerPolicy="no-referrer"
                sizes="32px"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-num text-label font-medium text-green">
                {initials}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-medium text-ink">{displayName}</p>
            <p className="truncate text-body-sm text-ink-muted">{email}</p>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-body font-medium text-ink-muted transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
        >
          <LogOut strokeWidth={1.5} className="size-[18px] shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
