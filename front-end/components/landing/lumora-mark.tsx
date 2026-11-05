/** The Rising Kernel's three slices, as fractions of the kernel's own box. */
export const KERNEL_SLICES = [
  "M.5 0Q.73 .172 .888 .501H.112Q.27 .172 .5 0Z",
  "M.081 .572H.917Q.944 .642 .96 .715H.038Q.054 .642 .081 .572Z",
  "M.023 .786H.977Q.996 .889 1 1H0Q.004 .889 .023 .786Z",
];

/** The kernel alone, in the current text colour. It stretches to fill its box. */
export function KernelShape({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      fill="currentColor"
      className={className}
    >
      {KERNEL_SLICES.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
