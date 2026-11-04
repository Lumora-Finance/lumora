import type { ReactNode } from "react";

import { DashboardHeader } from "@/components/dashboard/header";
import { Sidebar } from "@/components/dashboard/sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-svh bg-paper">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:shrink-0">
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardHeader />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
