import type { Metadata } from "next";

import { AccountPanel } from "@/components/auth/account-panel";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    <AuthShell>
      <AccountPanel />
    </AuthShell>
  );
}
