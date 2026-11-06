import { getElementDefinition } from "@nextomic/renderer";
import {
  BASE_BREAKPOINT_ID,
  sortBreakpoints,
  anyStylesAt,
  assignMissingHtmlIds,
  cloneWithNewIds,
  collectHtmlIds,
  duplicateNode,
  findNode,
  generateHtmlId,
  indentNode,
  insertNode,
  moveNode,
  outdentNode,
  shiftNode,
  unwrapNode,
  wrapNode,
  newElementId,
  reassignBreakpointStyles,
  removeNode,
  renameRefsInStyles,
  renameCssVarRefs,
  renameCssVarsInStyles,
  renameCssVarsInTree,
  renameVariableInTree,
  replaceClassInTree,
  setProp,
  setStyle,
  walkElements,
  type BreakpointDef,
  type ElementNode,
  type PageSettings,
  type StyleMap,
  type ProjectSettings,
  type ProjectFont,
  type ProjectVariable,
  type Theme,
  type PropValue,
  type PseudoState
} from "@nextomic/schema";
import { produce } from "immer";
import { create } from "zustand";

export interface PageDoc {
  name: string;
  route: string;
  settings: PageSettings;
  tree: ElementNode;
}

export type SaveStatus = "saved" | "dirty" | "saving" | "error" | "conflict";

/** Page parameters and state variables are edited as drafts and only join the page when saved. */
export interface PageDrafts {
  params: PageSettings["params"] | null;
  state: PageSettings["state"] | null;
}
export const NO_DRAFTS: PageDrafts = { params: null, state: null };

export interface PageMeta {
  id: string;
  version: number;
}

interface EditorState {
  projectId: string;
  project: ProjectSettings;
  page: PageMeta | null;
  doc: PageDoc | null;
  past: PageDoc[];
  future: PageDoc[];
  lastEditKey: string | null;
  lastEditAt: number;
  selectedId: string | null;
  /** The class being edited in the Design tab; null means the element (its ID) is edited. */
  activeClass: string | null;
  /** A style shown on the canvas while a picker option is hovered. Never saved, never in history. */
  stylePreview: { property: string; value: string } | null;
  /** Increments when a class style changes so the shell can save the project settings. */
  classesTick: number;
  pageDrafts: PageDrafts;
  activeBreakpointId: string;
  activeState: PseudoState;
  clipboard: ElementNode | null;
  saveStatus: SaveStatus;
  saveError: string | null;
  /** Increments after every successful save so lists (page names, routes) can refresh. */
  savedTick: number;
  /** Epoch ms of the last publish, null when the project is not published. */
  publishedAt: number | null;
  conflict: { page: PageMeta; doc: PageDoc } | null;

  init: (projectId: string, project: ProjectSettings) => void;
  loadPage: (page: PageMeta, doc: PageDoc) => void;
  markSaved: (version: number) => void;
  setSaveStatus: (status: SaveStatus, error?: string | null) => void;
  setConflict: (page: PageMeta, doc: PageDoc) => void;
  resolveConflictWithServer: () => void;

  setPublishedAt: (at: number | null) => void;
  select: (id: string | null) => void;
  setActiveClass: (name: string | null) => void;
  setPageDraft: <K extends keyof PageDrafts>(kind: K, value: PageDrafts[K]) => void;
  clearPageDrafts: () => void;
  setActiveBreakpoint: (id: string) => void;
  setActiveState: (state: PseudoState) => void;

