"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

const PREFIX = "+234";

function toLocal(full: string): string {
  if (full.startsWith("+234")) return full.slice(4);
  if (full.startsWith("234")) return full.slice(3);
  if (full.startsWith("0")) return full.slice(1);
  return full;
}

export function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("234") && digits.length === 13) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+234${digits.slice(1)}`;
  if (digits.length === 10) return `+234${digits}`;
  return raw;
}

/** Returns null if valid, error string if not. Empty string passes (optional). */
export function validateNigerianPhone(value: string): string | null {
  if (!value) return null;
  const e164 = toE164(value);
  if (!/^\+234[789]\d{9}$/.test(e164)) {
    return "Enter a valid Nigerian number — e.g. 08012345678";
  }
  return null;
}

interface Props {
  value: string;
  onChange: (e164: string) => void;
  error?: string | null;
  id?: string;
  disabled?: boolean;
}

export function PhoneInput({ value, onChange, error, id = "phone", disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const local = toLocal(value);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    onChange(digits ? `+234${digits}` : "");
  }

  const valid = local.length === 10;
  const started = local.length > 0;

  return (
    <div>
      <div
        className={cn(
          "flex h-[52px] w-full overflow-hidden rounded-2xl border bg-white transition-colors duration-150 sm:h-14",
          error
            ? "border-danger ring-3 ring-danger/20"
            : "border-line focus-within:border-green focus-within:ring-3 focus-within:ring-ring/40",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Flag + prefix badge */}
        <div className="flex shrink-0 cursor-default select-none items-center gap-1.5 border-r border-line bg-paper px-3 sm:px-4">
          <span className="text-base leading-none" aria-hidden>🇳🇬</span>
          <span className="font-num text-body-sm font-medium text-ink">{PREFIX}</span>
        </div>

        {/* Local number */}
        <input
          ref={inputRef}
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          disabled={disabled}
          value={local}
          onChange={handleChange}
          placeholder="8012345678"
          maxLength={10}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-w-0 flex-1 bg-transparent px-3 font-num text-base text-ink placeholder:text-ink-muted/70 outline-none disabled:opacity-50 sm:px-4"
        />

        {/* Live digit counter */}
        <div className="flex shrink-0 items-center pr-3 sm:pr-4">
          <span className={cn(
            "font-num text-label tabular-nums transition-colors",
            valid ? "text-green" : started ? "text-ink-muted" : "text-line",
          )}>
            {local.length}/10
          </span>
        </div>
      </div>

      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-body-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
