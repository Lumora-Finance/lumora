/** Keep in step with `logistics_decline_problem`. A test fails if they differ. */
export const DECLINE_REASONS = [
  { value: "dead_on_arrival", label: "Dead on arrival", photo: true },
  { value: "underweight", label: "Underweight", photo: false },
  { value: "overweight_or_bloated", label: "Overweight or bloated", photo: false },
  { value: "sick_or_injured", label: "Sick or injured", photo: true },
  { value: "outside_spec", label: "Outside the spec", photo: false },
  { value: "other", label: "Other", photo: false },
] as const;

export type DeclineReason = (typeof DECLINE_REASONS)[number]["value"];
export type DeclinedUnit = { reason: DeclineReason | ""; note?: string; photo_url?: string };

export function declineProblem(unit: DeclinedUnit): string | null {
  const reason = DECLINE_REASONS.find((item) => item.value === unit.reason);
  if (!reason) return "Choose a reason.";
  if (reason.value === "other" && !unit.note?.trim()) return "Add a short note.";
  if (reason.photo && !unit.photo_url) return "Add a photo.";
  return null;
}