  insertElement: (type: string, parentId?: string, index?: number) => string | null;
  moveElement: (id: string, parentId: string, index: number) => boolean;
  removeElement: (id: string) => void;
  /** Direction of a one-step move: up/down among siblings, out to the parent's level, in to the previous sibling. */
  shiftElement: (id: string, direction: "up" | "down" | "out" | "in") => boolean;
  wrapElement: (id: string) => void;
  unwrapElement: (id: string) => void;
  toggleElementHidden: (id: string) => void;
  /** Right-click menu position (viewport pixels) and its target element. */
  contextMenu: { x: number; y: number; id: string } | null;
  openContextMenu: (x: number, y: number, id: string) => void;
  closeContextMenu: () => void;
  duplicateElement: (id: string) => void;
  copyElement: (id: string) => void;
  pasteElement: (parentId?: string) => void;
  /** Renames an element; false (nothing changes) when the name is empty. Names need not be unique. */
  renameElement: (id: string, name: string) => boolean;
  /** The element whose name is being edited (context menu > Rename); the navigator row and panel header react. */
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
  /** Sets one HTML attribute; adds an element ID first when the element has none. */
  setElementAttribute: (id: string, name: string, value: PropValue) => void;
  removeElementAttribute: (id: string, name: string) => void;
  renameElementAttribute: (id: string, from: string, to: string) => void;
  /** The open Design group (one at a time) and the property each element was last edited in. */
  /** True while a setting that the selection outline would cover is being edited (and the project asks to hide it). */
  hideSelection: boolean;
  setHideSelection: (hide: boolean) => void;
  designGroup: string | null;
  setDesignGroup: (group: string | null) => void;
  designMemory: Record<string, { group: string; property: string }>;
  rememberDesign: (nodeId: string, group: string, property: string) => void;
  /** A short message at the bottom of the editor, such as "#nxtomc-abc copied to clipboard". */
  toast: { id: number; message: string } | null;
  showToast: (message: string) => void;
  dismissToast: () => void;
  setElementProp: (id: string, key: string, value: PropValue) => void;
  setElementTag: (id: string, tag: string) => void;
  setElementHtmlId: (id: string, htmlId: string) => void;
  /** Adds a class name, or swaps `replacing` for it; duplicates are ignored. */
  setElementClass: (id: string, name: string, replacing?: string) => void;
  removeElementClass: (id: string, name: string) => void;
  /** Adds variables, or replaces the ones with the same name (generated scales, palettes, edits). */
  upsertVariables: (variables: ProjectVariable[]) => void;
  deleteVariable: (name: string) => void;
  /** Replaces the theme list (create, edit, delete, default); the editor keeps it valid. */
  setThemes: (themes: Theme[]) => void;
  /** Replaces the font list (install, upload, activate, preload, remove). */
  setFonts: (fonts: ProjectFont[]) => void;
  /** Merges settings (categories, framework-independent project fields) and marks the project dirty. */
  patchProject: (patch: Partial<ProjectSettings>) => void;
  /** Server-side work (other saved pages) that waits for Save in the Design System. */
  pendingOps: PendingOp[];
  queueOp: (op: PendingOp) => void;
  clearOps: () => void;
  /** Renames and rewrites references on the open page and in class styles; other pages are server side. */
  renameVariable: (from: string, to: string) => boolean;
  /** Points `var(--from)` at `var(--to)` in the open page, classes and variables, and queues the other pages. */
  renameCssVars: (pairs: [string, string][]) => void;
  /** Class manager operations. They return false when the name is taken or the source is missing. */
  createClass: (name: string) => boolean;
  duplicateClass: (from: string, to: string) => boolean;
  /** Moves an element's own styles into a new class and adds the class to the element; false when the name exists or there is nothing to move. */
  convertStylesToClass: (id: string, name: string) => boolean;
  /** Renames on the open page and in the project classes; other pages are updated by the server. */
  renameClass: (from: string, to: string) => boolean;
  /** `replaceWith` null removes the class from the elements of the open page. */
  deleteClass: (name: string, replaceWith: string | null) => void;
  setElementStyle: (id: string, property: string, value: string | null) => void;
  /** Several declarations in one step (one undo): a value sets the property, null removes it. */
  setElementStyles: (id: string, patch: Readonly<Record<string, string | null>>) => void;
  setStylePreview: (preview: { property: string; value: string } | null) => void;
  /** Replaces every style of the active target (the active class, else the element), e.g. from the CSS editor. */
  setTargetStyles: (id: string, styles: StyleMap) => void;
  updatePageMeta: (patch: Partial<Pick<PageDoc, "name" | "route">>) => void;
  updatePageSettings: (patch: Partial<PageSettings>) => void;
  replaceProject: (project: ProjectSettings) => void;
  setBreakpoints: (
    breakpoints: BreakpointDef[],
    moveStylesFrom?: Record<string, string | null>
  ) => void;
  setGenerateElementIds: (on: boolean) => void;
  undo: () => void;
  redo: () => void;
}

