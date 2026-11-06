import { describe, expect, it } from "vitest";
import { pruneUnusedClasses, requiredClasses, usedClassNames } from "./css-prune";
import { emptyPageTree } from "./page";

const used = (...names: string[]) => new Set(names);

describe("requiredClasses", () => {
  it("lists the classes a selector needs", () => {
    expect(requiredClasses(".a .b:hover")).toEqual(["a", "b"]);
    expect(requiredClasses(":root")).toEqual([]);
  });
  it("ignores classes inside :not, :is, :where and :has, and attribute values", () => {
    expect(requiredClasses(".a:not(.b)")).toEqual(["a"]);
    expect(requiredClasses(":where(.x,.y) p")).toEqual([]);
    expect(requiredClasses('[data-x=".nope"] .c')).toEqual(["c"]);
  });
  it("unescapes class names", () => {
    expect(requiredClasses(".md\\:flex")).toEqual(["md:flex"]);
  });
});

describe("pruneUnusedClasses", () => {
  const css =
    ":root{--a:1}body{margin:0}.btn{color:red}.btn:hover{color:blue}.card{padding:1px}" +
    ".card .title{font-weight:700}.x,.y{gap:1px}@media (min-width:600px){.card{padding:2px}.gone{top:0}}" +
    "@media (min-width:900px){.gone{top:1px}}@keyframes k{from{opacity:0}}@font-face{font-family:F}";

  it("keeps classless rules, used classes, keyframes and font-face", () => {
    const out = pruneUnusedClasses(css, used("btn", "card", "title"));
    expect(out).toContain(":root{--a:1}");
    expect(out).toContain("body{margin:0}");
    expect(out).toContain(".btn{color:red}");
    expect(out).toContain(".btn:hover{color:blue}");
    expect(out).toContain(".card .title{font-weight:700}");
    expect(out).toContain("@keyframes k");
    expect(out).toContain("@font-face");
  });

  it("drops unused rules and emptied media queries", () => {
    const out = pruneUnusedClasses(css, used("btn"));
    expect(out).not.toContain(".card");
    expect(out).not.toContain(".gone");
    expect(out).not.toContain("min-width:900px");
    expect(out).not.toContain("min-width:600px");
  });

  it("requires every class of a compound selector", () => {
    const out = pruneUnusedClasses(css, used("card"));
    expect(out).toContain(".card{padding:1px}");
    expect(out).not.toContain(".title");
  });

  it("trims a selector list to its used selectors", () => {
    const out = pruneUnusedClasses(css, used("y"));
    expect(out).toContain(".y{gap:1px}");
    expect(out).not.toContain(".x");
  });

  it("keeps the rules inside a media query for used classes", () => {
    expect(pruneUnusedClasses(css, used("card"))).toMatch(
      /@media \(min-width:600px\)\{\s*\.card\{padding:2px\}/
    );
  });

  it("returns CSS it cannot parse unchanged", () => {
    expect(pruneUnusedClasses(".a{", used())).toBe(".a{");
  });
});

describe("usedClassNames", () => {
  it("collects classes from nested and hidden elements", () => {
    const root = emptyPageTree();
    root.classIds = ["a"];
    const child = emptyPageTree();
    child.classIds = ["a", "b"];
    child.hidden = true;
    root.children.push(child);
    expect([...usedClassNames(root)].sort()).toEqual(["a", "b"]);
  });
});
