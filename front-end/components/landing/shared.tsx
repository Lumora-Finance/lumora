import { Check } from "lucide-react";
import type { ReactNode } from "react";

export const CONTAINER = "mx-auto w-full max-w-[1120px] px-4 md:px-6 lg:px-8";
/** Half of the 80px and 128px gaps, because each section contributes one side. */
export const SECTION_SPACING = "py-10 lg:py-16";
export const SECTION_HEADING =
  "font-display text-display-lg-sm font-medium text-balance md:text-display-lg";

/** Sets a number in Geist Mono with tabular figures. */
export function Num({ children }: { children: ReactNode }) {
  return <span className="font-num">{children}</span>;
}

export function CheckList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((item, index) => (
        <li key={index} data-check className="flex gap-3">
          <Check aria-hidden="true" strokeWidth={1.5} className="mt-1 size-4 shrink-0 text-green" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Reserves the final height of typed text, so typing never shifts the layout. */
export function TypedLine({ text, className }: { text: string; className?: string }) {
  return (
    <span className={`relative block ${className ?? ""}`}>
      <span aria-hidden="true" className="invisible">
        {text}
      </span>
      <span data-type={text} className="absolute inset-0">
        {text}
      </span>
    </span>
  );
}
