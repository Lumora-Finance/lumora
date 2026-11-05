"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuthUser } from "@/components/auth/use-auth-user";
import { Button } from "@/components/ui/button";
import { dayAndClock, money } from "@/lib/email/format";
import { apiFetch } from "@/lib/logistics/client";

type Report = {
  id: string;
  ops_deadline_at: string;
  reported_at: string;
  window_start: string;
  window_end: string;
  fee_kobo: number;
  booking: { id: string; code: string; qty: number; reserve_kobo: number };
  farmer: { name: string; phone: string };
  buyer: { name: string; phone: string };
};

const hoursLeft = (deadline: string) => {
  const hours = Math.round((new Date(deadline).getTime() - Date.now()) / 3_600_000);
  return hours <= 0 ? "Past deadline" : `${hours}h left`;
};

/** Farmers who said the code wasn't given, where the buyer didn't answer. Enforced by the API. */
export function CodeReportQueue() {
  const { user } = useAuthUser();
  const [reports, setReports] = useState<Report[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const response = await apiFetch(user, "/api/admin/code-reports").catch(() => null);
    if (response?.ok) setReports((await response.json()) as Report[]);
  }, [user]);

  useEffect(() => {
    // Loading from the API is the external system this effect stays in step with.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function decide(reportId: string, decision: string) {
    if (!user) return;
    setBusy(true);
    setError(null);
    const response = await apiFetch(user, "/api/admin/code-reports", { reportId, decision }).catch(() => null);
    setBusy(false);
    if (response?.ok) await load();
    else setError("That didn't save. Please try again.");
  }

  if (reports.length === 0) return null;

  return (
    <section className="mx-auto max-w-[960px] px-4 pt-8 md:px-6" aria-label="Delivery code not given">
      <h2 className="text-title font-semibold">Delivery code not given</h2>
      <p className="mt-1 mb-6 text-ink-muted">If nobody decides by the deadline, it&apos;s no fault: the full reserve goes back, with no strikes.</p>
      {error && <p role="alert" className="mb-3 text-body-sm text-danger">{error}</p>}
      <ul className="space-y-4">
        {reports.map((report) => (
          <li key={report.id} className="rounded-xl border border-line bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">
                <span className="font-num">{report.booking.code}</span> · {report.farmer.name} and {report.buyer.name}
              </p>
              <p className="font-num text-body-sm text-ink-muted">{hoursLeft(report.ops_deadline_at)}</p>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                ["Reported", dayAndClock(report.reported_at)],
                ["Window ended", dayAndClock(report.window_end)],
                ["Reserve", money(report.booking.reserve_kobo)],
                ["Late-cancel fee", money(report.fee_kobo)],
                ["Farmer", report.farmer.phone],
                ["Buyer", report.buyer.phone],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-label text-ink-muted">{label}</dt>
                  <dd className="font-num text-number">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
              <Button disabled={busy} onClick={() => decide(report.id, "buyer_fault")}>Buyer at fault</Button>
              <Button variant="outline" disabled={busy} onClick={() => decide(report.id, "farmer_fault")}>Farmer at fault</Button>
              <Button variant="outline" disabled={busy} onClick={() => decide(report.id, "no_fault")}>No fault</Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
