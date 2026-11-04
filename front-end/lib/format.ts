const nairaNumber = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

/** Formats a price as `₦3,500`, or `₦3,500/kg` when a unit is given. */
export function formatNaira(amount: number, unit?: string) {
  const price = `₦${nairaNumber.format(amount)}`;
  return unit ? `${price}/${unit}` : price;
}
