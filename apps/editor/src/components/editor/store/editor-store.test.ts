import {
  DEFAULT_BREAKPOINTS,
  emptyPageTree,
  defaultPageSettings,
  type ProjectSettings
} from "@nextomic/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "./editor-store";

const project: ProjectSettings = {
  breakpoints: DEFAULT_BREAKPOINTS,
  generateElementIds: true,
  classes: {}
};

function reset() {
  const store = useEditorStore.getState();
  store.init("p1", project);
  store.loadPage(
    { id: "pg1", version: 1 },
    { name: "Home", route: "/", settings: defaultPageSettings(), tree: emptyPageTree() }
  );
}

const tree = () => useEditorStore.getState().doc!.tree;

describe("editor store", () => {
  beforeEach(reset);

  it("inserts elements, selects them, and generates html ids", () => {
    const id = useEditorStore.getState().insertElement("section");
    expect(id).not.toBeNull();
    expect(useEditorStore.getState().selectedId).toBe(id);
    expect(tree().children[0]?.htmlId).toMatch(/^nxtomc-[a-z0-9]{8}$/);
    expect(useEditorStore.getState().saveStatus).toBe("dirty");
  });

  it("omits html ids when generation is off", () => {
    useEditorStore.getState().setGenerateElementIds(false);
    useEditorStore.getState().insertElement("section");
    expect(tree().children[0]?.htmlId).toBeUndefined();
  });

  it("inserts inside a selected container and beside a selected leaf", () => {
    const store = useEditorStore.getState();
    const section = store.insertElement("section")!;
    const heading = useEditorStore.getState().insertElement("heading")!;
    expect(tree().children[0]?.children[0]?.id).toBe(heading);
    useEditorStore.getState().insertElement("text");
    expect(tree().children[0]?.children.map((c) => c.type)).toEqual(["heading", "text"]);
    expect(tree().children[0]?.id).toBe(section);
  });

  it("refuses unknown and hidden element types", () => {
    expect(useEditorStore.getState().insertElement("page")).toBeNull();
    expect(useEditorStore.getState().insertElement("nope")).toBeNull();
  });

  it("undoes and redoes", () => {
    const store = useEditorStore.getState();
    store.insertElement("section");
    store.undo();
    expect(tree().children).toHaveLength(0);
    useEditorStore.getState().redo();
    expect(tree().children).toHaveLength(1);
  });

  it("coalesces rapid edits to the same prop into one undo step", () => {
    const id = useEditorStore.getState().insertElement("heading")!;
    const store = useEditorStore.getState();
    store.setElementProp(id, "text", "H");
    store.setElementProp(id, "text", "He");
    store.setElementProp(id, "text", "Hel");
    useEditorStore.getState().undo();
    expect(tree().children[0]?.props.text).toBe("Heading");
  });

  it("writes styles at the active breakpoint and state", () => {
    const id = useEditorStore.getState().insertElement("container")!;
    const store = useEditorStore.getState();
    store.setActiveBreakpoint("tablet");
    store.setActiveState("hover");
    useEditorStore.getState().setElementStyle(id, "color", "red");
    expect(tree().children[0]?.styles.breakpoints.tablet?.hover?.color).toBe("red");
    useEditorStore.getState().setElementStyle(id, "color", null);
    expect(tree().children[0]?.styles.breakpoints).toEqual({});
  });

  it("duplicates, copies and pastes with new ids", () => {
    const store = useEditorStore.getState();
    const id = store.insertElement("section")!;
    useEditorStore.getState().duplicateElement(id);
    expect(tree().children).toHaveLength(2);
    expect(tree().children[0]?.id).not.toBe(tree().children[1]?.id);
    useEditorStore.getState().copyElement(id);
    useEditorStore.getState().select(null);
    useEditorStore.getState().pasteElement();
    expect(tree().children).toHaveLength(3);
  });

  it("deletes and clears the selection", () => {
    const id = useEditorStore.getState().insertElement("section")!;
    useEditorStore.getState().removeElement(id);
    expect(tree().children).toHaveLength(0);
    expect(useEditorStore.getState().selectedId).toBeNull();
  });

  it("falls back to the base breakpoint when the active one is removed", () => {
    const store = useEditorStore.getState();
    store.setActiveBreakpoint("mobile");
    useEditorStore.getState().setBreakpoints(DEFAULT_BREAKPOINTS.filter((b) => b.id !== "mobile"));
    expect(useEditorStore.getState().activeBreakpointId).toBe("base");
  });

  it("keeps the conflicting server copy until the user picks it", () => {
    const store = useEditorStore.getState();
    store.setConflict(
      { id: "pg1", version: 5 },
      { name: "Server", route: "/", settings: defaultPageSettings(), tree: emptyPageTree() }
    );
    expect(useEditorStore.getState().saveStatus).toBe("conflict");
    useEditorStore.getState().resolveConflictWithServer();
    expect(useEditorStore.getState().doc?.name).toBe("Server");
    expect(useEditorStore.getState().page?.version).toBe(5);
    expect(useEditorStore.getState().saveStatus).toBe("saved");
  });
});
