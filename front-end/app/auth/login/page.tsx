import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";
import { CallbackError } from "@/components/auth/auth-notice";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <AuthShell>
      <h1 className="text-[2rem] leading-10 font-semibold tracking-[-0.01em]">Sign in to your account</h1>
      <p className="mt-2 text-ink-muted">Welcome back. Your buyers and bookings are waiting.</p>
      <Suspense>
        <CallbackError />
      </Suspense>
      <AuthForm mode="login" />
    </AuthShell>
  );
}
