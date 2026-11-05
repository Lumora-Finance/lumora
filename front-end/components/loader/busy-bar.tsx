/**
 * Stands in for a spinner inside a button: a 2px bar along the bottom edge, with the label left as it is.
 * It eases to 85% and waits for the action. The button needs `relative overflow-hidden`.
 */
export function BusyBar({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-current/25">
      <span className="lumora-busy block h-full origin-left bg-current" />
    </span>
  );
}
