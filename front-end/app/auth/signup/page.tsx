import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthPageGuard } from "@/components/auth/auth-page-guard";
import { AuthForm } from "@/components/auth/auth-form";
import { DEFAULT_SUBLINE, SignupSubline } from "@/components/auth/auth-notice";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Create your account",
  robots: { index: false, follow: true },
};

export default function SignupPage() {
  return (
    <AuthPageGuard>
      <AuthShell>
        <h1 className="text-[2rem] leading-10 font-semibold tracking-[-0.01em]">Create your account</h1>
        <p className="mt-2 text-ink-muted">
          <Suspense fallback={DEFAULT_SUBLINE}>
            <SignupSubline />
          </Suspense>
        </p>
        <AuthForm mode="signup" />
      </AuthShell>
    </AuthPageGuard>
  );
}
