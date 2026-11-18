import { describe, expect, it } from "vitest";
import { inputDesignKey, styleMarkIndex, type StyleMap } from "./index";

const map = (breakpoints: StyleMap["breakpoints"]): StyleMap => ({ breakpoints });

describe("style marks", () => {
  const element = map({
    base: {
      default: { color: "red", "--nxt-ip-box-padding-error": "4px" },
      hover: { color: "blue" }
    },
    tablet: { default: { margin: "1px" } }
  });
  const card = map({ base: { default: { "font-size": "12px" } } });
  const index = styleMarkIndex(element, [card], card);

  it("is bright where the element sets it and faded where only another state or breakpoint does", () => {
    expect(index.marks(["color"], "base", "default").element).toBe("here");
    expect(index.marks(["color"], "base", "hover").element).toBe("here");
    expect(index.marks(["color"], "base", "focus").element).toBe("elsewhere");
    expect(index.marks(["margin"], "base", "default").element).toBe("elsewhere");
    expect(index.marks(["margin"], "tablet", "default").element).toBe("here");
    expect(index.marks(["width"], "base", "default").element).toBe("none");
  });

  it("marks classes: bright for the class being edited, faded for any applied class", () => {
    expect(index.marks(["font-size"], "base", "default").classes).toBe("here");
    expect(index.marks(["font-size"], "base", "hover").classes).toBe("elsewhere");
    const other = styleMarkIndex(element, [card], undefined);
    expect(other.marks(["font-size"], "base", "default").classes).toBe("elsewhere");
    expect(other.marks(["color"], "base", "default").classes).toBe("none");
  });

  it("reads part keys by their setting, with the state in the name", () => {
    const error = inputDesignKey("box", "padding", "error");
    expect(index.marks([error], "base", "error").element).toBe("here");
    expect(index.marks([inputDesignKey("box", "padding", "focus")], "base", "focus").element).toBe(
      "elsewhere"
    );
    expect(
      index.marks([inputDesignKey("box", "padding", "default")], "base", "active").element
    ).toBe("elsewhere");
  });

  it("ORs several settings for a group header, bright winning", () => {
    expect(index.marks(["width", "margin", "color"], "base", "default").element).toBe("here");
    expect(index.marks(["width", "margin"], "base", "default").element).toBe("elsewhere");
  });

  it("marks states for the select and its list", () => {
    expect(index.stateMarks("base", "default").element).toBe("here");
    expect(index.stateMarks("base", "focus").element).toBe("elsewhere");
    expect(index.optionMarks("base", "hover").element).toBe("here");
    expect(index.optionMarks("base", "focus").element).toBe("none");
    expect(index.optionMarks("tablet", "hover").element).toBe("elsewhere");
  });
});
