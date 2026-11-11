import {
  BOOLEAN_ATTRIBUTES,
  CLASS_NAME_PATTERN,
  HTML_ID_PATTERN,
  isAllowedAttribute,
  safeUrl,
  toText,
  URL_ATTRIBUTES,
  type ElementEdit,
  type ElementEdits
} from "@nextomic/schema";
import { FlowError, type ActionHandler } from "./engine";

// HTML/CSS Properties actions (docs/dynamic-data-and-actions.md section 8): add, remove and
// toggle classes, set and remove the ID, set and remove attributes. They change the live element
// and remember the change, so a server fragment that redraws the element (or an element whose
// class, ID or attribute condition depends on it) is rendered with the change applied.

const MAX_EDITED = 200;

export class ElementEditStore {
  private readonly edits = new Map<string, ElementEdit>();

  private entry(id: string): ElementEdit {
    let edit = this.edits.get(id);
    if (!edit) {
      if (this.edits.size >= MAX_EDITED)
        throw new FlowError("too-many", "Too many elements were edited on this page.");
      edit = { addClasses: [], removeClasses: [] };
      this.edits.set(id, edit);
    }
    return edit;
  }

  addClass(id: string, name: string): void {
    const edit = this.entry(id);
    edit.removeClasses = edit.removeClasses.filter((n) => n !== name);
    if (!edit.addClasses.includes(name)) edit.addClasses.push(name);
  }

  removeClass(id: string, name: string): void {
    const edit = this.entry(id);
    edit.addClasses = edit.addClasses.filter((n) => n !== name);
    if (!edit.removeClasses.includes(name)) edit.removeClasses.push(name);
  }

  /** A new ID, or null to remove it. */
  setId(id: string, value: string | null): void {
    this.entry(id).htmlId = value;
  }

  /** A new attribute value, or null to remove it. */
  setAttribute(id: string, name: string, value: string | null): void {
    const edit = this.entry(id);
    edit.attributes = { ...edit.attributes, [name]: value };
  }

  /** What fragment requests carry. */
  snapshot(): ElementEdits {
    return Object.fromEntries(this.edits);
  }
}

export interface HtmlPropsDeps {
  edits: ElementEditStore;
  /** Tells the runtime these elements changed ("el.<id>") so dependants are redrawn. */
  touched: (names: string[]) => void;
}

function targets(p: Record<string, unknown>, elementId: string | null) {
  const id = toText(p.element) || elementId;
  if (!id) throw new FlowError("no-element", "Choose the element to change.");
  const els = [...document.querySelectorAll<HTMLElement>(`[data-nid="${CSS.escape(id)}"]`)];
  if (els.length === 0) throw new FlowError("no-element", "The element is not on the page.");
  return { id, els };
}

function className(p: Record<string, unknown>): string {
  const name = toText(p.className).trim();
  if (!CLASS_NAME_PATTERN.test(name))
    throw new FlowError("bad-class", `"${name}" is not a valid class name.`);
  return name;
}

function attributeName(p: Record<string, unknown>): string {
  const name = toText(p.name).trim().toLowerCase();
  if (!isAllowedAttribute(name))
    throw new FlowError("bad-attribute", `The attribute "${name}" cannot be set.`);
  return name;
}

/** Writes an attribute like the renderer does: switch attributes, links and plain text. */
function writeAttribute(el: Element, name: string, value: string): void {
  if (BOOLEAN_ATTRIBUTES.has(name)) {
    if (value === "false") el.removeAttribute(name);
    else el.setAttribute(name, "true");
  } else if (URL_ATTRIBUTES.has(name)) {
    const url = safeUrl(value);
    if (url === "") el.removeAttribute(name);
    else el.setAttribute(name, url);
  } else el.setAttribute(name, value);
}

export function htmlPropsHandlers(deps: HtmlPropsDeps): Record<string, ActionHandler> {
  const classAction =
    (mode: "add" | "remove" | "toggle"): ActionHandler =>
    (p, ctx) => {
      const name = className(p);
      const { id, els } = targets(p, ctx.elementId);
      const add = mode === "toggle" ? !els[0]?.classList.contains(name) : mode === "add";
      for (const el of els) el.classList.toggle(name, add);
      if (add) deps.edits.addClass(id, name);
      else deps.edits.removeClass(id, name);
      deps.touched([`el.${id}`]);
    };
  return {
    "class.add": classAction("add"),
    "class.remove": classAction("remove"),
    "class.toggle": classAction("toggle"),
    "id.set": (p, ctx) => {
      const value = toText(p.id).trim();
      if (!HTML_ID_PATTERN.test(value) || value.length > 64)
        throw new FlowError("bad-id", `"${value}" is not a valid ID.`);
      const { id, els } = targets(p, ctx.elementId);
      for (const el of els) el.id = value;
      deps.edits.setId(id, value);
      deps.touched([`el.${id}`]);
    },
    "id.remove": (p, ctx) => {
      const { id, els } = targets(p, ctx.elementId);
      for (const el of els) el.removeAttribute("id");
      deps.edits.setId(id, null);
      deps.touched([`el.${id}`]);
    },
    "attribute.set": (p, ctx) => {
      const name = attributeName(p);
      const value = toText(p.value);
      const { id, els } = targets(p, ctx.elementId);
      for (const el of els) writeAttribute(el, name, value);
      deps.edits.setAttribute(id, name, value);
      deps.touched([`el.${id}`]);
    },
    "attribute.remove": (p, ctx) => {
      const name = attributeName(p);
      const { id, els } = targets(p, ctx.elementId);
      for (const el of els) el.removeAttribute(name);
      deps.edits.setAttribute(id, name, null);
      deps.touched([`el.${id}`]);
    }
  };
}
