"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type Mode = "signup" | "login";
type Step = "phone" | "otp";

const AFTER_SIGN_IN = "/onboarding";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Normalise a Nigerian phone number to E.164 (+234…). */
function toE164(raw: string): string | null {
  // Strip whitespace, dashes, parentheses
  const digits = raw.replace(/[\s\-().]/g, "");
  // Already in E.164
  if (/^\+234\d{10}$/.test(digits)) return digits;
  // Leading 0: 08012345678 → +2348012345678
  if (/^0\d{10}$/.test(digits)) return `+234${digits.slice(1)}`;
  // Already stripped of leading zero: 8012345678
  if (/^\d{10}$/.test(digits)) return `+234${digits}`;
  // Starts with 234 without +
  if (/^234\d{10}$/.test(digits)) return `+${digits}`;
  return null;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-center gap-1.5 text-body-sm text-danger">
      <AlertCircle aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0" />
      {message}
    </p>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const supabase = createClient();

  const phoneId = useId();
  const otpId = useId();
  const termsId = useId();

  const isSignup = mode === "signup";

  // ── state ────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Focus the OTP field when it appears
  const otpRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (step === "otp") otpRef.current?.focus();
  }, [step]);

  // Redirect once the session is established
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        const next = new URLSearchParams(window.location.search).get("next");
        router.replace(next && /^\/(?![/\\])/.test(next) ? next : AFTER_SIGN_IN);
      }
    });
    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Step 1: send OTP ─────────────────────────────────────────────────────
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setPhoneError(null);
    setTermsError(null);
    setNotice(null);

    if (isSignup && !termsAccepted) {
      setTermsError("You must accept the Terms and Privacy Policy to create an account.");
      return;
    }

    const e164 = toE164(phone.trim());
    if (!e164) {
      setPhoneError("Enter a valid Nigerian phone number (e.g. 08012345678).");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: e164,
        options: { shouldCreateUser: true },
      });
      if (error) {
        setPhoneError(friendlyError(error.message));
        return;
      }
      setNotice(`A 6-digit code was sent to ${formatDisplay(e164)}. It expires in 10 minutes.`);
      setStep("otp");
    } finally {
      setBusy(false);
    }
  }

  // ── Step 2: verify OTP ───────────────────────────────────────────────────
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setOtpError(null);

    const code = otp.replace(/\s/g, "");
    if (!/^\d{6}$/.test(code)) {
      setOtpError("Enter the 6-digit code from your SMS.");
      return;
    }

    const e164 = toE164(phone.trim())!;
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: e164,
        token: code,
        type: "sms",
      });
      if (error) {
        setOtpError(friendlyError(error.message));
      }
      // On success, onAuthStateChange fires → redirect
    } finally {
      setBusy(false);
    }
  }

  // ── Resend ───────────────────────────────────────────────────────────────
  async function handleResend() {
    setOtpError(null);
    setNotice(null);
    const e164 = toE164(phone.trim())!;
    setBusy(true);
    try {
      await supabase.auth.signInWithOtp({ phone: e164 });
      setNotice("A new code has been sent.");
    } finally {
      setBusy(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Step 1: phone number ─────────────────────────────────────── */}
      {step === "phone" && (
        <form onSubmit={handleSendOtp} noValidate className="mt-8 space-y-5">
          <div>
            <Label htmlFor={phoneId} className="mb-1.5">
              Phone number
            </Label>
            <Input
              id={phoneId}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="08012345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={Boolean(phoneError)}
              aria-describedby={phoneError ? `${phoneId}-error` : undefined}
              disabled={busy}
            />
            <FieldError id={`${phoneId}-error`} message={phoneError ?? undefined} />
          </div>

          {/* T&C checkbox — signup only */}
          {isSignup && (
            <div className="space-y-1">
              <div className="flex items-start gap-3">
                <input
                  id={termsId}
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => {
                    setTermsAccepted(e.target.checked);
                    if (e.target.checked) setTermsError(null);
                  }}
                  aria-describedby={termsError ? `${termsId}-error` : undefined}
                  className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--color-green,#1a7c3e)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                />
                <Label
                  htmlFor={termsId}
                  className="cursor-pointer text-body-sm font-normal leading-snug text-ink-muted"
                >
                  I have read and agree to Lumora&rsquo;s{" "}
                  <Link
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-green underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    tabIndex={0}
                  >
                    Terms&nbsp;&amp;&nbsp;Conditions
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-green underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    tabIndex={0}
                  >
                    Privacy&nbsp;Policy
                  </Link>
                  .
                </Label>
              </div>
              <FieldError id={`${termsId}-error`} message={termsError ?? undefined} />
            </div>
          )}

          <Button type="submit" disabled={busy} className="h-12 w-full md:h-12">
            {busy ? (
              <>
                <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
                Sending code…
              </>
            ) : isSignup ? (
              "Create account"
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      )}

      {/* ── Step 2: OTP verification ──────────────────────────────────── */}
      {step === "otp" && (
        <form onSubmit={handleVerifyOtp} noValidate className="mt-8 space-y-5">
          {notice && (
            <p role="status" className="flex items-start gap-2 text-body-sm text-success">
              <Check aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-4 shrink-0" />
              {notice}
            </p>
          )}

          <div>
            <Label htmlFor={otpId} className="mb-1.5">
              Verification code
            </Label>
            <Input
              ref={otpRef}
              id={otpId}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              aria-invalid={Boolean(otpError)}
              aria-describedby={otpError ? `${otpId}-error` : undefined}
              disabled={busy}
              className="tracking-widest"
            />
            <FieldError id={`${otpId}-error`} message={otpError ?? undefined} />
          </div>

          <Button type="submit" disabled={busy} className="h-12 w-full md:h-12">
            {busy ? (
              <>
                <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
                Verifying…
              </>
            ) : (
              "Verify and continue"
            )}
          </Button>

          <div className="flex flex-wrap items-center justify-between gap-3 text-body-sm text-ink-muted">
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setOtp("");
                setOtpError(null);
                setNotice(null);
              }}
              className="rounded-sm underline-offset-4 hover:text-ink hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              Change number
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={busy}
              className="rounded-sm underline-offset-4 hover:text-ink hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
            >
              Resend code
            </button>
          </div>
        </form>
      )}

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

// ── Utilities ──────────────────────────────────────────────────────────────

function formatDisplay(e164: string) {
  // +2348012345678 → +234 801 234 5678
  const local = e164.slice(4); // 8012345678
  return `+234 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid") && m.includes("otp")) return "That code is wrong or has expired.";
  if (m.includes("expired")) return "The code has expired. Request a new one.";
  if (m.includes("too many") || m.includes("rate")) return "Too many attempts. Wait a few minutes and try again.";
  if (m.includes("network") || m.includes("fetch")) return "Couldn't reach the server. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}
