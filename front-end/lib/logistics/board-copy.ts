/** The plain words on farmer screens and in SMS. No "slot", "capacity", "listing", "bid" or "demand". */
const TIME_ZONE = "Africa/Lagos";

export function distanceLabel(km: number): string {
  const shown = Math.max(km, 1);
  if (km < 5) return `Very close to you · about ${shown} km`;
  if (km <= 15) return `Close to you · about ${shown} km`;
  return `Far from you · about ${shown} km`;
}

export const priceUnitLabel = (unit: string) => `for every ${unit}`;

export const needsLabel = (remaining: number, name: string, plural: string) =>
  `Needs ${remaining} more ${remaining === 1 ? name : plural}`;

const parts = (date: Date) => {
  const value = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    hourCycle: "h23", weekday: "long",
  }).formatToParts(date);
  const get = (type: string) => value.find((part) => part.type === type)?.value ?? "";
  return {
    dayKey: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
};

const timeOfDay = (hour: number) => (hour < 12 ? "morning" : hour < 16 ? "afternoon" : "evening");

const clock = ({ hour, minute }: { hour: number; minute: number }) => {
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return minute === 0 ? String(twelve) : `${twelve}:${String(minute).padStart(2, "0")}`;
};

function dayWord(start: Date, now: Date) {
  const startDay = parts(start).dayKey;
  if (startDay === parts(now).dayKey) return "Today";
  if (startDay === parts(new Date(now.getTime() + 86_400_000)).dayKey) return "Tomorrow";
  return null;
}

/** "Thursday morning, 7 to 11", or "Tomorrow morning, 7 to 11". */
export function whenLabel(start: Date, end: Date, now: Date): string {
  const from = parts(start);
  return `${dayWord(start, now) ?? from.weekday} ${timeOfDay(from.hour)}, ${clock(from)} to ${clock(parts(end))}`;
}

/** "Thu morning", for SMS. */
export function shortWhenLabel(start: Date, now: Date): string {
  const from = parts(start);
  return `${dayWord(start, now) ?? from.weekday.slice(0, 3)} ${timeOfDay(from.hour)}`;
}

export const COLLECTS_LABEL = "They will come to your farm";
export const SELL_LABEL = "Sell to them";
export const FULL_LABEL = "They have enough for this day";

const smsNaira = (kobo: number) => {
  const fraction = kobo % 100;
  const whole = new Intl.NumberFormat("en-NG").format((kobo - fraction) / 100);
  return fraction === 0 ? `N${whole}` : `N${whole}.${String(fraction).padStart(2, "0")}`;
};

export type SmsBoardRow = {
  n: number;
  buyer: string;
  area: string;
  km: number | null;
  priceKobo: number;
  priceUnit: string;
  remaining: number;
  windowStart: Date;
  collects: boolean;
};

/** "1) Caterer D, Angwan Rukuba, about 9 km. N3,800 for every kg. Needs 40 more, Thu morning." */
export function smsBoardLine(row: SmsBoardRow, now: Date): string {
  const distance = row.km === null ? "" : `, about ${Math.max(row.km, 1)} km`;
  const collects = row.collects ? " They will come to your farm." : "";
  return `${row.n}) ${row.buyer}, ${row.area}${distance}. ${smsNaira(row.priceKobo)} ${priceUnitLabel(row.priceUnit)}. Needs ${row.remaining} more, ${shortWhenLabel(row.windowStart, now)}.${collects}`;
}
