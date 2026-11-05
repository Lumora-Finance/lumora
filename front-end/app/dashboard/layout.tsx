import type { ReactNode } from "react";
import { Suspense } from "react";

import { DashboardHeader } from "@/components/dashboard/header";
import { Sidebar } from "@/components/dashboard/sidebar";

export const instant = false;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-svh bg-paper">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:shrink-0">
        <Suspense>
          <Sidebar />
        </Suspense>
      </div>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Suspense>
          <DashboardHeader />
        </Suspense>
        <main className="flex-1 overflow-y-auto">
          <Suspense>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