const MAX_HISTORY = 100;
const COALESCE_MS = 800;

const canHaveChildren = (type: string): boolean =>
  getElementDefinition(type)?.canHaveChildren ?? false;

export function createElementNode(
  type: string,
  taken: Set<string>,
  withHtmlId: boolean
): ElementNode | null {
  const definition = getElementDefinition(type);
  if (!definition || definition.hidden) return null;
  const defaults = definition.defaults();
  const node: ElementNode = {
    id: newElementId(),
    type,
    name: defaults.name,
    htmlTag: defaults.htmlTag,
    classIds: [],
    props: { ...defaults.props },
    styles: { breakpoints: {} },
    actions: {},
    children: []
  };
  if (withHtmlId) {
    const htmlId = generateHtmlId(taken);
    taken.add(htmlId);
    node.htmlId = htmlId;
  }
  return node;
}

/** Cross-page changes the server applies when the Design System is saved. */
export type PendingOp =
  | { type: "renameClass"; from: string; to: string }
  | { type: "deleteClass"; name: string; to: string | null }
  | { type: "renameVariable"; from: string; to: string }
  | { type: "renameCssVars"; pairs: [string, string][] };

/** What the user calls an element in messages: its name, else its type. */
function elementLabel(doc: PageDoc | null, id: string): string {
  const node = doc ? findNode(doc.tree, id)?.node : null;
  return node ? (node.name ?? node.type) : "Element";
}

