"use client";

import {
  AlertTriangle, ArrowRight, Banknote, BookOpen, LayoutDashboard,
  Scale, Store, TrendingUp, Users, Wallet,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { getAuth } from "firebase/auth";

import app from "@/lib/firebase/config";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type Stats = {
  totalUsers: number;
  totalListings: number;
  totalBookings: number;
  openAlerts: number;
  openDisputes: number;
  totalGrossKobo: number;
  totalRevenueKobo: number;
  totalPayoutsKobo: number;
  pendingPayoutsKobo: number;
  usersByRole: Record<string, number>;
  bookingsByStatus: Record<string, number>;
  listingsByStatus: Record<string, number>;
  commodityBreakdown: { name: string; qty: number }[];
  weeklyRevenue: { week: string; grossNaira: number; feesNaira: number }[];
  userGrowth: { week: string; count: number }[];
  recentActivity: {
    id: string; code: string; qty: number; status: string;
    created_at: string; farmer: string; commodity: string;
  }[];
  recentUsers: { id: string; name: string; role: string; created_at: string }[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function naira(kobo: number) {
  if (kobo >= 100_000_000) return `₦${(kobo / 100_000_000).toFixed(1)}M`;
  if (kobo >= 100_000) return `₦${(kobo / 100_000).toFixed(1)}k`;
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
}

function relDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

const STATUS_STYLE: Record<string, string> = {
  settled: "bg-sage-soft text-green", delivered: "bg-sage-soft text-green",
  confirmed: "bg-sage-soft text-green", booked: "bg-amber-soft text-amber-700",
  cancelled: "bg-danger/10 text-danger", no_show: "bg-danger/10 text-danger",
  disputed: "bg-danger/10 text-danger", released: "bg-line text-ink-muted",
};

const ROLE_COLORS: Record<string, string> = {
  farmer: "#3D7A4E",
  buyer: "#C08A2E",
  agent: "#7B5EA7",
  admin: "#E74C3C",
};

const COMMODITY_COLORS = ["#3D7A4E", "#C08A2E", "#7B5EA7", "#2E86AB", "#E74C3C", "#95A5A6"];

const STATUS_COLORS: Record<string, string> = {
  settled: "#3D7A4E", delivered: "#5BA97A", confirmed: "#90C9A8",
  booked: "#C08A2E", cancelled: "#E74C3C", no_show: "#E08080",
  disputed: "#9B2226", released: "#ADB5BD",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, color, href, loading,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; href?: string; loading?: boolean;
}) {
  const inner = (
    <div className={cn(
      "group rounded-2xl border border-line bg-white p-5 shadow-sm transition-all",
      href && "hover:-translate-y-0.5 hover:shadow-md hover:border-green/30",
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className={cn("flex size-11 items-center justify-center rounded-xl", color)}>
          <Icon strokeWidth={1.5} className="size-5" />
        </div>
        {href && (
          <ArrowRight strokeWidth={1.5} className="size-4 shrink-0 text-ink-muted/40 transition-all group-hover:translate-x-0.5 group-hover:text-green" />
        )}
      </div>
      <p className="mt-4 font-num text-[11px] font-medium uppercase tracking-wider text-ink-muted">{label}</p>
      {loading ? (
        <Skeleton className="mt-1.5 h-8 w-24" />
      ) : (
        <p className="mt-1 font-num text-[28px] font-semibold leading-none text-ink">{value}</p>
      )}
      {sub && !loading && (
        <p className="mt-1 text-body-sm text-ink-muted">{sub}</p>
      )}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: { label: string; href: string } }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-medium text-ink">{title}</h2>
        {action && (
          <Link href={action.href} className="text-body-sm font-medium text-green transition-colors hover:text-green-hover">
            {action.label} →
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function DonutChart({ data, colors, centerLabel, centerValue }: {
  data: { name: string; value: number }[];
  colors: string[];
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p className="py-8 text-center text-body-sm text-ink-muted">No data yet.</p>;

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0">
        <ResponsiveContainer width={140} height={140}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={42} outerRadius={64}
              paddingAngle={2} dataKey="value" strokeWidth={0}>
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {centerLabel && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="font-num text-[11px] font-medium uppercase tracking-wider text-ink-muted">{centerLabel}</p>
            <p className="font-num text-lg font-semibold text-ink">{centerValue ?? total}</p>
          </div>
        )}
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {data.map((item, i) => (
          <li key={item.name} className="flex items-center justify-between gap-2 text-body-sm">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="size-2 shrink-0 rounded-full" style={{ background: colors[i % colors.length] }} />
              <span className="truncate capitalize text-ink-muted">{item.name.replace(/_/g, " ")}</span>
            </span>
            <span className="font-num font-medium text-ink shrink-0">
              {item.value} <span className="text-ink-muted font-normal">({Math.round(item.value / total * 100)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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
        if (!cancelled && res.ok) setStats(await res.json());
      } catch { /* silent */ } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const s = stats;

  // Derived chart data
  const userRoleData = Object.entries(s?.usersByRole ?? {}).map(([name, value]) => ({ name, value }));
  const bookingStatusData = Object.entries(s?.bookingsByStatus ?? {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const listingStatusData = Object.entries(s?.listingsByStatus ?? {}).map(([name, value]) => ({ name, value }));

  const totalActive = (s?.bookingsByStatus.booked ?? 0) + (s?.bookingsByStatus.confirmed ?? 0);

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6 px-4 py-6 md:px-6 lg:px-8">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <LayoutDashboard strokeWidth={1.5} className="size-5 text-ink-muted" />
          <h1 className="font-display text-2xl font-medium text-ink">Platform Overview</h1>
        </div>
        <p className="mt-1 text-body-sm text-ink-muted">Live health of the Lumora platform — all figures include data up to now.</p>
      </div>

      {/* Attention banner — show if open alerts or disputes */}
      {!loading && ((s?.openAlerts ?? 0) > 0 || (s?.openDisputes ?? 0) > 0) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3">
          <AlertTriangle strokeWidth={1.5} className="size-4 shrink-0 text-danger" />
          <p className="text-body-sm text-ink">
            {s!.openAlerts > 0 && <><span className="font-medium">{s!.openAlerts} open alert{s!.openAlerts !== 1 ? "s" : ""}</span></>}
            {s!.openAlerts > 0 && s!.openDisputes > 0 && " · "}
            {s!.openDisputes > 0 && <><span className="font-medium">{s!.openDisputes} open dispute{s!.openDisputes !== 1 ? "s" : ""}</span></>}
            {" "}need attention.
          </p>
          <div className="ml-auto flex gap-2">
            {s!.openAlerts > 0 && <Link href="/admin/alerts" className="text-body-sm font-medium text-danger hover:underline">View alerts</Link>}
            {s!.openDisputes > 0 && <Link href="/admin/disputes" className="text-body-sm font-medium text-danger hover:underline">View disputes</Link>}
          </div>
        </div>
      )}

      {/* ── Row 1: KPI Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        <KpiCard label="Total Users" value={loading ? "—" : (s?.totalUsers ?? 0).toLocaleString()}
          icon={Users} color="bg-sage-soft text-green" href="/admin/users" loading={loading} />
        <KpiCard label="Demand Listings" value={loading ? "—" : (s?.totalListings ?? 0).toLocaleString()}
          icon={Store} color="bg-amber-soft text-amber-700" href="/admin/listings" loading={loading} />
        <KpiCard label="Total Bookings" value={loading ? "—" : (s?.totalBookings ?? 0).toLocaleString()}
          sub={totalActive > 0 ? `${totalActive} active` : undefined}
          icon={BookOpen} color="bg-sage-soft text-green" href="/admin/bookings" loading={loading} />
        <KpiCard label="Open Alerts" value={loading ? "—" : (s?.openAlerts ?? 0)}
          sub={s?.openDisputes ? `${s.openDisputes} disputes` : undefined}
          icon={AlertTriangle} color="bg-danger/10 text-danger" href="/admin/alerts" loading={loading} />
      </div>

      {/* ── Row 2: Financial KPI Cards ───────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-line bg-gradient-to-br from-field to-field/80 p-5 shadow-sm">
          <div className="flex size-10 items-center justify-center rounded-xl bg-sage/20">
            <TrendingUp strokeWidth={1.5} className="size-5 text-sage" />
          </div>
          <p className="mt-4 font-num text-[11px] font-medium uppercase tracking-wider text-sage/70">Gross GMV</p>
          {loading ? <Skeleton className="mt-1.5 h-7 w-28 bg-sage/20" /> : (
            <p className="mt-1 font-num text-[24px] font-semibold leading-none text-paper">{naira(s?.totalGrossKobo ?? 0)}</p>
          )}
          <p className="mt-1 text-body-sm text-sage/60">Total settled value</p>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div className="flex size-10 items-center justify-center rounded-xl bg-green/10">
            <Wallet strokeWidth={1.5} className="size-5 text-green" />
          </div>
          <p className="mt-4 font-num text-[11px] font-medium uppercase tracking-wider text-ink-muted">Platform Revenue</p>
          {loading ? <Skeleton className="mt-1.5 h-7 w-24" /> : (
            <p className="mt-1 font-num text-[24px] font-semibold leading-none text-green">{naira(s?.totalRevenueKobo ?? 0)}</p>
          )}
          <p className="mt-1 text-body-sm text-ink-muted">1.5% buyer fee</p>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-soft">
            <Banknote strokeWidth={1.5} className="size-5 text-amber-700" />
          </div>
          <p className="mt-4 font-num text-[11px] font-medium uppercase tracking-wider text-ink-muted">Paid to Farmers</p>
          {loading ? <Skeleton className="mt-1.5 h-7 w-24" /> : (
            <p className="mt-1 font-num text-[24px] font-semibold leading-none text-ink">{naira(s?.totalPayoutsKobo ?? 0)}</p>
          )}
          <p className="mt-1 text-body-sm text-ink-muted">Settled payouts</p>
        </div>

        <div className="rounded-2xl border border-danger/20 bg-danger/5 p-5 shadow-sm">
          <div className="flex size-10 items-center justify-center rounded-xl bg-danger/10">
            <Scale strokeWidth={1.5} className="size-5 text-danger" />
          </div>
          <p className="mt-4 font-num text-[11px] font-medium uppercase tracking-wider text-danger/70">Pending Payouts</p>
          {loading ? <Skeleton className="mt-1.5 h-7 w-24" /> : (
            <p className="mt-1 font-num text-[24px] font-semibold leading-none text-danger">{naira(s?.pendingPayoutsKobo ?? 0)}</p>
          )}
          <p className="mt-1 text-body-sm text-danger/70">Awaiting transfer</p>
        </div>
      </div>

      {/* ── Row 3: Revenue chart + User donut ───────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <SectionCard title="Weekly Revenue (₦)" action={{ label: "Transactions", href: "/admin/transactions" }}>
          {loading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : (s?.weeklyRevenue ?? []).length === 0 ? (
            <p className="py-10 text-center text-body-sm text-ink-muted">No revenue data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={s!.weeklyRevenue} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="grossGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3D7A4E" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3D7A4E" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="feesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C08A2E" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#C08A2E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EDE9" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#8A9E8C" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "#8A9E8C" }} axisLine={false} tickLine={false} width={52} />
                <Tooltip
                  formatter={(val, name) => [
                    `₦${Number(val).toLocaleString("en-NG")}`,
                    name === "grossNaira" ? "Gross GMV" : "Platform fee",
                  ]}
                  contentStyle={{ borderRadius: 12, border: "1px solid #E8EDE9", fontSize: 12 }}
                />
                <Area type="monotone" dataKey="grossNaira" stroke="#3D7A4E" strokeWidth={2} fill="url(#grossGrad)" dot={false} />
                <Area type="monotone" dataKey="feesNaira" stroke="#C08A2E" strokeWidth={2} fill="url(#feesGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
          <div className="mt-3 flex gap-4 text-label text-ink-muted">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-green inline-block" /> Gross GMV</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber inline-block" /> Platform fee</span>
          </div>
        </SectionCard>

        <SectionCard title="Users by Role" action={{ label: "All users", href: "/admin/users" }}>
          {loading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : (
            <DonutChart
              data={userRoleData}
              colors={userRoleData.map((d) => ROLE_COLORS[d.name] ?? "#95A5A6")}
              centerLabel="total"
              centerValue={(s?.totalUsers ?? 0).toString()}
            />
          )}
        </SectionCard>
      </div>

      {/* ── Row 4: Booking status donut + Commodity bar ─────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard title="Bookings by Status" action={{ label: "All bookings", href: "/admin/bookings" }}>
          {loading ? (
            <Skeleton className="h-[180px] w-full" />
          ) : (
            <DonutChart
              data={bookingStatusData}
              colors={bookingStatusData.map((d) => STATUS_COLORS[d.name] ?? "#ADB5BD")}
              centerLabel="total"
              centerValue={(s?.totalBookings ?? 0).toString()}
            />
          )}
        </SectionCard>

        <SectionCard title="Top Commodities (units booked)" action={{ label: "All listings", href: "/admin/listings" }}>
          {loading ? (
            <Skeleton className="h-[180px] w-full" />
          ) : (s?.commodityBreakdown ?? []).length === 0 ? (
            <p className="py-8 text-center text-body-sm text-ink-muted">No booking data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={s!.commodityBreakdown} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EDE9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#8A9E8C" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: "#5A6E5C" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [`${Number(v)} units`, "Booked"]} contentStyle={{ borderRadius: 12, border: "1px solid #E8EDE9", fontSize: 12 }} />
                <Bar dataKey="qty" radius={[0, 4, 4, 0]}>
                  {(s?.commodityBreakdown ?? []).map((_, i) => (
                    <Cell key={i} fill={COMMODITY_COLORS[i % COMMODITY_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* ── Row 5: User growth + Listing status ─────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <SectionCard title="New Users per Week" action={{ label: "All users", href: "/admin/users" }}>
          {loading ? (
            <Skeleton className="h-[180px] w-full" />
          ) : (s?.userGrowth ?? []).length === 0 ? (
            <p className="py-8 text-center text-body-sm text-ink-muted">No user growth data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={s!.userGrowth} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EDE9" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#8A9E8C" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#8A9E8C" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip formatter={(v) => [`${Number(v)} users`, "Joined"]} contentStyle={{ borderRadius: 12, border: "1px solid #E8EDE9", fontSize: 12 }} />
                <Bar dataKey="count" fill="#3D7A4E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="Listings by Status" action={{ label: "All listings", href: "/admin/listings" }}>
          {loading ? (
            <Skeleton className="h-[180px] w-full" />
          ) : (
            <DonutChart
              data={listingStatusData}
              colors={listingStatusData.map((d) => d.name === "active" ? "#3D7A4E" : d.name === "paused" ? "#C08A2E" : "#ADB5BD")}
              centerLabel="total"
              centerValue={(s?.totalListings ?? 0).toString()}
            />
          )}
        </SectionCard>
      </div>

      {/* ── Row 6: Activity feed + Recent users ─────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Recent Bookings" action={{ label: "All bookings", href: "/admin/bookings" }}>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (s?.recentActivity ?? []).length === 0 ? (
            <p className="py-8 text-center text-body-sm text-ink-muted">No bookings yet.</p>
          ) : (
            <ul className="divide-y divide-line -mx-5 px-0">
              {(s?.recentActivity ?? []).map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sage-soft font-num text-label font-medium text-green">
                    {b.commodity[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm font-medium text-ink">{b.commodity} · {b.qty} units</p>
                    <p className="truncate text-label text-ink-muted">{b.farmer} · {b.code}</p>
                  </div>
                  <span className="text-label text-ink-muted shrink-0">{relDate(b.created_at)}</span>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-label font-medium capitalize", STATUS_STYLE[b.status] ?? "bg-line text-ink-muted")}>
                    {b.status.replace(/_/g, " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Recently Joined Users" action={{ label: "All users", href: "/admin/users" }}>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (s?.recentUsers ?? []).length === 0 ? (
            <p className="py-8 text-center text-body-sm text-ink-muted">No users yet.</p>
          ) : (
            <ul className="divide-y divide-line -mx-5 px-0">
              {(s?.recentUsers ?? []).map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sage-soft font-num text-label font-medium text-green">
                    {(u.name ?? "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm font-medium text-ink">{u.name}</p>
                    <p className="text-label text-ink-muted capitalize">{u.role}</p>
                  </div>
                  <span className="text-label text-ink-muted shrink-0">{relDate(u.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* ── Row 7: Quick nav to all sections ────────────────────── */}
      <div>
        <h2 className="mb-3 font-medium text-ink">All sections</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { href: "/admin/transactions", label: "Transactions", icon: TrendingUp },
            { href: "/admin/payouts", label: "Payouts", icon: Banknote },
            { href: "/admin/withdrawals", label: "Withdrawals", icon: Wallet },
            { href: "/admin/disputes", label: "Disputes", icon: Scale },
            { href: "/admin/sms", label: "SMS Log", icon: Users },
          ].map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-4 py-3 text-body-sm font-medium text-ink transition-all hover:-translate-y-0.5 hover:border-green/30 hover:shadow-sm">
              <Icon strokeWidth={1.5} className="size-4 shrink-0 text-ink-muted" />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
