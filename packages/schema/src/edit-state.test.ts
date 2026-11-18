import { describe, expect, it } from "vitest";
import { editStateLabel, editStatesFor, formPropsWithoutTip, partStateOf, pseudoOf } from "./index";

describe("edit states", () => {
  it("gives every element the browser states and each form field only its own", () => {
    expect(editStatesFor("section")).toEqual(["default", "hover", "focus", "active", "disabled"]);
    expect(editStatesFor("input")).toEqual(expect.arrayContaining(["error", "success"]));
    expect(editStatesFor("input")).not.toContain("checked");
    for (const type of ["checkbox", "checkboxGroup", "radio", "choiceChips"])
      expect(editStatesFor(type)).toEqual(expect.arrayContaining(["checked", "error", "success"]));
  });

  it("says Selected for single-choice fields and Checked for the others", () => {
    expect(editStateLabel("radio", "checked")).toBe("Selected");
    expect(editStateLabel("choiceChips", "checked")).toBe("Selected");
    expect(editStateLabel("checkbox", "checked")).toBe("Checked");
  });

  it("maps a state to ordinary and part storage", () => {
    expect(pseudoOf("hover")).toBe("hover");
    expect(pseudoOf("checked")).toBeNull();
    expect(partStateOf("active")).toBeNull();
    expect(partStateOf("error")).toBe("error");
  });

  it("has a plain-words tip for every Form design setting", () => {
    expect(formPropsWithoutTip()).toEqual([]);
  });
});
