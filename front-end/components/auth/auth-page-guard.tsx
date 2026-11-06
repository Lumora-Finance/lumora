"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { useAuthUser } from "@/components/auth/use-auth-user";

/**
 * Wraps auth pages (login / signup). If the user is already signed in,
 * they are sent straight to the dashboard instead of seeing the form.
 */
export function AuthPageGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuthUser();

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  // Render nothing while we're still checking auth state, or while redirecting
  if (loading || user) return null;

  return <>{children}</>;
}
