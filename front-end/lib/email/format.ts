import { formatKobo } from "@/lib/money/rules";

/** Dates in messages read in Lagos time, whatever server sends them. */
const TIME_ZONE = "Africa/Lagos";

const parts = (iso: string) => {
  const value = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    hourCycle: "h23", weekday: "long",
  }).formatToParts(new Date(iso));
  const get = (type: string) => value.find((part) => part.type === type)?.value ?? "";
  return { key: `${get("year")}-${get("month")}-${get("day")}`, weekday: get("weekday"), hour: Number(get("hour")), minute: Number(get("minute")) };
};

const twelve = (hour: number) => (hour % 12 === 0 ? 12 : hour % 12);
const suffix = (hour: number) => (hour < 12 ? "am" : "pm");
const minutes = (minute: number) => (minute === 0 ? "" : `:${String(minute).padStart(2, "0")}`);

/** "6am", "10:30am". */
export function clock(iso: string): string {
  const { hour, minute } = parts(iso);
  return `${twelve(hour)}${minutes(minute)}${suffix(hour)}`;
}

/** "Thursday". */
export const dayName = (iso: string) => parts(iso).weekday;

/** "today", "tomorrow", or "Thursday", as seen from when the message was written. */
export function relativeDay(iso: string, now: Date): string {
  const key = parts(iso).key;
  if (key === parts(now.toISOString()).key) return "today";
  if (key === parts(new Date(now.getTime() + 86_400_000).toISOString()).key) return "tomorrow";
  return dayName(iso);
}

/** "Wednesday 6am". */
export const dayAndClock = (iso: string) => `${dayName(iso)} ${clock(iso)}`;

/** "Thursday 7 to 11am", or "Thursday 7am to 1pm" when it crosses noon. */
export function windowText(start: string, end: string): string {
  const from = parts(start);
  const to = parts(end);
  const first = suffix(from.hour) === suffix(to.hour)
    ? `${twelve(from.hour)}${minutes(from.minute)}`
    : clock(start);
  return `${from.weekday} ${first} to ${clock(end)}`;
}

export const money = (kobo: number | string) => formatKobo(Number(kobo));

/** "₦3,500/kg". */
export const pricePer = (kobo: number | string, unit: string) => `${money(kobo)}/${unit}`;

/** 61.6, without trailing zeros. */
export const kilos = (kg: number | string) => String(Number(kg));

/** "12 December". */
export const dayMonth = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, day: "numeric", month: "long" }).format(new Date(iso));
