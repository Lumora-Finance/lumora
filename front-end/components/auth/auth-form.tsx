"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { AlertCircle, Check, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authErrorMessage, getFirebaseAuth, isPopupDismissed } from "@/lib/firebase/auth";

import { useAuthUser } from "./use-auth-user";

type Mode = "signup" | "login";
type Values = { email: string; password: string };

const AFTER_SIGN_IN = "/marketplace";

const schemas = {
  signup: z.object({
    email: z.email("Enter a valid email address."),
    password: z.string().min(8, "Use at least 8 characters."),
  }),
  login: z.object({
    email: z.email("Enter a valid email address."),
    password: z.string().min(1, "Enter your password."),
  }),
};

const NOT_CONNECTED = "Accounts aren't connected yet. Please try again soon.";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1.5 text-body-sm text-danger">
      <AlertCircle aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0" />
      {message}
    </p>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { user, loading } = useAuthUser();
  // Next keeps visited pages mounted but hidden, so the login and signup forms can coexist.
  const emailId = useId();
  const passwordId = useId();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [googlePending, setGooglePending] = useState(false);
  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schemas[mode]) });

  // Covers every route in: this form, Google, and arriving while already signed in.
  // The reset matters because this page stays mounted, and a password must not stay in it.
  useEffect(() => {
    if (loading || !user) return;
    reset({ email: "", password: "" });
    router.replace(AFTER_SIGN_IN);
  }, [loading, user, reset, router]);

  async function onSubmit({ email, password }: Values) {
    setFormError(null);
    setNotice(null);
    setShowPassword(false);
    const auth = getFirebaseAuth();
    if (!auth) {
      setFormError(NOT_CONNECTED);
      return;
    }

    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
        return;
      }
      const { user: created } = await createUserWithEmailAndPassword(auth, email, password);
      // The account already exists by now, so a failed email mustn't look like a failed sign-up.
      // The account page offers to send it again.
      await sendEmailVerification(created).catch(() => undefined);
    } catch (error) {
      setFormError(authErrorMessage(error));
    }
  }

  async function continueWithGoogle() {
    setFormError(null);
    setNotice(null);
    const auth = getFirebaseAuth();
    if (!auth) {
      setFormError(NOT_CONNECTED);
      return;
    }

    setGooglePending(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      if (!isPopupDismissed(error)) setFormError(authErrorMessage(error));
    } finally {
      setGooglePending(false);
    }
  }

  async function forgotPassword() {
    setFormError(null);
    setNotice(null);
    if (!(await trigger("email"))) return;

    const auth = getFirebaseAuth();
    if (!auth) {
      setFormError(NOT_CONNECTED);
      return;
    }

    const email = getValues("email");
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      // Saying "no such account" would reveal who has signed up, so only real failures show.
      if (code !== "auth/user-not-found") {
        setFormError(authErrorMessage(error));
        return;
      }
    }
    setNotice(`If ${email} has an account, a reset link is on its way.`);
  }

  const isSignup = mode === "signup";
  const busy = isSubmitting || googlePending || Boolean(user);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={continueWithGoogle}
        disabled={busy}
        className="mt-8 h-12 w-full md:h-12"
      >
        <GoogleIcon />
        Continue with Google
      </Button>

      <div className="my-6 flex items-center gap-4 text-body-sm text-ink-muted">
        <span aria-hidden="true" className="h-px flex-1 bg-line" />
        or use your email
        <span aria-hidden="true" className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <Label htmlFor={emailId} className="mb-1.5">
            Email
          </Label>
          <Input
            id={emailId}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? `${emailId}-error` : undefined}
            {...register("email")}
          />
          <FieldError id={`${emailId}-error`} message={errors.email?.message} />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-4">
            <Label htmlFor={passwordId}>Password</Label>
            {!isSignup && (
              <button
                type="button"
                onClick={forgotPassword}
                className="-my-2 rounded-sm py-2 text-body-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                Forgot password?
              </button>
            )}
          </div>
          <div className="relative">
            <Input
              id={passwordId}
              type={showPassword ? "text" : "password"}
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder={isSignup ? "At least 8 characters" : "Your password"}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? `${passwordId}-error` : undefined}
              className="pr-12"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-ink-muted transition-colors duration-200 hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {showPassword ? (
                <EyeOff aria-hidden="true" strokeWidth={1.5} className="size-5" />
              ) : (
                <Eye aria-hidden="true" strokeWidth={1.5} className="size-5" />
              )}
            </button>
          </div>
          <FieldError id={`${passwordId}-error`} message={errors.password?.message} />
        </div>

        {formError && (
          <p role="alert" className="flex items-start gap-2 text-body-sm text-danger">
            <AlertCircle aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-4 shrink-0" />
            {formError}
          </p>
        )}

        {notice && (
          <p role="status" className="flex items-start gap-2 text-body-sm text-success">
            <Check aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-4 shrink-0" />
            {notice}
          </p>
        )}

        <Button type="submit" disabled={busy} className="h-12 w-full md:h-12">
          {isSubmitting
            ? isSignup
              ? "Creating account"
              : "Signing in"
            : isSignup
              ? "Create account"
              : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-ink-muted">
        {isSignup ? "Already on Lumora? " : "New to Lumora? "}
        <Link
          href={isSignup ? "/auth/login" : "/auth/signup"}
          className="rounded-sm font-medium text-green underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {isSignup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </>
  );
}
