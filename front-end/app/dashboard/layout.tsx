"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, Suspense, useEffect } from "react";

import { useAuthUser } from "@/components/auth/use-auth-user";
import { DashboardScroll } from "@/components/dashboard/dashboard-scroll";
import { DashboardHeader } from "@/components/dashboard/header";
import { FirstLoad } from "@/components/loader/first-load";
import { Sidebar } from "@/components/dashboard/sidebar";

export const instant = false;

function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuthUser();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth/login");
    }
  }, [loading, user, router]);

  // While loading, or if redirecting, render nothing to avoid a flash of dashboard content
  if (loading || !user) return null;

  return <>{children}</>;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
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
    </AuthGuard>
  );
}
