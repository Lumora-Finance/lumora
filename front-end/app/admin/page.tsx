"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Store, BookOpen, Banknote, Bell, MessageSquare, Scale, BarChart3 } from "lucide-react";
import { getAuth } from "firebase/auth";

import app from "@/lib/firebase/config";
import { Skeleton } from "@/components/ui/skeleton";

type Stats = {
  users: number;
  listings: number;
  bookings: number;
  disputes: number;
  payouts: number;
  alerts: number;
};

const CARDS = [
  { key: "users", label: "Users", icon: Users, href: "/admin/users", color: "text-green", bg: "bg-green/10" },
  { key: "listings", label: "Listings", icon: Store, href: "/admin/listings", color: "text-amber", bg: "bg-amber/10" },
  { key: "bookings", label: "Bookings", icon: BookOpen, href: "/admin/bookings", color: "text-green", bg: "bg-green/10" },
  { key: "disputes", label: "Disputes", icon: Scale, href: "/admin/disputes", color: "text-danger", bg: "bg-danger/10" },
  { key: "payouts", label: "Payouts", icon: Banknote, href: "/admin/payouts", color: "text-amber", bg: "bg-amber/10" },
  { key: "alerts", label: "Alerts", icon: Bell, href: "/admin/alerts", color: "text-danger", bg: "bg-danger/10" },
] as const;

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = await getAuth(app).currentUser?.getIdToken();
        const res = await fetch("/api/admin/stats", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!cancelled && res.ok) {
          setStats(await res.json());
        }
      } catch {
        // Silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-6 md:px-6 lg:px-8">
      <h1 className="font-display text-2xl font-medium text-ink">Overview</h1>
      <p className="mt-1 text-body-sm text-ink-muted">Platform activity at a glance</p>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        {CARDS.map(({ key, label, icon: Icon, href, color, bg }) => (
          <Link
            key={key}
            href={href}
            className="group rounded-xl border border-line bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className={`flex size-10 items-center justify-center rounded-xl ${bg}`}>
                <Icon strokeWidth={1.5} className={`size-5 ${color}`} />
              </div>
              <div>
                <p className="text-body-sm font-medium text-ink-muted">{label}</p>
                <p className="font-num text-2xl font-medium text-ink">
                  {loading ? <Skeleton className="h-6 w-12" /> : (stats?.[key as keyof Stats] ?? 0)}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link href="/admin/withdrawals" className="rounded-xl border border-line bg-white p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber/10">
              <Banknote strokeWidth={1.5} className="size-5 text-amber" />
            </div>
            <div>
              <p className="text-body-sm font-medium text-ink-muted">Withdrawals</p>
              <p className="text-body-sm text-ink">Review and process pending withdrawals</p>
            </div>
          </div>
        </Link>
        <Link href="/admin/sms" className="rounded-xl border border-line bg-white p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-green/10">
              <MessageSquare strokeWidth={1.5} className="size-5 text-green" />
            </div>
            <div>
              <p className="text-body-sm font-medium text-ink-muted">SMS Log</p>
              <p className="text-body-sm text-ink">View SMS messages sent and received</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
