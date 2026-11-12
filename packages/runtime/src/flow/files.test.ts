import { describe, expect, it } from "vitest";
import { fileProblem, FileStore, pickedIds } from "./files";

describe("picked files", () => {
  it("keeps files by id and forgets them", () => {
    const store = new FileStore();
    const file = new File(["hi"], "a.txt", { type: "text/plain" });
    const picked = store.add(file);
    expect(picked).toMatchObject({ name: "a.txt", size: 2, type: "text/plain" });
    expect(picked.id.startsWith("nxf-")).toBe(true);
    expect(store.get(picked.id)).toBe(file);
    expect(store.remove(picked.id)).toBe(true);
    expect(store.get(picked.id)).toBeUndefined();
  });

  it("reads ids from one description, a list, or JSON text", () => {
    expect(pickedIds({ id: "a" })).toEqual(["a"]);
    expect(pickedIds([{ id: "a" }, { id: "b" }, { x: 1 }])).toEqual(["a", "b"]);
    expect(pickedIds('[{"id":"c"}]')).toEqual(["c"]);
    expect(pickedIds("nope")).toEqual([]);
    expect(pickedIds(null)).toEqual([]);
  });

  it("finds problems with size and kind", () => {
    const limits = { accept: "image/*", maxSizeMb: 1 };
    expect(fileProblem({ name: "a.png", size: 10, type: "image/png" }, limits)).toBeNull();
    expect(
      fileProblem({ name: "a.png", size: 2 * 1024 * 1024, type: "image/png" }, limits)
    ).toMatch(/larger/);
    expect(fileProblem({ name: "a.exe", size: 10, type: "application/x" }, limits)).toMatch(
      /not an accepted/
    );
  });
});
