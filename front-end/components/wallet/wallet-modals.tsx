"use client";

import { AlertCircle, Banknote, ChevronDown, ChevronUp, CreditCard, Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { createPortal } from "react-dom";

import { BusyBar } from "@/components/loader/busy-bar";
import { getToken } from "@/lib/firebase/auth";
import { gsap, isReducedMotion, useGSAP } from "@/lib/gsap/effects";
import { playMoment } from "@/lib/loading/moment";
import { cn } from "@/lib/utils";

const FOCUSABLE = "button:not([disabled]), input:not([disabled]), select:not([disabled])";
/** Below this it's a sheet from the bottom edge. At and above it, a centred card. */
const isCard = () => window.matchMedia("(min-width: 640px)").matches;
/** How far, or how fast in px per ms, a swipe down has to go to dismiss the sheet. */
const DISMISS_PX = 90;
const DISMISS_SPEED = 0.5;

const QUICK_AMOUNTS = [1000, 5000, 10000, 50000];
const METHODS = [
  { key: "card", title: "Card", detail: "Visa, Mastercard", Icon: CreditCard },
  { key: "bank", title: "Bank transfer", detail: "Direct deposit", Icon: Banknote },
] as const;

const FIELD =
  "w-full rounded-xl border border-line bg-paper px-4 py-3 text-[16px] text-ink placeholder:text-ink-muted outline-none transition-[border-color,box-shadow] duration-150 focus:border-green focus:ring-3 focus:ring-green/20";

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Digits and up to two decimals, as typed. Commas are only ever for showing. */
function cleanAmount(typed: string) {
  const plain = typed.replace(/[^\d.]/g, "");
  const [whole, ...rest] = plain.split(".");
  const naira = whole.replace(/^0+(?=\d)/, "");
  return plain.includes(".") ? `${naira}.${rest.join("").slice(0, 2)}` : naira;
}

function showAmount(amount: string) {
  const [whole, kobo] = amount.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return kobo === undefined ? grouped : `${grouped}.${kobo}`;
}

function formatKobo(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: kobo % 100 ? 2 : 0 })}`;
}

function ModalShell({
  open,
  onClose,
  busy,
  title,
  lead,
  error,
  submitLabel,
  submitIcon,
  onSubmit,
  children,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  title: string;
  lead: string;
  error: string | null;
  submitLabel: string;
  submitIcon: ReactNode;
  onSubmit: () => void;
  children: ReactNode;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const motion = useRef<gsap.core.Timeline | null>(null);
  const drag = useRef<{ y: number; at: number; last: number } | null>(null);

  // A payment that's being started can't be walked away from halfway.
  const close = () => {
    if (!busy) onClose();
  };
  const latestClose = useRef(close);
  useEffect(() => {
    latestClose.current = close;
  });

  // Stays on screen after `open` turns false, until the way out has played.
  const [shown, setShown] = useState(false);
  if (open && !shown) setShown(true);

  useGSAP(
    () => {
      const scope = root.current;
      if (!scope || !shown) return;
      const reduced = isReducedMotion();
      motion.current?.kill();

      if (open) {
        const timeline = gsap.timeline();
        motion.current = timeline;
        timeline.fromTo(backdrop.current, { opacity: 0 }, { opacity: 1, duration: reduced ? 0.15 : 0.3, ease: "power2.out" }, 0);
        if (reduced) {
          timeline.fromTo(card.current, { opacity: 0 }, { opacity: 1, duration: 0.15 }, 0);
          return;
        }
        if (isCard()) {
          timeline.fromTo(card.current, { opacity: 0, y: 28, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "expo.out" }, 0.03);
        } else {
          timeline.fromTo(card.current, { y: card.current?.offsetHeight ?? 500, opacity: 1 }, { y: 0, duration: 0.55, ease: "expo.out" }, 0.02);
        }
        timeline.fromTo(
          scope.querySelectorAll("[data-rise]"),
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.42, ease: "power3.out", stagger: 0.045, clearProps: "transform,opacity" },
          0.1,
        );
        return;
      }

      const timeline = gsap.timeline({
        onComplete: () => {
          setShown(false);
          opener.current?.focus({ preventScroll: true });
        },
      });
      motion.current = timeline;
      timeline
        .to(
          card.current,
          reduced
            ? { opacity: 0, duration: 0.12 }
            : isCard()
              ? { opacity: 0, y: 12, scale: 0.98, duration: 0.2, ease: "power2.in" }
              : { y: card.current?.offsetHeight ?? 500, duration: 0.26, ease: "power2.in" },
          0,
        )
        .to(backdrop.current, { opacity: 0, duration: 0.24, ease: "power1.in" }, 0.02);
    },
    { dependencies: [open, shown] },
  );

  // Escape closes, Tab stays inside, and focus goes back to whatever opened it. Only a card takes
  // focus into the first field, because on a phone that would throw the keyboard up mid-slide.
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    const first = isCard() ? card.current?.querySelector<HTMLElement>("input") : null;
    (first ?? card.current)?.focus({ preventScroll: true });
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        latestClose.current();
        return;
      }
      if (event.key !== "Tab" || !card.current) return;
      const items = Array.from(card.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      const start = items[0];
      const end = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === start || active === card.current)) {
        event.preventDefault();
        end?.focus();
      } else if (!event.shiftKey && active === end) {
        event.preventDefault();
        start?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!shown) return null;

  // Swiping the top of the sheet follows the finger, and past a point lets it go.
  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (isCard() || isReducedMotion() || busy) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    motion.current?.kill();
    gsap.set(root.current?.querySelectorAll("[data-rise]") ?? [], { clearProps: "transform,opacity" });
    gsap.set(backdrop.current, { opacity: 1 });
    gsap.set(card.current, { opacity: 1 });
    drag.current = { y: event.clientY, at: event.timeStamp, last: 0 };
  }
  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const distance = Math.max(event.clientY - drag.current.y, 0);
    drag.current.last = distance;
    gsap.set(card.current, { y: distance });
    gsap.set(backdrop.current, { opacity: 1 - distance / (card.current?.offsetHeight ?? 500) });
  }
  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const { last, at } = drag.current;
    drag.current = null;
    if (last >= DISMISS_PX || last / Math.max(event.timeStamp - at, 1) >= DISMISS_SPEED) {
      close();
      return;
    }
    gsap.to(card.current, { y: 0, duration: 0.45, ease: "expo.out" });
    gsap.to(backdrop.current, { opacity: 1, duration: 0.25 });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!busy) onSubmit();
  }

  // On the body, so a moving or scrolling dashboard panel can't shift it or scroll behind it.
  return createPortal(
    <div ref={root} className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden overscroll-contain sm:items-center sm:p-4">
      <div ref={backdrop} aria-hidden="true" onClick={close} className="absolute inset-0 bg-field/70 backdrop-blur-sm" />

      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-lead`}
        tabIndex={-1}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_24px_60px_-20px_rgb(14_46_35/0.45)] outline-none sm:max-h-[calc(100dvh-2rem)] sm:max-w-[480px] sm:rounded-[28px]"
      >
        <button
          type="button"
          onClick={close}
          disabled={busy}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 flex size-11 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-sage-soft hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-40 sm:top-4 sm:right-4"
        >
          <X aria-hidden="true" strokeWidth={1.75} className="size-5" />
        </button>

        {/* The part of the sheet you can swipe. The handle says so, and it has no job on a card. */}
        <div
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="shrink-0 touch-none select-none px-5 pt-2.5 pb-4 pr-14 sm:touch-auto sm:select-auto sm:px-7 sm:pt-7 sm:pb-5 sm:pr-16"
        >
          <span aria-hidden="true" className="mx-auto mb-3.5 block h-1 w-10 translate-x-[18px] rounded-full bg-line sm:hidden" />
          <h2 id={`${id}-title`} data-rise className="font-display text-[24px] leading-[1.2] font-medium text-ink sm:text-[28px]">
            {title}
          </h2>
          <p id={`${id}-lead`} data-rise className="mt-1 text-body-sm text-ink-muted">
            {lead}
          </p>
        </div>

        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-5 pt-1 pb-5 sm:px-7 sm:pb-6">
            {children}
            <FormError message={error} />
          </div>

          <div data-rise className="flex shrink-0 gap-3 border-t border-line px-5 pt-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:px-7 sm:py-4">
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="min-h-12 rounded-xl border border-line px-5 text-body-sm font-medium text-ink-muted transition-colors duration-150 hover:border-ink-muted/40 hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              aria-busy={busy}
              className={`relative flex min-h-12 flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl bg-green text-body-sm font-medium text-paper transition-[background-color,transform] duration-150 hover:bg-green-hover focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.98] motion-reduce:active:scale-100${busy ? " pointer-events-none" : ""}`}
            >
              {submitIcon}
              {submitLabel}
              <BusyBar active={busy} />
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function FormError({ message }: { message: string | null }) {
  const box = useRef<HTMLParagraphElement>(null);
  useGSAP(
    () => {
      if (!box.current || isReducedMotion()) return;
      gsap.fromTo(box.current, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.28, ease: "power2.out", clearProps: "transform,opacity" });
    },
    { dependencies: [message] },
  );
  if (!message) return null;
  return (
    <p ref={box} role="alert" className="flex items-start gap-2.5 rounded-xl bg-danger/10 px-3.5 py-3 text-body-sm text-ink">
      <AlertCircle aria-hidden="true" strokeWidth={1.75} className="mt-px size-[18px] shrink-0 text-danger" />
      {message}
    </p>
  );
}

