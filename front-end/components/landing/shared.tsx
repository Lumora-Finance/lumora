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
