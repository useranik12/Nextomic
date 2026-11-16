import { describe, expect, it } from "vitest";
import {
  INPUT_PARTS,
  INPUT_STATES,
  inputDesignKey,
  inputPartSelectors,
  parseInputDesignKey
} from "./input-design";

describe("Form Input design table", () => {
  it("every setting the table lists round-trips through its key", () => {
    for (const part of INPUT_PARTS) {
      for (const state of part.states) {
        for (const group of part.groups) {
          for (const item of group.props) {
            const hit = parseInputDesignKey(inputDesignKey(part.id, item.prop, state));
            expect(hit?.part.id, `${part.id} ${item.prop} ${state}`).toBe(part.id);
            expect(hit?.prop).toBe(item.prop);
            expect(hit?.state).toBe(state);
          }
        }
      }
    }
  });

  it("has unique part ids without dashes, and every part has default plus real states", () => {
    const ids = INPUT_PARTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const part of INPUT_PARTS) {
      expect(part.id).not.toContain("-");
      expect(part.states[0]).toBe("default");
      for (const state of part.states) expect(INPUT_STATES).toContain(state);
    }
  });

  it("reaches a part from the field itself and from an owner around it", () => {
    const box = INPUT_PARTS.find((p) => p.id === "box")!;
    expect(inputPartSelectors(".a", box, "hover").slice(0, 2)).toEqual([
      ".a[data-nxt-field] [data-nxt-box]:hover",
      ".a [data-nxt-field] [data-nxt-box]:hover"
    ]);
  });
});