function AmountField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  const id = useId();
  return (
    <>
      <label htmlFor={id} className="mb-2 block text-body-sm font-medium text-ink">
        Amount
      </label>
      <div className="flex items-center gap-1.5 rounded-xl border border-line bg-paper px-4 transition-[border-color,box-shadow] duration-150 focus-within:border-green focus-within:ring-3 focus-within:ring-green/20">
        <span aria-hidden="true" className="font-num text-[22px] text-ink-muted">₦</span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={showAmount(value)}
          onChange={(event) => onChange(cleanAmount(event.target.value))}
          placeholder={placeholder}
          aria-label="Amount in naira"
          className="min-w-0 flex-1 bg-transparent py-3.5 font-num text-[22px] text-ink outline-none placeholder:text-ink-muted/50"
        />
      </div>
    </>
  );
}

export function FundModal({
  open,
  onClose,
  email,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  email: string;
  onDone: (message: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"card" | "bank">("card");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function dismiss() {
    setError(null);
    onClose();
  }

  async function fund() {
    const naira = parseFloat(amount);
    if (!naira || naira < 100) {
      setError("The least you can add is ₦100.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ amountKobo: Math.round(naira * 100), email }),
      });
      const data = (await res.json().catch(() => ({}))) as { authorizationUrl?: string; message?: string; error?: string };
      if (!res.ok) throw new Error(data.message ?? data.error ?? "We couldn't start that payment. Try again.");
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
        return;
      }
      setAmount("");
      onClose();
      onDone(data.message ?? `₦${naira.toLocaleString("en-NG")} added to your wallet`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't start that payment. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={dismiss}
      busy={busy}
      title="Add funds"
      lead="Available immediately after payment"
      error={error}
      submitLabel="Fund wallet"
      submitIcon={<Plus aria-hidden="true" strokeWidth={2} className="size-4" />}
      onSubmit={fund}
    >
      <div data-rise>
        <AmountField value={amount} onChange={(value) => { setAmount(value); setError(null); }} placeholder="5,000" />
        <div className="mt-3 grid grid-cols-4 gap-2">
          {QUICK_AMOUNTS.map((quick) => {
            const chosen = amount === String(quick);
            return (
              <button
                key={quick}
                type="button"
                aria-pressed={chosen}
                onClick={() => { setAmount(String(quick)); setError(null); }}
                className={cn(
                  "min-h-11 rounded-full border px-1 font-num text-[13px] font-medium transition-[background-color,border-color,color,transform] duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.96] motion-reduce:active:scale-100",
                  chosen ? "border-field bg-field text-paper" : "border-line text-ink-muted hover:border-green hover:text-green",
                )}
              >
                ₦{quick.toLocaleString("en-NG")}
              </button>
            );
          })}
        </div>
      </div>

      <div data-rise>
        <p className="mb-2 text-body-sm font-medium text-ink">Payment method</p>
        <div className="grid grid-cols-2 gap-2.5">
          {METHODS.map(({ key, title, detail, Icon }) => {
            const chosen = method === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={chosen}
                onClick={() => setMethod(key)}
                className={cn(
                  "flex flex-col items-start gap-2.5 rounded-2xl border p-3.5 text-left transition-[background-color,border-color,transform] duration-200 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.98] motion-reduce:active:scale-100",
                  chosen ? "border-green bg-sage-soft" : "border-line hover:border-green/50 hover:bg-paper/60",
                )}
              >
                <Icon aria-hidden="true" strokeWidth={1.5} className={cn("size-5 transition-colors duration-200", chosen ? "text-green" : "text-ink-muted")} />
                <span>
                  <span className="block text-body-sm font-medium text-ink">{title}</span>
                  <span className="mt-0.5 block text-label text-ink-muted">{detail}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </ModalShell>
  );
}

export function WithdrawModal({
  open,
  onClose,
  availableKobo,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  availableKobo: number | null;
  onDone: (message: string) => void;
}) {
  const id = useId();
  const [amount, setAmount] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [banks, setBanks] = useState<Array<{ name: string; code: string }>>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load banks when modal opens
  useEffect(() => {
    if (!open || banks.length > 0) return;
    setBanksLoading(true);
    fetch("/api/wallet/banks")
      .then((r) => r.ok ? r.json() : [])
      .then((data: Array<{ name: string; code: string }>) => setBanks(data))
      .catch(() => {})
      .finally(() => setBanksLoading(false));
  }, [open, banks.length]);

  // Auto-verify account name when bank + 10 digits are set
  useEffect(() => {
    if (!bankCode || accountNumber.length !== 10) {
      setAccountName("");
      setVerifyError(null);
      return;
    }
    if (verifyTimer.current) clearTimeout(verifyTimer.current);
    verifyTimer.current = setTimeout(async () => {
      setVerifying(true);
      setVerifyError(null);
      setAccountName("");
      try {
        const headers = await authHeaders();
        const res = await fetch(
          `/api/wallet/verify-account?bankCode=${encodeURIComponent(bankCode)}&accountNumber=${encodeURIComponent(accountNumber)}`,
          { headers },
        );
        const data = (await res.json()) as { ok: boolean; accountName?: string; message?: string };
        if (data.ok && data.accountName) {
          setAccountName(data.accountName);
        } else {
          setVerifyError(data.message ?? "Could not verify account. Check the number.");
        }
      } catch {
        setVerifyError("Could not reach Paystack. Check your connection.");
      } finally {
        setVerifying(false);
      }
    }, 600);
  }, [bankCode, accountNumber]);

  function dismiss() {
    setError(null);
    setVerifyError(null);
    onClose();
  }

  async function withdraw() {
    const naira = parseFloat(amount);
    if (!naira || naira < 500) { setError("The least you can withdraw is ₦500."); return; }
    const amountKobo = Math.round(naira * 100);
    if (availableKobo !== null && amountKobo > availableKobo) { setError(`You have ${formatKobo(availableKobo)} available.`); return; }
    if (!bankCode) { setError("Select your bank."); return; }
    if (accountNumber.length !== 10) { setError("Enter your 10-digit account number."); return; }
    if (!accountName.trim()) { setError("Wait for the account name to be verified, or check your account details."); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ amountKobo, bankName, bankCode, accountNumber, accountName: accountName.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string; transferStatus?: string };
      if (!res.ok) throw new Error(data.error ?? data.message ?? "We couldn't send that withdrawal. Try again.");
      const shown = `₦${naira.toLocaleString("en-NG")}`;
      playMoment({
        label: "Sending your money",
        work: Promise.resolve({
          top: "Withdrawal",
          line: data.transferStatus === "success" ? "Paid to your bank" : "On its way to your bank",
          fraction: 1,
          text: shown,
        }),
      });
      setAmount(""); setBankCode(""); setBankName(""); setAccountNumber(""); setAccountName("");
      onClose();
      onDone(data.message ?? `Withdrawal of ${shown} submitted.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't send that withdrawal. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={dismiss}
      busy={busy}
      title="Withdraw to bank"
      lead="Processed via Paystack to your Nigerian bank"
      error={error}
      submitLabel="Withdraw funds"
      submitIcon={<ChevronUp aria-hidden="true" strokeWidth={2} className="size-4" />}
      onSubmit={withdraw}
    >
      <div data-rise>
        <AmountField value={amount} onChange={(value) => { setAmount(value); setError(null); }} placeholder="20,000" />
        {availableKobo !== null && (
          <div className="mt-2.5 flex items-center gap-2">
            <span className="text-label text-ink-muted">Available</span>
            <span className="font-num text-body-sm font-medium text-green">{formatKobo(availableKobo)}</span>
            <button type="button" onClick={() => { setAmount(String(availableKobo / 100)); setError(null); }}
              className="ml-auto min-h-9 rounded-full border border-line px-3.5 text-label font-medium text-ink-muted transition-colors duration-150 hover:border-green hover:text-green focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              Max
            </button>
          </div>
        )}
      </div>

      <div data-rise>
        <label htmlFor={`${id}-bank`} className="mb-2 block text-body-sm font-medium text-ink">Bank</label>
        <div className="relative">
          <select
            id={`${id}-bank`}
            value={bankCode}
            disabled={banksLoading}
            onChange={(e) => {
              const selected = banks.find((b) => b.code === e.target.value);
              setBankCode(e.target.value);
              setBankName(selected?.name ?? "");
              setAccountName("");
              setVerifyError(null);
              setError(null);
            }}
            className={cn(FIELD, "appearance-none pr-10", !bankCode && "text-ink-muted")}
          >
            <option value="">{banksLoading ? "Loading banks…" : "Select your bank"}</option>
            {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
          </select>
          <ChevronDown aria-hidden="true" strokeWidth={1.75} className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-muted" />
        </div>
      </div>

      <div data-rise>
        <label htmlFor={`${id}-number`} className="mb-2 block text-body-sm font-medium text-ink">Account number</label>
        <input
          id={`${id}-number`}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          value={accountNumber}
          onChange={(e) => { setAccountNumber(e.target.value.replace(/\D/g, "")); setAccountName(""); setVerifyError(null); setError(null); }}
          placeholder="10 digits"
          className={cn(FIELD, "font-num")}
        />
        <p className="mt-1 font-num text-label tabular-nums text-ink-muted">{accountNumber.length}/10</p>
      </div>

      {/* Auto-verified account name */}
      <div data-rise>
        <label htmlFor={`${id}-name`} className="mb-2 block text-body-sm font-medium text-ink">
          Account name
          {verifying && <span className="ml-2 text-label font-normal text-ink-muted animate-pulse">Verifying…</span>}
        </label>
        <input
          id={`${id}-name`}
          type="text"
          readOnly={!!accountName}
          value={accountName}
          onChange={(e) => { if (!verifying) setAccountName(e.target.value); }}
          placeholder={verifying ? "Verifying with Paystack…" : "Auto-filled after verification"}
          className={cn(
            FIELD,
            accountName ? "border-green bg-sage-soft/40 text-green font-medium" : "",
            verifying ? "opacity-60" : "",
          )}
        />
        {verifyError && (
          <p role="alert" className="mt-1.5 text-body-sm text-danger">{verifyError}</p>
        )}
        {accountName && !verifying && (
          <p className="mt-1.5 flex items-center gap-1.5 text-body-sm font-medium text-green">
            <span aria-hidden>✓</span> Account verified
          </p>
        )}
      </div>
    </ModalShell>
  );
}
