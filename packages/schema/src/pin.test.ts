import { describe, expect, it } from "vitest";
import {
  PIN_PARTS,
  designPartsFor,
  editStateLabel,
  editStatesFor,
  formProblems,
  inputDesignKey,
  inputPartSelectors,
  parseFormDesignKey,
  pinAccepts,
  pinFill,
  pinLengthOf,
  pinPattern,
  type ElementNode
} from "./index";

const el = (
  id: string,
  type: string,
  props: Record<string, unknown> = {},
  children: ElementNode[] = []
) =>
  ({
    id,
    type,
    classIds: [],
    props,
    styles: { breakpoints: {} },
    actions: {},
    children
  }) as ElementNode;

describe("pin characters", () => {
  it("accepts what each set allows", () => {
    expect(pinAccepts("numeric", "7")).toBe(true);
    expect(pinAccepts("numeric", "a")).toBe(false);
    expect(pinAccepts("letters", "é")).toBe(true);
    expect(pinAccepts("letters", "1")).toBe(false);
    expect(pinAccepts("alphanumeric", "1")).toBe(true);
    expect(pinAccepts("alphanumeric", "-")).toBe(false);
    expect(pinAccepts("any", "-")).toBe(true);
    expect(pinAccepts("any", " ")).toBe(false);
  });

  it("writes a pattern for every set but any", () => {
    expect(new RegExp(pinPattern("numeric"), "u").test("123456")).toBe(true);
    expect(new RegExp(pinPattern("numeric"), "u").test("12a")).toBe(false);
    expect(pinPattern("any")).toBe("");
  });

  it("keeps the length in range", () => {
    expect(pinLengthOf("4")).toBe(4);
    expect(pinLengthOf("1")).toBe(6);
    expect(pinLengthOf("99")).toBe(6);
    expect(pinLengthOf("x")).toBe(6);
  });
});

describe("pin fill", () => {
  const empty = ["", "", "", ""];
  it("puts typed text in the box it was typed in and moves on", () => {
    expect(pinFill(empty, 1, "5", "numeric")).toEqual({ boxes: ["", "5", "", ""], focus: 2 });
  });
  it("stays on the last box", () => {
    expect(pinFill(["1", "2", "3", ""], 3, "9", "numeric").focus).toBe(3);
  });
  it("starts a whole pasted code in the first box and drops the extra", () => {
    expect(pinFill(empty, 2, "123456", "numeric")).toEqual({
      boxes: ["1", "2", "3", "4"],
      focus: 3
    });
  });
  it("starts a short pasted text where it was pasted and skips other characters", () => {
    expect(pinFill(empty, 1, "1-2", "numeric").boxes).toEqual(["", "1", "2", ""]);
  });
  it("changes nothing when no character is accepted", () => {
    expect(pinFill(["1", "", "", ""], 1, "ab", "numeric")).toEqual({
      boxes: ["1", "", "", ""],
      focus: 1
    });
  });
});

describe("pin design and problems", () => {
  it("has its own parts with keys that round-trip", () => {
    const ids = designPartsFor("pinInput").map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining(["field", "label", "cells", "cell", "help", "error"])
    );
    for (const part of PIN_PARTS)
      for (const state of part.states)
        for (const group of part.groups)
          for (const item of group.props) {
            const hit = parseFormDesignKey(inputDesignKey(part.id, item.prop, state));
            expect(hit?.part.id).toBe(part.id);
            expect(hit?.state).toBe(state);
          }
  });

  it("reaches one box per state, the way option rows are reached", () => {
    const cell = PIN_PARTS.find((p) => p.id === "cell")!;
    expect(inputPartSelectors("#a", cell, "default")).toContain(
      "#a[data-nxt-field] [data-nxt-cell]"
    );
    const filled = inputPartSelectors("#a", cell, "checked").join(" ");
    expect(filled).toContain("[data-filled]");
    expect(filled).toContain('[data-nxt-force="checked"]');
  });

  it("calls the checked state Filled", () => {
    expect(editStatesFor("pinInput")).toContain("checked");
    expect(editStateLabel("pinInput", "checked")).toBe("Filled");
  });

  it("flags a length out of range", () => {
    const form = (length: string) =>
      el("r", "page", {}, [
        el("f", "form", { name: "f" }, [el("p", "pinInput", { name: "code", length })])
      ]);
    expect(formProblems(form("6"))).toEqual([]);
    expect(formProblems(form("30"))[0]).toContain("needs a length");
  });
});
