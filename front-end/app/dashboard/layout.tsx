import type { ReactNode } from "react";
import { Suspense } from "react";

import { DashboardAuthGuard } from "@/components/dashboard/auth-guard";
import { DashboardScroll } from "@/components/dashboard/dashboard-scroll";
import { DashboardHeader } from "@/components/dashboard/header";
import { FirstLoad } from "@/components/loader/first-load";
import { Sidebar } from "@/components/dashboard/sidebar";
import { DynamicMarker } from "@/components/dynamic-marker";

export const instant = false;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Signal to Next.js that the whole dashboard tree uses runtime data */}
      <Suspense fallback={null}>
        <DynamicMarker />
      </Suspense>
      <DashboardAuthGuard>
        <div className="flex h-svh overflow-hidden bg-paper">
          <FirstLoad />
          {/* Desktop sidebar */}
          <div className="hidden lg:flex lg:shrink-0">
            <Suspense>
              <Sidebar />
            </Suspense>
          </div>

          {/* Main content area */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <Suspense>
              <DashboardHeader />
            </Suspense>
            <DashboardScroll>
              <Suspense>
                {children}
              </Suspense>
            </DashboardScroll>
          </div>
        </div>
      </DashboardAuthGuard>
    </>
  );
}
