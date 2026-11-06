import type { Metadata } from "next";

import { AuthPageGuard } from "@/components/auth/auth-page-guard";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <AuthPageGuard>
      <AuthShell>
        <h1 className="text-[2rem] leading-10 font-semibold tracking-[-0.01em]">Sign in to your account</h1>
        <p className="mt-2 text-ink-muted">Welcome back. Your buyers and bookings are waiting.</p>
        <AuthForm mode="login" />
      </AuthShell>
    </AuthPageGuard>
  );
}
