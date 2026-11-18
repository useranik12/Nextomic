import type { ElementNode } from "./element";

// The Date and time field (elements.md "Date and time"): one value kept as ISO text in local wall
// time with no zone, the same formats the browser's own inputs use: `YYYY-MM-DD`, `HH:mm` and
// `YYYY-MM-DDTHH:mm`. Plain text compares in the right order, so limits are checked as text and no
// `Date` is ever built from a date-only string (that reads as UTC midnight, a day early west of
// Greenwich). Everything here is pure, so the page renderer and the client runtime share it.

export const DATE_TYPE = "dateTime";
export const DATE_MODES = ["date", "time", "datetime"] as const;
export type DateMode = (typeof DATE_MODES)[number];
export const DATE_STYLES = ["short", "medium", "long"] as const;
export type DateStyle = (typeof DATE_STYLES)[number];

export interface YMD {
  y: number;
  m: number;
  d: number;
}

export interface HM {
  h: number;
  min: number;
}

export interface DayCell extends YMD {
  /** `YYYY-MM-DD` */
  iso: string;
  /** False for the days of the months before and after that fill the first and last week. */
  inMonth: boolean;
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** `YYYY-MM-DD` of a day. */
export const dateOfParts = ({ y, m, d }: YMD): string => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
export const timeOfParts = ({ h, min }: HM): string => `${pad(h)}:${pad(min)}`;

export const isLeapYear = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function daysInMonth(y: number, m: number): number {
  return m === 2 ? (isLeapYear(y) ? 29 : 28) : [4, 6, 9, 11].includes(m) ? 30 : 31;
}

/** 0 is Sunday. */
export const weekdayOf = ({ y, m, d }: YMD): number => new Date(Date.UTC(y, m - 1, d)).getUTCDay();

export function parseDate(text: string): YMD | null {
  const hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!hit) return null;
  const [y, m, d] = [Number(hit[1]), Number(hit[2]), Number(hit[3])];
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m) ? { y, m, d } : null;
}

export function parseTime(text: string): HM | null {
  const hit = /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(text.trim());
  if (!hit) return null;
  const [h, min] = [Number(hit[1]), Number(hit[2])];
  return h <= 23 && min <= 59 ? { h, min } : null;
}

export interface DateValue {
  date: YMD | null;
  time: HM | null;
}

/** What `text` holds for this mode, or null when it is not a value of that mode. */
export function parseValue(mode: DateMode, text: string): DateValue | null {
  const value = text.trim();
  if (mode === "date") {
    const date = parseDate(value);
    return date ? { date, time: null } : null;
  }
  if (mode === "time") {
    const time = parseTime(value);
    return time ? { date: null, time } : null;
  }
  const [datePart, timePart, ...rest] = value.split(/[T ]/);
  if (!datePart || !timePart || rest.length > 0) return null;
  const date = parseDate(datePart);
  const time = parseTime(timePart);
  return date && time ? { date, time } : null;
}

export function formatValue(mode: DateMode, value: DateValue): string {
  const date = value.date ? dateOfParts(value.date) : "";
  const time = value.time ? timeOfParts(value.time) : "";
  return mode === "date" ? date : mode === "time" ? time : `${date}T${time}`;
}

/** The canonical text of a value, or "" when `text` is not a value of this mode. */
export function normalizeDate(mode: DateMode, text: string): string {
  const value = parseValue(mode, text);
  return value ? formatValue(mode, value) : "";
}

export const dateModeOf = (text: string): DateMode =>
  DATE_MODES.find((mode) => mode === text) ?? "date";

// ---- the month grid ----

export function addDays(day: YMD, count: number): YMD {
  const moved = new Date(Date.UTC(day.y, day.m - 1, day.d + count));
  return { y: moved.getUTCFullYear(), m: moved.getUTCMonth() + 1, d: moved.getUTCDate() };
}

/** Moves by whole months and keeps the day inside the new month (Jan 31 + 1 month is Feb 28/29). */
export function addMonths(day: YMD, count: number): YMD {
  const index = day.y * 12 + (day.m - 1) + count;
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return { y, m, d: Math.min(day.d, daysInMonth(y, m)) };
}

/** Always 42 days (six weeks), starting on `weekStart` (0 is Sunday), so the grid never changes size. */
export function monthGrid(y: number, m: number, weekStart: number): DayCell[] {
  const lead = (weekdayOf({ y, m, d: 1 }) - weekStart + 7) % 7;
  const first = addDays({ y, m, d: 1 }, -lead);
  return Array.from({ length: 42 }, (_, i) => {
    const day = addDays(first, i);
    return { ...day, iso: dateOfParts(day), inMonth: day.m === m && day.y === y };
  });
}

export const compareDays = (a: YMD, b: YMD): number => a.y - b.y || a.m - b.m || a.d - b.d;

// ---- limits ----

/** The date part of a limit or value (`YYYY-MM-DD`), or "" for a time-only field or bad text. */
export function datePartOf(mode: DateMode, text: string): string {
  const value = parseValue(mode, text);
  return value?.date ? dateOfParts(value.date) : "";
}

/** Whether a day may be chosen: it lies inside the limits (the date parts of min and max). */
export function dayInLimits(iso: string, min: string, max: string): boolean {
  return (min === "" || iso >= min) && (max === "" || iso <= max);
}

/** Whether a whole value lies inside the limits (canonical text of one mode compares in order). */
export function valueInLimits(value: string, min: string, max: string): boolean {
  return (min === "" || value >= min) && (max === "" || value <= max);
}

