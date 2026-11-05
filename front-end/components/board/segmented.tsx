"use client";

import { cn } from "@/lib/utils";

/**
 * Equal segments with one pill that slides between them. `dot` marks a segment with something in it.
 * Equal widths mean the pill's position is plain arithmetic, so it never needs measuring.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: readonly { value: T; label: string; dot?: boolean; hint?: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const index = Math.max(options.findIndex((option) => option.value === value), 0);
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("relative grid auto-cols-fr grid-flow-col rounded-2xl border border-line bg-white p-1", className)}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 rounded-xl bg-field transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            aria-label={option.hint ? `${option.label}, ${option.hint}` : undefined}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-1 text-[13px] font-medium transition-colors duration-200 [-webkit-tap-highlight-color:transparent] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:px-3 sm:text-body-sm",
              selected ? "text-paper" : "text-ink-muted hover:text-ink",
            )}
          >
            <span className="truncate">{option.label}</span>
            {option.dot && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-amber" />}
          </button>
        );
      })}
    </div>
  );
}
