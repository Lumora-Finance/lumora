"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { useAuthUser } from "@/components/auth/use-auth-user";

/** Redirects unauthenticated users to /auth/login. Renders nothing until auth is resolved. */
export function DashboardAuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuthUser();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth/login");
    }
  }, [loading, user, router]);

  // Render nothing while Firebase is restoring the session, or while redirecting
  if (loading || !user) return null;

  return <>{children}</>;
}