/** `value` held inside the limits; an empty value stays empty. */
export function clampValue(value: string, min: string, max: string): string {
  if (value === "") return "";
  if (min !== "" && value < min) return min;
  if (max !== "" && value > max) return max;
  return value;
}

// ---- time choices ----

export const MINUTE_STEPS = [1, 5, 10, 15, 20, 30] as const;

export const hoursOf = (): number[] => Array.from({ length: 24 }, (_, i) => i);

export const minutesOf = (step: number): number[] =>
  Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step).filter((m) => m < 60);

/** Moves a time to the nearest minute the step allows (rounded down), staying inside the day. */
export function snapTime(time: HM, step: number): HM {
  return { h: time.h, min: Math.min(59, Math.floor(time.min / step) * step) };
}

// ---- showing a value ----

const zoned = (locale: string): string | undefined => (locale === "" ? undefined : locale);

function formatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat(zoned(locale), options);
  } catch {
    return new Intl.DateTimeFormat(undefined, options);
  }
}

export interface ShowOptions {
  locale: string;
  style: DateStyle;
  /** `true` for a 12-hour clock, `false` for 24-hour; null follows the locale. */
  hour12: boolean | null;
}

/** The words a visitor sees for a value ("Nov 18, 2026, 2:30 PM"); "" when there is no value. */
export function showValue(mode: DateMode, text: string, options: ShowOptions): string {
  const value = parseValue(mode, text);
  if (!value) return "";
  const parts: Intl.DateTimeFormatOptions = { timeZone: "UTC" };
  if (value.date) {
    if (options.style === "short") Object.assign(parts, { dateStyle: "short" });
    else if (options.style === "long") Object.assign(parts, { dateStyle: "full" });
    else Object.assign(parts, { dateStyle: "medium" });
  }
  if (value.time) {
    Object.assign(parts, { timeStyle: "short" });
    if (options.hour12 !== null) Object.assign(parts, { hour12: options.hour12 });
  }
  const at = value.date ?? { y: 1970, m: 1, d: 1 };
  const clock = value.time ?? { h: 0, min: 0 };
  // The parts are wall time, so they are formatted as UTC: the visitor's zone never shifts them.
  const moment = new Date(Date.UTC(at.y, at.m - 1, at.d, clock.h, clock.min));
  return formatter(options.locale, parts).format(moment);
}

/** "November 2026" in the locale. */
export function monthTitle(y: number, m: number, locale: string): string {
  return formatter(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1))
  );
}

/** The seven weekday names starting on `weekStart`: short ("Mon") and long ("Monday"). */
export function weekdayNames(locale: string, weekStart: number): { short: string; long: string }[] {
  const short = formatter(locale, { weekday: "short", timeZone: "UTC" });
  const long = formatter(locale, { weekday: "long", timeZone: "UTC" });
  // 2023-01-01 is a Sunday.
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(Date.UTC(2023, 0, 1 + ((weekStart + i) % 7)));
    return { short: short.format(day), long: long.format(day) };
  });
}

/** The full name of one day for screen readers ("Wednesday, November 18, 2026"). */
export function dayName(day: YMD, locale: string): string {
  return formatter(locale, { dateStyle: "full", timeZone: "UTC" }).format(
    new Date(Date.UTC(day.y, day.m - 1, day.d))
  );
}

/** An hour as a 12-hour clock reading: 0 is 12 AM, 13 is 1 PM. */
export function twelveHour(h: number): { hour: number; pm: boolean } {
  return { hour: h % 12 === 0 ? 12 : h % 12, pm: h >= 12 };
}

// ---- checks made when the page is saved ----

const plain = (node: ElementNode, key: string): string => {
  const v = node.props[key];
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
};

/** The first value in the text that is plain (no dynamic token), for checks made at save time. */
const isDynamic = (text: string) => text.includes("{{");

/** What cannot work in the settings of a Date and time field; empty when it is fine. */
export function dateFieldProblems(node: ElementNode): string[] {
  const name = plain(node, "name") || "A Date and time field";
  const problems: string[] = [];
  const mode = dateModeOf(plain(node, "mode"));
  const read = (key: string) => {
    const text = plain(node, key);
    if (text === "" || isDynamic(text)) return "";
    if (normalizeDate(mode, text) === "") {
      problems.push(`"${name}" has a ${key} that is not a ${mode} value (use ${shape(mode)}).`);
      return "";
    }
    return normalizeDate(mode, text);
  };
  const min = read("min");
  const max = read("max");
  const start = read("value");
  if (min !== "" && max !== "" && max < min)
    problems.push(`"${name}" has a maximum before its minimum.`);
  if (start !== "" && ((min !== "" && start < min) || (max !== "" && start > max)))
    problems.push(`"${name}" starts outside its minimum and maximum.`);
  const step = plain(node, "minuteStep");
  if (step !== "" && !isDynamic(step) && !MINUTE_STEPS.some((s) => String(s) === step))
    problems.push(`"${name}" needs a minute step of ${MINUTE_STEPS.join(", ")}.`);
  const week = plain(node, "weekStart");
  if (week !== "" && !["0", "1", "2", "3", "4", "5", "6"].includes(week))
    problems.push(`"${name}" needs a week start from 0 (Sunday) to 6 (Saturday).`);
  return problems;
}

/** The written shape of a value of this mode. */
export const shape = (mode: DateMode): string =>
  mode === "date" ? "YYYY-MM-DD" : mode === "time" ? "HH:mm" : "YYYY-MM-DDTHH:mm";
