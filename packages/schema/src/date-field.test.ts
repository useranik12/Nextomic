import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  clampValue,
  dateFieldProblems,
  dayInLimits,
  daysInMonth,
  minutesOf,
  monthGrid,
  monthTitle,
  normalizeDate,
  parseValue,
  showValue,
  snapTime,
  twelveHour,
  weekdayNames,
  type ElementNode
} from "./index";

const el = (props: Record<string, unknown>) =>
  ({
    id: "d",
    type: "dateTime",
    classIds: [],
    props: { name: "when", ...props },
    styles: { breakpoints: {} },
    actions: {},
    children: []
  }) as ElementNode;

describe("date values", () => {
  it("knows leap years and month lengths", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
  });

  it("reads only real days and times, in the form of its mode", () => {
    expect(parseValue("date", "2026-02-30")).toBeNull();
    expect(normalizeDate("date", "2026-11-18")).toBe("2026-11-18");
    expect(normalizeDate("time", "14:30:15")).toBe("14:30");
    expect(normalizeDate("time", "24:00")).toBe("");
    expect(normalizeDate("datetime", "2026-11-18 09:05")).toBe("2026-11-18T09:05");
    expect(normalizeDate("datetime", "2026-11-18")).toBe("");
  });

  it("moves months without leaving the month", () => {
    expect(addMonths({ y: 2026, m: 1, d: 31 }, 1)).toEqual({ y: 2026, m: 2, d: 28 });
    expect(addMonths({ y: 2024, m: 1, d: 31 }, 1)).toEqual({ y: 2024, m: 2, d: 29 });
    expect(addMonths({ y: 2026, m: 1, d: 15 }, -1)).toEqual({ y: 2025, m: 12, d: 15 });
    expect(addMonths({ y: 2026, m: 11, d: 15 }, 14)).toEqual({ y: 2028, m: 1, d: 15 });
    expect(addDays({ y: 2026, m: 12, d: 31 }, 1)).toEqual({ y: 2027, m: 1, d: 1 });
  });
});

describe("month grid", () => {
  it("is always six weeks and starts on the chosen weekday", () => {
    const sunday = monthGrid(2026, 11, 0);
    const monday = monthGrid(2026, 11, 1);
    expect(sunday).toHaveLength(42);
    expect(monday).toHaveLength(42);
    // 1 November 2026 is a Sunday.
    expect(sunday[0]).toMatchObject({ iso: "2026-11-01", inMonth: true });
    expect(monday[0]).toMatchObject({ iso: "2026-10-26", inMonth: false });
    expect(monday[6]).toMatchObject({ iso: "2026-11-01", inMonth: true });
    expect(sunday.filter((d) => d.inMonth)).toHaveLength(30);
  });

  it("handles a leap day", () => {
    const grid = monthGrid(2024, 2, 1);
    expect(grid.some((d) => d.iso === "2024-02-29" && d.inMonth)).toBe(true);
    expect(grid.filter((d) => d.inMonth)).toHaveLength(29);
  });
});

describe("limits and times", () => {
  it("compares as text and holds a value inside the limits", () => {
    expect(dayInLimits("2026-11-18", "2026-11-20", "")).toBe(false);
    expect(dayInLimits("2026-11-18", "2026-11-01", "2026-11-30")).toBe(true);
    expect(clampValue("2026-12-01", "", "2026-11-30")).toBe("2026-11-30");
    expect(clampValue("", "2026-11-01", "")).toBe("");
  });

  it("offers the minutes a step allows and snaps down", () => {
    expect(minutesOf(15)).toEqual([0, 15, 30, 45]);
    expect(minutesOf(20)).toEqual([0, 20, 40]);
    expect(snapTime({ h: 9, min: 47 }, 15)).toEqual({ h: 9, min: 45 });
    expect(twelveHour(0)).toEqual({ hour: 12, pm: false });
    expect(twelveHour(13)).toEqual({ hour: 1, pm: true });
  });
});

describe("showing a value", () => {
  it("uses the locale and never shifts the day by the zone", () => {
    const en = showValue("date", "2026-11-18", { locale: "en-US", style: "medium", hour12: null });
    expect(en).toBe("Nov 18, 2026");
    const de = showValue("date", "2026-11-18", { locale: "de-DE", style: "medium", hour12: null });
    expect(de).toContain("18.");
    expect(showValue("date", "nope", { locale: "en", style: "short", hour12: null })).toBe("");
    const time = showValue("time", "14:30", { locale: "en-US", style: "short", hour12: false });
    expect(time).toBe("14:30");
  });

  it("names the month and the weekdays from the week start", () => {
    expect(monthTitle(2026, 11, "en-US")).toBe("November 2026");
    const names = weekdayNames("en-US", 1);
    expect(names[0]?.short).toBe("Mon");
    expect(names[6]?.long).toBe("Sunday");
  });
});

describe("date field problems", () => {
  it("accepts a good field", () => {
    expect(
      dateFieldProblems(
        el({ mode: "date", min: "2026-01-01", max: "2026-12-31", value: "2026-06-01" })
      )
    ).toEqual([]);
  });

  it("reports values of the wrong shape, crossed limits and a start outside them", () => {
    expect(dateFieldProblems(el({ mode: "date", min: "yesterday" }))[0]).toContain("YYYY-MM-DD");
    expect(
      dateFieldProblems(el({ mode: "date", min: "2026-05-01", max: "2026-04-01" }))[0]
    ).toContain("maximum before");
    expect(
      dateFieldProblems(el({ mode: "date", min: "2026-05-01", value: "2026-01-01" }))[0]
    ).toContain("outside");
    expect(dateFieldProblems(el({ mode: "time", minuteStep: "7" }))[0]).toContain("minute step");
    expect(dateFieldProblems(el({ mode: "date", min: "{{ state.start }}" }))).toEqual([]);
  });
});
