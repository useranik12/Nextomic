import { describe, expect, it } from "vitest";
import {
  CHOICE_PARTS,
  FORM_DESIGN_PARTS,
  INPUT_STATES,
  designPartsFor,
  inputDesignKey,
  inputPartSelectors,
  parseFormDesignKey
} from "./index";

describe("Form Options design table", () => {
  it("every setting round-trips through its key, with unique dash-free part ids", () => {
    const ids = FORM_DESIGN_PARTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const part of FORM_DESIGN_PARTS) {
      expect(part.id).not.toContain("-");
      expect(part.states[0]).toBe("default");
      for (const state of part.states) {
        expect(INPUT_STATES).toContain(state);
        for (const group of part.groups)
          for (const item of group.props) {
            const hit = parseFormDesignKey(inputDesignKey(part.id, item.prop, state));
            expect(hit?.part.id, `${part.id} ${item.prop} ${state}`).toBe(part.id);
            expect(hit?.state).toBe(state);
          }
      }
    }
  });

  it("gives each choice field its parts and the Option element none", () => {
    expect(designPartsFor("option")).toEqual([]);
    const ids = (type: string) => designPartsFor(type).map((p) => p.id);
    expect(ids("checkbox")).toContain("mark");
    expect(ids("checkbox")).not.toContain("options");
    expect(ids("radio")).toEqual(expect.arrayContaining(["options", "choice", "mark", "tick"]));
    expect(ids("choiceChips")).not.toContain("mark");
    expect(ids("choiceChips")).toContain("ico");
  });

  it("reaches a part of every option from the field, per state, with a forced canvas form", () => {
    const mark = CHOICE_PARTS.find((p) => p.id === "mark")!;
    expect(inputPartSelectors(".a", mark, "default")[0]).toBe(
      ".a[data-nxt-field] [data-nxt-choice] [data-nxt-mark]"
    );
    const checked = inputPartSelectors(".a", mark, "checked").join(",");
    expect(checked).toContain(":has(:where([data-nxt-control]:checked))");
    expect(checked).toContain('[data-nxt-force="checked"]');
  });
});
