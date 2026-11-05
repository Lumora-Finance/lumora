"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import {
  BarChart3,
  Banknote,
  Bell,
  BookOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Scale,
  Store,
  Users,
  X,
  ShieldAlert,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { getFirebaseAuth } from "@/lib/firebase/auth";
import { useProfile } from "@/components/auth/use-profile";

const NAV = [
  { href: "/admin",              label: "Overview",     icon: LayoutDashboard, exact: true },
  { href: "/admin/users",        label: "Users",        icon: Users },
  { href: "/admin/listings",     label: "Listings",     icon: Store },
  { href: "/admin/bookings",     label: "Bookings",     icon: BookOpen },
  { href: "/admin/disputes",     label: "Disputes",     icon: Scale,          badge: "•",  badgeColor: "bg-danger text-paper" },
  { href: "/admin/transactions", label: "Transactions", icon: BarChart3 },
  { href: "/admin/payouts",      label: "Payouts",      icon: Banknote },
  { href: "/admin/withdrawals",  label: "Withdrawals",  icon: Banknote },
  { href: "/admin/alerts",       label: "Alerts",       icon: Bell,           badge: "•",  badgeColor: "bg-amber text-ink" },
  { href: "/admin/sms",          label: "SMS Log",      icon: MessageSquare },
];

function AdminSidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile } = useProfile();

  const displayName = profile?.display_name ?? user?.displayName ?? user?.email?.split("@")[0] ?? "Admin";
  const email = profile?.email ?? user?.email ?? "";
  const initials = displayName.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();

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
      className="relative flex h-full w-60 flex-col overflow-hidden bg-field"
      style={{
        backgroundImage: `repeating-linear-gradient(135deg,transparent,transparent 28px,rgba(143,184,164,0.04) 28px,rgba(143,184,164,0.04) 29px)`,
      }}
    >
      {/* Glow blobs */}
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-sage/5 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -left-8 top-32 size-32 rounded-full bg-green/10 blur-3xl" />

      {/* Logo */}
      <div className="relative shrink-0 px-5 py-5">
        <div className="flex items-center justify-between">
          <Link href="/admin" className="inline-flex items-center gap-2.5">
            <Image src="/brand/lumora-mark.png" alt="Lumora" width={26} height={26} className="shrink-0" />
            <div>
              <span className="block font-display text-[1rem] font-medium tracking-tight text-paper">lumora</span>
              <span className="block font-num text-[0.6rem] font-medium uppercase tracking-widest text-sage/50">admin</span>
            </div>
          </Link>
          {onClose && (
            <button onClick={onClose} className="flex size-7 items-center justify-center rounded-full text-sage/60 hover:bg-sage/10 hover:text-paper lg:hidden">
              <X strokeWidth={1.5} className="size-4" />
            </button>
          )}
        </div>
        <div aria-hidden className="mt-4 space-y-1.5">
          <span className="block h-px w-full bg-sage/15" />
          <span className="block h-px w-2/3 bg-sage/10" />
        </div>
      </div>

      {/* Admin badge */}
      <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg bg-danger/20 px-3 py-2">
        <ShieldAlert strokeWidth={1.5} className="size-4 shrink-0 text-danger" />
        <span className="font-num text-label font-medium uppercase tracking-wider text-danger">Admin Access</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <p className="mb-3 px-3 font-num text-label font-medium uppercase tracking-widest text-sage/40">Navigation</p>
        <ul className="space-y-1">
          {NAV.map(({ href, label, icon: Icon, exact, badge, badgeColor }, index) => {
            const active = isActive(href, exact);
            const shapes = [
              "rounded-[12px_4px_12px_4px]", "rounded-[4px_12px_4px_12px]",
              "rounded-[12px_12px_4px_4px]", "rounded-[4px_4px_12px_12px]",
              "rounded-[12px_4px_4px_12px]", "rounded-[4px_12px_12px_4px]",
              "rounded-[8px]", "rounded-[8px]", "rounded-[8px]",
            ];
            const shape = shapes[index % shapes.length];
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onClose}
                  className={cn(
                    "group relative flex items-center gap-3 px-3 py-2.5 text-body-sm font-medium transition-all duration-200",
                    shape,
                    active ? "bg-sage/20 text-paper shadow-[inset_0_0_0_1px_rgba(143,184,164,0.25)]" : "text-sage/60 hover:bg-sage/10 hover:text-paper",
                  )}
                >
                  {active && <span aria-hidden className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-sage" />}
                  <Icon strokeWidth={active ? 2 : 1.5} className={cn("size-[17px] shrink-0 transition-all duration-200", active ? "text-sage" : "text-sage/50 group-hover:text-sage/80")} />
                  {label}
                  {badge && (
                    <span className={cn("ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-num text-label font-medium", badgeColor)}>
                      {badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Divider */}
      <div aria-hidden className="pointer-events-none mx-5 mb-3">
        <span className="block h-px w-full bg-sage/10" />
      </div>

      {/* User card */}
      <div className="shrink-0 p-3">
        <div className="overflow-hidden rounded-xl bg-sage/10 p-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-danger/20 font-num text-label font-medium text-danger">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-body-sm font-medium text-paper">{displayName}</p>
              <p className="truncate font-num text-label text-sage/60">{email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-3 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-label font-medium text-sage/60 transition-colors hover:bg-danger/20 hover:text-danger"
          >
            <LogOut strokeWidth={1.5} className="size-3.5 shrink-0" />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, isAdmin } = useProfile();

  // Close drawer on navigation
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Redirect non-admins away from /admin
  useEffect(() => {
    if (loading) return; // wait for profile to load
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    if (!isAdmin) {
      router.replace("/dashboard");
    }
  }, [loading, user, isAdmin, router]);

  const pageTitle = NAV.find((n) =>
    n.exact ? pathname === n.href : pathname.startsWith(n.href)
  )?.label ?? "Admin";

  // Show nothing while checking auth / redirecting
  if (loading || !user || !isAdmin) {
    return (
      <div className="flex h-svh items-center justify-center bg-paper">
        <div className="flex flex-col items-center gap-3 text-ink-muted">
          <div className="size-8 animate-spin rounded-full border-2 border-line border-t-green" />
          <p className="text-body-sm">Checking access…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-svh overflow-hidden bg-paper">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:shrink-0">
        <AdminSidebar />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-field/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-60 flex-col bg-field shadow-xl">
            <AdminSidebar onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-paper px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-sage-soft hover:text-ink lg:hidden"
            >
              <Menu strokeWidth={1.5} className="size-5" />
            </button>
            <div>
              <p className="text-heading font-medium text-ink">{pageTitle}</p>
              <p className="hidden text-label text-ink-muted sm:block">Lumora internal console</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-danger/10 px-3 py-1 font-num text-label font-medium uppercase tracking-wider text-danger">
              Admin
            </span>
            <Link href="/dashboard" className="rounded-lg border border-line px-3 py-1.5 text-label font-medium text-ink-muted transition-colors hover:border-green hover:text-green">
              ← Dashboard
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
