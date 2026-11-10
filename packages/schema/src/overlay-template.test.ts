import { describe, expect, it } from "vitest";
import { blankRuleContext } from "./rules";
import { getAction, slotLists, withFreshIds, walkFlow, type FlowNode } from "./actions";
import {
  defaultTemplateSettings,
  overlayRanks,
  overlayZIndex,
  resolveOverlay,
  SHEET_ENTRY_ANIMATIONS,
  templateSettingsSchema,
  type LayoutCandidate,
  Z_BANDS
} from "./template";

const candidate = (
  id: string,
  type: LayoutCandidate["type"],
  extra: Partial<LayoutCandidate["settings"]> = {}
): LayoutCandidate => ({
  id,
  type,
  name: id,
  settings: {
    priority: 0,
    status: "published",
    rules: {
      id: "root",
      match: "all",
      items: [{ id: "w", field: "site.whole", op: "isTrue", value: "", key: "" } as never]
    },
    ...extra
  }
});

describe("overlay templates", () => {
  it("defaults the overlay to black 10% at full opacity and the entrance to 300ms/100ms", () => {
    const s = defaultTemplateSettings();
    expect(s.overlay).toEqual({ disabled: false, color: "rgb(0 0 0 / 0.1)", opacity: 1 });
    expect(s.entry).toEqual({ animation: "slide-in-up", durationMs: 300, delayMs: 100 });
    expect(s.showAbove).toEqual([]);
  });

  it("rejects overlay colors that could break out of a style rule", () => {
    expect(templateSettingsSchema.safeParse({ overlay: { color: "red;}" } }).success).toBe(false);
    expect(templateSettingsSchema.safeParse({ overlay: { opacity: 2 } }).success).toBe(false);
  });

  it("offers only entrance animations that move up", () => {
    expect(SHEET_ENTRY_ANIMATIONS.length).toBeGreaterThan(3);
    expect(SHEET_ENTRY_ANIMATIONS.map((a) => a.id)).toContain("slide-in-up");
    expect(SHEET_ENTRY_ANIMATIONS.every((a) => a.id.includes("-in-up"))).toBe(true);
  });

  it("resolves only live templates of the asked type whose conditions hold", () => {
    const list = [
      candidate("m", "modal"),
      candidate("s", "bottom-sheet"),
      candidate("draft", "modal", { status: "draft" }),
      candidate("empty", "modal", { rules: { id: "root", match: "all", items: [] } })
    ];
    const ctx = blankRuleContext();
    expect(resolveOverlay(list, ctx, "m", "modal")?.id).toBe("m");
    expect(resolveOverlay(list, ctx, "m", "bottom-sheet")).toBeNull();
    expect(resolveOverlay(list, ctx, "draft", "modal")).toBeNull();
    expect(resolveOverlay(list, ctx, "empty", "modal")).toBeNull();
  });

  it("ranks templates by Show above, survives cycles and unknown ids", () => {
    const ranks = overlayRanks([
      { id: "a", settings: {} },
      { id: "b", settings: { showAbove: ["a"] } },
      { id: "c", settings: { showAbove: ["b", "gone"] } }
    ]);
    expect(ranks).toEqual({ a: 0, b: 1, c: 2 });
    const cycle = overlayRanks([
      { id: "x", settings: { showAbove: ["y"] } },
      { id: "y", settings: { showAbove: ["x"] } }
    ]);
    expect(Object.keys(cycle).sort()).toEqual(["x", "y"]);
  });

  it("stacks toast above modal above bottom sheet whatever the rank", () => {
    expect(Z_BANDS.toast).toBeGreaterThan(overlayZIndex("modal", 49, 99));
    expect(Z_BANDS.modal).toBeGreaterThan(overlayZIndex("bottom-sheet", 49, 99));
    expect(overlayZIndex("modal", 1, 0)).toBeGreaterThan(overlayZIndex("modal", 0, 99));
    expect(overlayZIndex("modal", 0, 2)).toBeGreaterThan(overlayZIndex("modal", 0, 1));
  });
});

describe("nested action flows", () => {
  const toast = (showButton: string, nested: FlowNode[]): FlowNode => ({
    id: "t",
    kind: "action",
    type: "toast",
    params: { title: "Hi", showButton, buttonText: "Undo" },
    slots: { buttonAction: nested }
  });
  const wait: FlowNode = { id: "w", kind: "action", type: "wait", params: {} };

  it("exposes the Button Action lane only while the button is shown", () => {
    expect(getAction("toast")?.fields.some((f) => f.kind === "flow")).toBe(true);
    expect(slotLists(toast("true", [wait])).map((l) => l.list)).toEqual(["slot:buttonAction"]);
    expect(slotLists(toast("false", [wait]))).toEqual([]);
  });

  it("walks and re-ids nodes inside the lane", () => {
    const seen: string[] = [];
    walkFlow([toast("true", [wait])], (n) => seen.push(n.id));
    expect(seen).toEqual(["t", "w"]);
    const copy = withFreshIds(toast("true", [wait])) as Extract<FlowNode, { kind: "action" }>;
    expect(copy.slots?.buttonAction?.[0]?.id).not.toBe("w");
  });
});
