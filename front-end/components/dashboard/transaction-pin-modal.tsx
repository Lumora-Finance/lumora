"use client";

import { useEffect, useRef, useState } from "react";
import { X, Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import { getAuth } from "firebase/auth";

import app from "@/lib/firebase/config";
import { cn } from "@/lib/utils";

type Mode = "set" | "verify";

type Props = {
  mode: Mode;
  onSuccess: () => void;
  onClose: () => void;
};

async function getToken(): Promise<string | null> {
  return getAuth(app).currentUser?.getIdToken() ?? null;
}

async function callPinApi(method: "POST" | "GET" | "PATCH", body?: { pin: string }) {
  const token = await getToken();
  return fetch("/api/pin", {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function TransactionPinModal({ mode, onSuccess, onClose }: Props) {
  // "entry" | "confirm" | "done"
  const [stage, setStage] = useState<"entry" | "confirm" | "done">("entry");
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [confirmDigits, setConfirmDigits] = useState<string[]>(["", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entryRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const confirmRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  // Auto-focus first box on open
  useEffect(() => { entryRefs[0].current?.focus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDigit(
    index: number,
    value: string,
    arr: string[],
    setArr: (d: string[]) => void,
    refs: typeof entryRefs,
  ) {
    const v = value.replace(/\D/g, "").slice(-1);
    const next = [...arr];
    next[index] = v;
    setArr(next);
    setError(null);
    if (v && index < 3) refs[index + 1].current?.focus();
  }

  function handleKeyDown(
    e: React.KeyboardEvent,
    index: number,
    arr: string[],
    setArr: (d: string[]) => void,
    refs: typeof entryRefs,
  ) {
    if (e.key === "Backspace" && !arr[index] && index > 0) {
      refs[index - 1].current?.focus();
      const next = [...arr];
      next[index - 1] = "";
      setArr(next);
    }
  }

  const pin = digits.join("");
  const confirm = confirmDigits.join("");
  const pinComplete = pin.length === 4;
  const confirmComplete = confirm.length === 4;

  async function handleSubmit() {
    if (mode === "set") {
      if (!pinComplete) return;
      if (stage === "entry") {
        setStage("confirm");
        setTimeout(() => confirmRefs[0].current?.focus(), 50);
        return;
      }
      // stage === "confirm"
      if (!confirmComplete) return;
      if (pin !== confirm) {
        setError("PINs don't match. Try again.");
        setConfirmDigits(["", "", "", ""]);
        setTimeout(() => confirmRefs[0].current?.focus(), 50);
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const res = await callPinApi("POST", { pin });
        const json = (await res.json()) as { ok?: boolean; message?: string };
        if (json.ok) {
          setStage("done");
          setTimeout(onSuccess, 800);
        } else {
          setError("Couldn't save PIN. Try again.");
        }
      } catch {
        setError("Network error. Try again.");
      } finally {
        setBusy(false);
      }
    } else {
      // verify mode
      if (!pinComplete) return;
      setBusy(true);
      setError(null);
      try {
        const res = await callPinApi("PATCH", { pin });
        const json = (await res.json()) as { valid?: boolean; code?: string };
        if (json.valid) {
          setStage("done");
          setTimeout(onSuccess, 600);
        } else if (json.code === "no_pin") {
          setError("You haven't set a PIN yet. Go to Settings → Security.");
        } else {
          setError("Incorrect PIN. Please try again.");
          setDigits(["", "", "", ""]);
          setTimeout(() => entryRefs[0].current?.focus(), 50);
        }
      } catch {
        setError("Network error. Try again.");
      } finally {
        setBusy(false);
      }
    }
  }

  const activeDigits = stage === "confirm" ? confirmDigits : digits;
  const setActiveDigits = stage === "confirm" ? setConfirmDigits : setDigits;
  const activeRefs = stage === "confirm" ? confirmRefs : entryRefs;
  const isComplete = stage === "confirm" ? confirmComplete : pinComplete;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-field/60 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl border border-line bg-paper shadow-2xl">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-sage-soft hover:text-ink"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        <div className="p-7">
          {/* Icon + title */}
          <div className="flex flex-col items-center text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-green/10">
              {stage === "done" ? (
                <CheckCircle2 strokeWidth={1.5} className="size-7 text-green" />
              ) : (
                <ShieldCheck strokeWidth={1.5} className="size-7 text-green" />
              )}
            </div>

            <h2 className="mt-4 font-display text-[1.4rem] font-medium text-ink">
              {stage === "done"
                ? mode === "set" ? "PIN saved" : "Verified"
                : mode === "verify"
                  ? "Enter your PIN"
                  : stage === "entry"
                    ? "Create a 4-digit PIN"
                    : "Confirm your PIN"}
            </h2>
            <p className="mt-1 text-body-sm text-ink-muted">
              {stage === "done"
                ? mode === "set" ? "Your transaction PIN is now active." : "Identity confirmed."
                : mode === "verify"
                  ? "Enter your PIN to authorise this action."
                  : stage === "entry"
                    ? "This protects your transactions."
                    : "Re-enter the same PIN to confirm."}
            </p>
          </div>

          {/* PIN boxes */}
          {stage !== "done" && (
            <div className="mt-7 flex justify-center gap-3">
              {activeDigits.map((d, i) => (
                <input
                  key={i}
                  ref={activeRefs[i]}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleDigit(i, e.target.value, activeDigits, setActiveDigits, activeRefs)}
                  onKeyDown={(e) => handleKeyDown(e, i, activeDigits, setActiveDigits, activeRefs)}
                  className={cn(
                    "size-14 rounded-xl border-2 bg-white text-center font-num text-[1.5rem] font-medium text-ink outline-none transition-all duration-150",
                    d ? "border-green" : "border-line",
                    "focus:border-green focus:ring-3 focus:ring-green/20",
                  )}
                  aria-label={`Digit ${i + 1}`}
                />
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <p role="alert" className="mt-4 text-center text-body-sm text-danger">
              {error}
            </p>
          )}

          {/* Submit */}
          {stage !== "done" && (
            <button
              onClick={handleSubmit}
              disabled={!isComplete || busy}
              className={cn(
                "mt-7 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-body font-medium text-paper transition-all duration-200",
                isComplete && !busy
                  ? "bg-green hover:bg-green-hover"
                  : "bg-green/40 cursor-not-allowed",
              )}
            >
              {busy ? (
                <><Loader2 className="size-4 animate-spin" /> Processing…</>
              ) : mode === "set" && stage === "entry" ? (
                "Continue"
              ) : mode === "set" ? (
                "Save PIN"
              ) : (
                "Confirm"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