export const useEditorStore = create<EditorState>((set, get) => {
  /** Applies an edit to the document, recording history. Edits with the same key coalesce. */
  function edit(key: string | null, recipe: (doc: PageDoc) => void): boolean {
    const { doc, past, lastEditKey, lastEditAt } = get();
    if (!doc) return false;
    const next = produce(doc, recipe);
    if (next === doc) return false;
    const now = Date.now();
    const coalesce = key !== null && key === lastEditKey && now - lastEditAt < COALESCE_MS;
    set({
      doc: next,
      past: coalesce ? past : [...past, doc].slice(-MAX_HISTORY),
      future: [],
      lastEditKey: key,
      lastEditAt: now,
      saveStatus: "dirty"
    });
    return true;
  }

  return {
    projectId: "",
    project: {
      breakpoints: [],
      generateElementIds: true,
      hideEditBorder: false,
      versionControl: true,
      versionLimit: 200,
      classes: {},
      classCategories: [],
      classMeta: {},
      variableCategories: [],
      variables: [],
      themes: [],
      fonts: [],
      cssFiles: [],
      animations: { folders: [], timelines: [] }
    },
    page: null,
    doc: null,
    past: [],
    future: [],
    lastEditKey: null,
    lastEditAt: 0,
    selectedId: null,
    activeClass: null,
    stylePreview: null,
    classesTick: 0,
    pageDrafts: NO_DRAFTS,
    activeBreakpointId: BASE_BREAKPOINT_ID,
    activeState: "default",
    clipboard: null,
    saveStatus: "saved",
    saveError: null,
    savedTick: 0,
    publishedAt: null,
    conflict: null,

    init: (projectId, project) =>
      set({
        projectId,
        project: { ...project, breakpoints: sortBreakpoints(project.breakpoints) }
      }),

    loadPage: (page, doc) => {
      // With automatic IDs on, elements made before the setting was on get their ID now.
      const missing = get().project.generateElementIds && hasMissingHtmlId(doc.tree);
      const loaded = missing
        ? produce(doc, (draft) => {
            assignMissingHtmlIds(draft.tree);
          })
        : doc;
      set({
        page,
        doc: loaded,
        past: [],
        future: [],
        lastEditKey: null,
        selectedId: null,
        activeClass: null,
        pageDrafts: NO_DRAFTS,
        saveStatus: missing ? "dirty" : "saved",
        saveError: null,
        conflict: null
      });
    },

    markSaved: (version) =>
      set((state) => ({
        page: state.page ? { ...state.page, version } : state.page,
        saveStatus: "saved",
        saveError: null,
        savedTick: state.savedTick + 1
      })),

    setSaveStatus: (status, error = null) => set({ saveStatus: status, saveError: error }),

    setConflict: (page, doc) => set({ conflict: { page, doc }, saveStatus: "conflict" }),

    resolveConflictWithServer: () => {
      const { conflict } = get();
      if (conflict) get().loadPage(conflict.page, conflict.doc);
    },

    setPublishedAt: (publishedAt) => set({ publishedAt }),
    select: (id) => set({ selectedId: id, activeClass: null }),
    setActiveClass: (name) => set({ activeClass: name }),
    setPageDraft: (kind, value) =>
      set((state) => ({ pageDrafts: { ...state.pageDrafts, [kind]: value } })),
    clearPageDrafts: () => set({ pageDrafts: NO_DRAFTS }),
    setActiveBreakpoint: (id) => set({ activeBreakpointId: id }),
    setActiveState: (state) => set({ activeState: state }),

    insertElement: (type, parentId, index) => {
      const { doc, selectedId, project } = get();
      if (!doc) return null;
      const node = createElementNode(type, collectHtmlIds(doc.tree), project.generateElementIds);
      if (!node) return null;
      // Click-to-insert goes inside the selected container, beside a selected leaf, else at the root.
      let target = parentId;
      let at = index;
      if (!target) {
        const selected = selectedId ? findNode(doc.tree, selectedId) : null;
        if (selected && canHaveChildren(selected.node.type)) target = selected.node.id;
        else if (selected?.parent) {
          target = selected.parent.id;
          at = selected.index + 1;
        } else target = doc.tree.id;
      }
      const parentId2 = target;
      const ok = edit(null, (draft) => {
        if (!insertNode(draft.tree, parentId2, node, at, canHaveChildren)) {
          insertNode(draft.tree, draft.tree.id, node, undefined, canHaveChildren);
        }
      });
      if (!ok) return null;
      set({ selectedId: node.id });
      return node.id;
    },

    moveElement: (id, parentId, index) => {
      let moved = false;
      edit(null, (draft) => {
        moved = moveNode(draft.tree, id, parentId, index, canHaveChildren);
      });
      return moved;
    },

    removeElement: (id) => {
      edit(null, (draft) => {
        removeNode(draft.tree, id);
      });
      const { doc, selectedId } = get();
      if (doc && selectedId && !findNode(doc.tree, selectedId)) set({ selectedId: null });
    },

    shiftElement: (id, direction) => {
      let moved = false;
      edit(null, (draft) => {
        if (direction === "up") moved = shiftNode(draft.tree, id, -1);
        else if (direction === "down") moved = shiftNode(draft.tree, id, 1);
        else if (direction === "out") moved = outdentNode(draft.tree, id);
        else moved = indentNode(draft.tree, id, canHaveChildren);
      });
      return moved;
    },

    wrapElement: (id) => {
      const { doc, project } = get();
      if (!doc) return;
      const wrapper = createElementNode(
        "container",
        collectHtmlIds(doc.tree),
        project.generateElementIds
      );
      if (!wrapper) return;
      edit(null, (draft) => {
        wrapNode(draft.tree, id, wrapper);
      });
      set({ selectedId: wrapper.id });
    },

    unwrapElement: (id) => {
      edit(null, (draft) => {
        unwrapNode(draft.tree, id);
      });
      const { doc, selectedId } = get();
      if (doc && selectedId && !findNode(doc.tree, selectedId)) set({ selectedId: null });
    },

    toggleElementHidden: (id) =>
      void edit(null, (draft) => {
        const found = findNode(draft.tree, id);
        if (!found?.parent) return;
        if (found.node.hidden) delete found.node.hidden;
        else found.node.hidden = true;
      }),

    contextMenu: null,
    openContextMenu: (x, y, id) => set({ contextMenu: { x, y, id }, selectedId: id }),
    closeContextMenu: () => set({ contextMenu: null }),

    duplicateElement: (id) => {
      const { project } = get();
      let copyId: string | null = null;
      edit(null, (draft) => {
        copyId = duplicateNode(draft.tree, id, project.generateElementIds)?.id ?? null;
      });
      if (copyId) {
        set({ selectedId: copyId });
        get().showToast(`${elementLabel(get().doc, id)} duplicated`);
      }
    },

    copyElement: (id) => {
      const { doc } = get();
      const found = doc ? findNode(doc.tree, id) : null;
      if (found && found.parent) {
        set({ clipboard: JSON.parse(JSON.stringify(found.node)) });
        get().showToast(`${found.node.name ?? found.node.type} copied to clipboard`);
      }
    },

    pasteElement: (parentId) => {
      const { clipboard, doc, selectedId, project } = get();
      if (!clipboard || !doc) return;
      const selected = selectedId ? findNode(doc.tree, selectedId) : null;
      let target = parentId ?? doc.tree.id;
      let at: number | undefined;
      if (!parentId && selected) {
        if (canHaveChildren(selected.node.type)) target = selected.node.id;
        else if (selected.parent) {
          target = selected.parent.id;
          at = selected.index + 1;
        }
      }
      const copy = cloneWithNewIds(clipboard, collectHtmlIds(doc.tree), project.generateElementIds);
      const finalTarget = target;
      edit(null, (draft) => {
        if (!insertNode(draft.tree, finalTarget, copy, at, canHaveChildren)) {
          insertNode(draft.tree, draft.tree.id, copy, undefined, canHaveChildren);
        }
      });
      set({ selectedId: copy.id });
      get().showToast(`${copy.name ?? copy.type} pasted`);
    },

    renameElement: (id, name) => {
      const { doc } = get();
      const trimmed = name.trim();
      if (!doc || trimmed === "") return false;
      edit(`name:${id}`, (draft) => {
        const found = findNode(draft.tree, id);
        if (found) found.node.name = trimmed;
      });
      get().showToast(`Renamed to ${trimmed}`);
      return true;
    },
    renamingId: null,
    setRenamingId: (id) => set({ renamingId: id }),

    setElementAttribute: (id, name, value) => {
      edit(`attr:${id}:${name}`, (draft) => {
        const found = findNode(draft.tree, id);
        if (!found) return;
        if (!found.node.htmlId) {
          found.node.htmlId = generateHtmlId(collectHtmlIds(draft.tree));
        }
        found.node.attributes = { ...(found.node.attributes ?? {}), [name]: value };
      });
    },
    removeElementAttribute: (id, name) =>
      void edit(`attr:${id}:${name}:remove`, (draft) => {
        const found = findNode(draft.tree, id);
        if (!found?.node.attributes || !(name in found.node.attributes)) return;
        const { [name]: _removed, ...rest } = found.node.attributes;
        void _removed;
        if (Object.keys(rest).length === 0) delete found.node.attributes;
        else found.node.attributes = rest;
      }),
    renameElementAttribute: (id, from, to) =>
      void edit(null, (draft) => {
        const found = findNode(draft.tree, id);
        const attrs = found?.node.attributes;
        if (!found || !attrs || !(from in attrs) || from === to || to in attrs) return;
        // Rebuild so the row keeps its place in the list.
        found.node.attributes = Object.fromEntries(
          Object.entries(attrs).map(([k, v]) => [k === from ? to : k, v])
        );
      }),

    hideSelection: false,
    setHideSelection: (hide) => {
      if (get().hideSelection !== hide) set({ hideSelection: hide });
    },
    designGroup: "layout",
    setDesignGroup: (group) => set({ designGroup: group }),
    designMemory: {},
    rememberDesign: (nodeId, group, property) => {
      const known = get().designMemory[nodeId];
      if (known?.group === group && known.property === property) return;
      set({ designMemory: { ...get().designMemory, [nodeId]: { group, property } } });
    },

    toast: null,
    showToast: (message) => set({ toast: { id: Date.now(), message } }),
    dismissToast: () => set({ toast: null }),

    setElementProp: (id, key, value) =>
      void edit(`prop:${id}:${key}`, (draft) => {
        const found = findNode(draft.tree, id);
        if (found) setProp(found.node, key, value);
      }),

    setElementTag: (id, tag) =>
      void edit(`tag:${id}`, (draft) => {
        const found = findNode(draft.tree, id);
        if (found) found.node.htmlTag = tag;
      }),

    setElementHtmlId: (id, htmlId) =>
      void edit(`htmlId:${id}`, (draft) => {
        const found = findNode(draft.tree, id);
        if (!found) return;
        const trimmed = htmlId.trim();
        if (trimmed === "") delete found.node.htmlId;
        else found.node.htmlId = trimmed;
      }),

    setElementClass: (id, name, replacing) => {
      if (replacing !== undefined && replacing !== name) {
        const { project, activeClass } = get();
        const styles = project.classes[replacing];
        if (styles && !project.classes[name]) {
          const { [replacing]: _moved, ...rest } = project.classes;
          set({
            project: { ...project, classes: { ...rest, [name]: styles } },
            classesTick: get().classesTick + 1,
            saveStatus: dirtyStatus(get().saveStatus)
          });
        }
        if (activeClass === replacing) set({ activeClass: name });
      }
      edit(null, (draft) => {
        const found = findNode(draft.tree, id);
        if (!found) return;
        const list = found.node.classIds;
        const at = replacing === undefined ? -1 : list.indexOf(replacing);
        if (list.includes(name)) {
          if (at >= 0 && replacing !== name) list.splice(at, 1);
          return;
        }
        if (at >= 0) list[at] = name;
        else list.push(name);
      });
    },

    removeElementClass: (id, name) => {
      if (get().activeClass === name) set({ activeClass: null });
      edit(null, (draft) => {
        const found = findNode(draft.tree, id);
        if (found) found.node.classIds = found.node.classIds.filter((c) => c !== name);
      });
    },

    upsertVariables: (variables) => {
      const { project } = get();
      const byName = new Map(project.variables.map((v) => [v.name, v]));
      for (const v of variables) byName.set(v.name, v);
      set({
        project: { ...project, variables: [...byName.values()] },
        classesTick: get().classesTick + 1,
        saveStatus: dirtyStatus(get().saveStatus)
      });
    },

    setThemes: (themes) => {
      set({
        project: { ...get().project, themes },
        classesTick: get().classesTick + 1,
        saveStatus: dirtyStatus(get().saveStatus)
      });
    },

    setFonts: (fonts) => {
      set({
        project: { ...get().project, fonts },
        classesTick: get().classesTick + 1,
        saveStatus: dirtyStatus(get().saveStatus)
      });
    },

    patchProject: (patch) => {
      set({
        project: { ...get().project, ...patch },
        classesTick: get().classesTick + 1,
        saveStatus: dirtyStatus(get().saveStatus)
      });
    },

    pendingOps: [],
    queueOp: (op) => set({ pendingOps: [...get().pendingOps, op] }),
    clearOps: () => set({ pendingOps: [] }),

    deleteVariable: (name) => {
      const { project } = get();
      set({
        project: { ...project, variables: project.variables.filter((v) => v.name !== name) },
        classesTick: get().classesTick + 1,
        saveStatus: dirtyStatus(get().saveStatus)
      });
    },

    renameVariable: (from, to) => {
      const { project } = get();
      if (from === to || project.variables.some((v) => v.name === to)) return false;
      const classes = Object.fromEntries(
        Object.entries(project.classes).map(([name, styles]) => [
          name,
          renameRefsInStyles(styles, from, to)
        ])
      );
      edit(null, (draft) => {
        renameVariableInTree(draft.tree, from, to);
      });
      set({
        project: {
          ...project,
          classes,
          variables: project.variables.map((v) => (v.name === from ? { ...v, name: to } : v))
        },
        classesTick: get().classesTick + 1,
        saveStatus: dirtyStatus(get().saveStatus)
      });
      return true;
    },

    renameCssVars: (pairs) => {
      if (pairs.length === 0) return;
      const renames = new Map(pairs);
      const { project } = get();
      const classes = Object.fromEntries(
        Object.entries(project.classes).map(([name, styles]) => [
          name,
          renameCssVarsInStyles(styles, renames)
        ])
      );
      edit(null, (draft) => {
        renameCssVarsInTree(draft.tree, renames);
      });
      set({
        project: {
          ...project,
          classes,
          variables: project.variables.map((v) => ({
            ...v,
            value: renameCssVarRefs(v.value, renames)
          }))
        },
        pendingOps: [...get().pendingOps, { type: "renameCssVars", pairs }],
        classesTick: get().classesTick + 1,
        saveStatus: dirtyStatus(get().saveStatus)
      });
    },

    createClass: (name) => {
      const { project } = get();
      if (project.classes[name]) return false;
      get().replaceProject({
        ...project,
        classes: { ...project.classes, [name]: { breakpoints: {} } }
      });
      set({ classesTick: get().classesTick + 1, saveStatus: dirtyStatus(get().saveStatus) });
      return true;
    },

    convertStylesToClass: (id, name) => {
      const { doc, project } = get();
      const found = doc ? findNode(doc.tree, id) : null;
      if (!found || project.classes[name]) return false;
      const breakpoints = structuredClone(found.node.styles.breakpoints);
      const hasStyles = Object.values(breakpoints).some((byState) =>
        Object.values(byState).some((decls) => Object.keys(decls).length > 0)
      );
      if (!hasStyles) return false;
      get().replaceProject({
        ...project,
        classes: { ...project.classes, [name]: { breakpoints } }
      });
      edit(null, (draft) => {
        const target = findNode(draft.tree, id);
        if (!target) return;
        target.node.styles = { ...target.node.styles, breakpoints: {} };
        if (!target.node.classIds.includes(name)) target.node.classIds.push(name);
      });
      set({ activeClass: name, classesTick: get().classesTick + 1 });
      return true;
    },

    duplicateClass: (from, to) => {
      const { project } = get();
      const source = project.classes[from];
      if (!source || project.classes[to]) return false;
      get().replaceProject({
        ...project,
        classes: { ...project.classes, [to]: structuredClone(source) }
      });
      set({ classesTick: get().classesTick + 1, saveStatus: dirtyStatus(get().saveStatus) });
      return true;
    },

    renameClass: (from, to) => {
      const { project, activeClass } = get();
      if (from === to || project.classes[to]) return false;
      const { [from]: moved, ...rest } = project.classes;
      const classes = moved ? { ...rest, [to]: moved } : rest;
      edit(null, (draft) => {
        replaceClassInTree(draft.tree, from, to);
      });
      set({
        project: { ...project, classes },
        activeClass: activeClass === from ? to : activeClass,
        classesTick: get().classesTick + 1,
        saveStatus: dirtyStatus(get().saveStatus)
      });
      return true;
    },

    deleteClass: (name, replaceWith) => {
      const { project, activeClass } = get();
      const { [name]: _removed, ...classes } = project.classes;
      edit(null, (draft) => {
        replaceClassInTree(draft.tree, name, replaceWith);
      });
      set({
        project: { ...project, classes },
        activeClass: activeClass === name ? null : activeClass,
        classesTick: get().classesTick + 1,
        saveStatus: dirtyStatus(get().saveStatus)
      });
    },

    setStylePreview: (stylePreview) => set({ stylePreview }),

    setElementStyle: (id, property, value) => {
      const { activeBreakpointId, activeState, activeClass, project } = get();
      if (activeClass) {
        const styles: StyleMap = structuredClone(
          project.classes[activeClass] ?? { breakpoints: {} }
        );
        setStyle({ styles }, activeBreakpointId, activeState, property, value);
        const classes = { ...project.classes };
        if (Object.keys(styles.breakpoints).length === 0) delete classes[activeClass];
        else classes[activeClass] = styles;
        set({
          project: { ...project, classes },
          classesTick: get().classesTick + 1,
          saveStatus: dirtyStatus(get().saveStatus)
        });
        return;
      }
      edit(`style:${id}:${activeBreakpointId}:${activeState}:${property}`, (draft) => {
        const found = findNode(draft.tree, id);
        if (found) setStyle(found.node, activeBreakpointId, activeState, property, value);
      });
    },

    setElementStyles: (id, patch) => {
      const { activeBreakpointId, activeState, activeClass, project } = get();
      const entries = Object.entries(patch);
      if (activeClass) {
        const styles: StyleMap = structuredClone(
          project.classes[activeClass] ?? { breakpoints: {} }
        );
        for (const [property, value] of entries) {
          setStyle({ styles }, activeBreakpointId, activeState, property, value);
        }
        const classes = { ...project.classes };
        if (Object.keys(styles.breakpoints).length === 0 && !styles.raw)
          delete classes[activeClass];
        else classes[activeClass] = styles;
        set({
          project: { ...project, classes },
          classesTick: get().classesTick + 1,
          saveStatus: dirtyStatus(get().saveStatus)
        });
        return;
      }
      edit(
        `styles:${id}:${activeBreakpointId}:${activeState}:${entries.map(([k]) => k).join(",")}`,
        (draft) => {
          const found = findNode(draft.tree, id);
          if (!found) return;
          for (const [property, value] of entries) {
            setStyle(found.node, activeBreakpointId, activeState, property, value);
          }
        }
      );
    },

    setTargetStyles: (id, styles) => {
      const { activeClass, project } = get();
      if (activeClass) {
        const classes = { ...project.classes };
        if (Object.keys(styles.breakpoints).length === 0 && !styles.raw)
          delete classes[activeClass];
        else classes[activeClass] = styles;
        set({
          project: { ...project, classes },
          classesTick: get().classesTick + 1,
          saveStatus: dirtyStatus(get().saveStatus)
        });
        return;
      }
      edit(`css:${id}`, (draft) => {
        const found = findNode(draft.tree, id);
        if (found) found.node.styles = styles;
      });
    },

    updatePageMeta: (patch) =>
      void edit(`meta:${Object.keys(patch).join(",")}`, (draft) => {
        Object.assign(draft, patch);
      }),

    updatePageSettings: (patch) =>
      void edit(`settings:${Object.keys(patch).join(",")}`, (draft) => {
        Object.assign(draft.settings, patch);
      }),

    replaceProject: (project) => set({ project }),

    setBreakpoints: (breakpoints, moveStylesFrom) => {
      const { project, doc } = get();
      if (doc && moveStylesFrom) {
        edit(null, (draft) => {
          for (const [from, to] of Object.entries(moveStylesFrom)) {
            reassignBreakpointStyles(draft.tree, from, to);
          }
        });
      }
      const ids = new Set(breakpoints.map((b) => b.id));
      set((state) => ({
        project: { ...project, breakpoints: sortBreakpoints(breakpoints) },
        activeBreakpointId: ids.has(state.activeBreakpointId)
          ? state.activeBreakpointId
          : BASE_BREAKPOINT_ID
      }));
    },

    setGenerateElementIds: (on) => {
      set((state) => ({ project: { ...state.project, generateElementIds: on } }));
      if (on) {
        edit(null, (draft) => {
          assignMissingHtmlIds(draft.tree);
        });
      }
    },

    undo: () => {
      const { doc, past, future } = get();
      const previous = past[past.length - 1];
      if (!doc || !previous) return;
      set({
        doc: previous,
        past: past.slice(0, -1),
        future: [doc, ...future],
        lastEditKey: null,
        saveStatus: "dirty"
      });
      dropMissingSelection();
    },

    redo: () => {
      const { doc, past, future } = get();
      const next = future[0];
      if (!doc || !next) return;
      set({
        doc: next,
        past: [...past, doc],
        future: future.slice(1),
        lastEditKey: null,
        saveStatus: "dirty"
      });
      dropMissingSelection();
    }
  };

  function dropMissingSelection(): void {
    const { doc, selectedId } = get();
    if (doc && selectedId && !findNode(doc.tree, selectedId)) set({ selectedId: null });
  }
});

export function breakpointHasStyles(doc: PageDoc | null, breakpointId: string): boolean {
  return doc ? anyStylesAt(doc.tree, breakpointId) : false;
}

export function countElements(doc: PageDoc | null): number {
  let count = 0;
  if (doc) walkElements(doc.tree, () => (count += 1));
  return count;
}

/** Edits make a page "dirty", but never hide an unresolved conflict or an in-flight save. */
function hasMissingHtmlId(root: ElementNode): boolean {
  let missing = false;
  walkElements(root, (node) => {
    if (node.type !== "page" && !node.htmlId) missing = true;
  });
  return missing;
}

const dirtyStatus = (status: SaveStatus): SaveStatus =>
  status === "conflict" || status === "saving" ? status : "dirty";

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Names of the page settings groups whose edits have not been saved with their check icon. */
export function unsavedDraftLabels(
  drafts: PageDrafts,
  settings: PageSettings | undefined
): string[] {
  const labels: string[] = [];
  if (settings && drafts.params && !sameJson(drafts.params, settings.params))
    labels.push("Page Parameters");
  if (settings && drafts.state && !sameJson(drafts.state, settings.state))
    labels.push("Page State Variables");
  return labels;
}
