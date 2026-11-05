import { type Area, inPilotRegion, isAreaName, nearestArea } from "./areas";

export type LocationChoice = {
  area?: string;
  lat?: number;
  lng?: number;
  accuracyM?: number | null;
  address?: string;
};

/**
 * Turns what the screen sent into what gets stored. With a position the server works out the area
 * itself. With only an area, the area's centre is stored, and the caller records the source.
 */
export function readLocationChoice(body: LocationChoice):
  | { kind: "gps"; area: Area["name"]; lat: number; lng: number; accuracyM: number | null }
  | { kind: "area"; area: Area["name"] }
  | null {
  if (typeof body.lat === "number" && typeof body.lng === "number") {
    const point = { lat: body.lat, lng: body.lng };
    if (!inPilotRegion(point)) return null;
    return { kind: "gps", area: nearestArea(point).name, ...point, accuracyM: body.accuracyM ?? null };
  }
  return isAreaName(body.area) ? { kind: "area", area: body.area } : null;
}

export const validPhone = (phone: unknown): phone is string =>
  typeof phone === "string" && /^\+?[0-9]{10,15}$/.test(phone.replace(/[\s-]/g, ""));

/** Writes a Nigerian number the way SMS callbacks send it, so one person can't have two accounts. */
export function normalisePhone(phone: string): string {
  const digits = phone.replace(/[\s-]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0")) return `+234${digits.slice(1)}`;
  if (digits.startsWith("234")) return `+${digits}`;
  return digits;
}
