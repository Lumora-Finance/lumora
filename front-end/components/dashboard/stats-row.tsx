"use client";

import type { DashboardStats } from "@/lib/dashboard-data";
import { useDashboardData } from "@/lib/hooks/use-dashboard-data";
import { formatKobo } from "@/lib/money/rules";
import { useToday } from "@/lib/use-today";

import { Panel, PanelHeading } from "./panel";

/** The month in four numbers. They share one panel, split by hairlines, and never repeat elsewhere. */
export function StatsRow() {
  const today = useToday();
  const month = today ? new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(today) : " ";
  const { data: stats, loading } = useDashboardData<DashboardStats>("stats");
  const { data: me } = useDashboardData<{ role?: string; reliability?: { on_time: number; total: number } } | null>("me");

  const deliveries = stats?.monthlyCount ?? 0;
  const items = [
    { label: "Active posts", value: String(stats?.activePosts ?? 0), note: "Demand you've posted" },
    { label: "Bookings ahead", value: String(stats?.upcomingBookings ?? 0), note: "Booked and confirmed" },
    { label: "Earned", value: formatKobo(stats?.monthlyKobo ?? 0), note: `From ${deliveries} ${deliveries === 1 ? "delivery" : "deliveries"}` },
    {
      label: "On time",
      value: me?.reliability && me.reliability.total > 0 ? `${me.reliability.on_time} of ${me.reliability.total}` : "None yet",
      note: "Your delivery record",
    },
  ];

  return (
    <Panel>
      <PanelHeading title="This month" sub={month} />
      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-b-[20px] border-t border-line bg-line lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="min-w-0 bg-white px-5 py-4 sm:px-6 sm:py-5">
            <p className="text-body-sm text-ink-muted">{item.label}</p>
            <p className="mt-1 truncate font-num text-[20px] leading-7 font-medium text-ink sm:text-[24px] sm:leading-8">
              {loading ? "—" : item.value}
            </p>
            <p className="mt-1 text-xs text-ink-muted">{item.note}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
