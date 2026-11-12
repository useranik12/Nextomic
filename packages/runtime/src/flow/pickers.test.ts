import type { ThemeChoice } from "@nextomic/schema";
import { describe, expect, it } from "vitest";
import { FlowError } from "./engine";
import { pickerAnswer, pickerHandlers, pickerInputValue, type PickRequest } from "./pickers";
import { themeHandlers } from "./theme-actions";

const ctx = {} as never;

describe("picker values", () => {
  it("writes dates, times and date-times the way inputs read them", () => {
    expect(pickerInputValue("date", "2026-11-13")).toBe("2026-11-13");
    expect(pickerInputValue("date", "2026-11-13T22:30:00")).toBe("2026-11-13");
    expect(pickerInputValue("time", "9:05:30")).toBe("09:05");
    expect(pickerInputValue("datetime", "2026-11-13T22:30:00")).toBe("2026-11-13T22:30");
    expect(pickerInputValue("date", "later")).toBe("");
    expect(pickerInputValue("time", "25:00")).toBe("");
    expect(pickerInputValue("date", "  ")).toBe("");
  });

  it("answers a date or time as written and a date-time as an ISO timestamp", () => {
    expect(pickerAnswer("date", "2026-11-13")).toBe("2026-11-13");
    expect(pickerAnswer("time", "09:05")).toBe("09:05");
    expect(pickerAnswer("datetime", "2026-11-13T12:00")).toBe(
      new Date("2026-11-13T12:00").toISOString()
    );
  });
});

describe("picker actions", () => {
  const record = (answer: string | null) => {
    const seen: PickRequest[] = [];
    const handlers = pickerHandlers({
      pick: async (request) => {
        seen.push(request);
        return answer;
      }
    });
    return { seen, handlers };
  };

  it("opens the date picker with start, earliest and latest, and returns the date", async () => {
    const { seen, handlers } = record("2026-12-01");
    const out = await handlers["picker.date"]?.(
      { mode: "date", initial: "2026-11-13", min: "2026-11-01", max: "2026-12-31" },
      ctx
    );
    expect(out).toBe("2026-12-01");
    expect(seen[0]).toEqual({
      type: "date",
      value: "2026-11-13",
      min: "2026-11-01",
      max: "2026-12-31"
    });
  });

  it("uses a date-time input for the date and time mode and skips unreadable limits", async () => {
    const { seen, handlers } = record("2026-11-13T12:00");
    await handlers["picker.date"]?.({ mode: "datetime", min: "soon" }, ctx);
    expect(seen[0]).toEqual({ type: "datetime-local", value: "" });
  });

  it("returns nothing when the picker is dismissed", async () => {
    const { handlers } = record(null);
    expect(await handlers["picker.date"]?.({ mode: "time" }, ctx)).toBeNull();
    expect(await handlers["picker.color"]?.({ initial: "#112233" }, ctx)).toBeNull();
  });

  it("refuses an unknown mode", async () => {
    const { handlers } = record("x");
    await expect(handlers["picker.date"]?.({ mode: "year" }, ctx)).rejects.toBeInstanceOf(
      FlowError
    );
  });

  it("starts the color picker on a valid color, else black, and returns lowercase hex", async () => {
    const { seen, handlers } = record("#AABBCC");
    expect(await handlers["picker.color"]?.({ initial: "#112233" }, ctx)).toBe("#aabbcc");
    await handlers["picker.color"]?.({ initial: "var(--primary)" }, ctx);
    expect(seen.map((s) => s.value)).toEqual(["#112233", "#000000"]);
  });
});

describe("Set Theme", () => {
  const themes: ThemeChoice[] = [
    { id: "a", slug: "main", name: "Main", modes: ["light", "dark"], defaultMode: "light" },
    { id: "b", slug: "night", name: "Night", modes: ["dark"], defaultMode: "dark" }
  ];

  it("switches to a theme the page ships", () => {
    const applied: string[] = [];
    themeHandlers(themes, (c) => applied.push(c.slug))["theme.set"]?.({ theme: "b" }, ctx);
    expect(applied).toEqual(["night"]);
  });

  it("explains why it cannot switch", () => {
    const none = themeHandlers([], () => {})["theme.set"];
    expect(() => none?.({ theme: "b" }, ctx)).toThrow(/cannot switch themes/);
    const some = themeHandlers(themes, () => {})["theme.set"];
    expect(() => some?.({ theme: "" }, ctx)).toThrow(/Choose the theme/);
    expect(() => some?.({ theme: "zzz" }, ctx)).toThrow(/does not follow/);
  });
});
