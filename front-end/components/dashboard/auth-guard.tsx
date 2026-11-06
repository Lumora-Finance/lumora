"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { useAuthUser } from "@/components/auth/use-auth-user";

/** Redirects unauthenticated users to /auth/login. Shows nothing until auth is resolved. */
export function DashboardAuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuthUser();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth/login");
    }
  }, [loading, user, router]);

  // Once we know there's no session, we're on the way to the sign-in page.
  if (!loading && !user) return null;

  // Rendered but hidden while the session is restored. Next.js checks each page ahead of time, so
  // rendering nothing here would drop the page, and it warns about that on every route.
  return <div className={loading ? "contents invisible" : "contents"}>{children}</div>;
}
