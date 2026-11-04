"use client";

import { sendEmailVerification, signOut } from "firebase/auth";
import { AlertCircle, Check, Clock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authErrorMessage, getFirebaseAuth } from "@/lib/firebase/auth";

import { useAuthUser } from "./use-auth-user";

export function AccountPanel() {
  const router = useRouter();
  const { user, loading } = useAuthUser();
  // Firebase updates the user object in place, so this only prompts a fresh read of it.
  const [, setReloads] = useState(0);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    // Picks up a confirmation link opened in another tab or on another device.
    user
      .reload()
      .then(() => setReloads((count) => count + 1))
      .catch(() => undefined);
  }, [loading, user, router]);

  async function resend() {
    if (!user) return;
    setError(null);
    setPending(true);
    try {
      await sendEmailVerification(user);
      setSent(true);
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  async function leave() {
    const auth = getFirebaseAuth();
    if (!auth) return;
    setError(null);
    setPending(true);
    try {
      await signOut(auth);
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  if (loading || !user) {
    return (
      <div role="status" aria-label="Loading your account" className="space-y-4">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="mt-8 h-12 w-full" />
      </div>
    );
  }

  return (
    <>
      <h1 className="text-[2rem] leading-10 font-semibold tracking-[-0.01em]">
        You&apos;re signed in
      </h1>
      <p className="mt-2 break-words text-ink-muted">{user.email}</p>

      {user.emailVerified ? (
        <p className="mt-8 flex items-center gap-2 font-medium text-success">
          <Check aria-hidden="true" strokeWidth={1.5} className="size-5" />
          Email confirmed
        </p>
      ) : (
        <div className="mt-8 rounded-xl border border-line bg-card p-5">
          <p className="flex items-center gap-2 font-medium">
            <Clock aria-hidden="true" strokeWidth={1.5} className="size-5" />
            Confirm your email
          </p>
          <p role="status" className="mt-2 text-ink-muted">
            {sent
              ? "We've sent a new link. Check your inbox and spam folder."
              : "We sent you a confirmation link. Open it to confirm this address."}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={resend}
            disabled={pending || sent}
            className="mt-4"
          >
            {sent ? "Link sent" : "Send it again"}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 flex items-start gap-2 text-body-sm text-danger">
          <AlertCircle aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <Link href="/marketplace" className={`${buttonVariants()} mt-6 h-12 w-full md:h-12`}>
        Go to the marketplace
      </Link>

      <Button
        type="button"
        variant="ghost"
        onClick={leave}
        disabled={pending}
        className="mt-3 w-full"
      >
        Sign out
      </Button>
    </>
  );
}
