"use client";

import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authErrorMessage, getFirebaseAuth, isPopupDismissed } from "@/lib/firebase/auth";

type Mode = "signup" | "login";

const AFTER_SIGN_IN = "/onboarding";

// ── Google logo SVG ────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const isSignup = mode === "signup";

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setError(null);
    const auth = getFirebaseAuth();
    if (!auth) {
      setError("Google sign-in is not configured. Please contact support.");
      return;
    }

    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      // Request the user's profile by default; prompt for account selection every time
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);

      // On success, redirect to onboarding (or wherever next= points)
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next && /^\/(?![/\\])/.test(next) ? next : AFTER_SIGN_IN);
    } catch (err) {
      if (!isPopupDismissed(err)) {
        setError(authErrorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mt-8 space-y-4">
        {error && (
          <p role="alert" className="flex items-center gap-1.5 text-body-sm text-danger">
            <AlertCircle aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0" />
            {error}
          </p>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleSignIn}
          disabled={busy}
          className="h-12 w-full gap-3 md:h-12"
        >
          {busy ? (
            <Loader2 aria-hidden="true" className="size-5 animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          {busy
            ? "Signing in…"
            : isSignup
            ? "Continue with Google"
            : "Sign in with Google"}
        </Button>
      </div>

      <p className="mt-6 text-center text-body-sm text-ink-muted">
        {isSignup ? "Already on Lumora? " : "New to Lumora? "}
        <Link
          href={isSignup ? "/auth/login" : "/auth/signup"}
          className="rounded-sm font-medium text-green underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {isSignup ? "Sign in" : "Create an account"}
        </Link>
      </p>

      {isSignup && (
        <p className="mt-4 text-center text-body-sm text-ink-muted">
          By continuing, you agree to Lumora&rsquo;s{" "}
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-green underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Terms&nbsp;&amp;&nbsp;Conditions
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-green underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Privacy&nbsp;Policy
          </Link>
          .
        </p>
      )}
    </>
  );
}
