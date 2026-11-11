import { z } from "zod";
import { CLASS_NAME_PATTERN, HTML_ID_PATTERN, walkElements, type ElementNode } from "./element";

// Edits actions make to elements in the browser (Add/Remove/Toggle Class, Set/Remove ID, Set/Remove
// Attribute). The runtime keeps them per element and sends them with every fragment request, so
// the server redraws with them applied and class, ID and attribute conditions see what the visitor
// sees. They are visitor input: bounded, validated, and never trusted beyond what is drawn.

const MAX_EDITED_ELEMENTS = 200;
const className = z.string().regex(CLASS_NAME_PATTERN).max(100);
const attributeName = z
  .string()
  .regex(/^[a-zA-Z][a-zA-Z0-9_:.-]*$/)
  .max(64);

export const elementEditSchema = z.object({
  addClasses: z.array(className).max(50).default([]),
  removeClasses: z.array(className).max(50).default([]),
  /** A new HTML ID, or null when it was removed; absent when untouched. */
  htmlId: z.string().regex(HTML_ID_PATTERN).max(64).nullable().optional(),
  /** Attribute values set by actions; null = removed. */
  attributes: z.record(attributeName, z.string().max(5000).nullable()).optional()
});
export type ElementEdit = z.infer<typeof elementEditSchema>;

export const elementEditsSchema = z
  .record(z.string().min(1).max(64), elementEditSchema)
  .refine((edits) => Object.keys(edits).length <= MAX_EDITED_ELEMENTS, "Too many edited elements.");
export type ElementEdits = z.infer<typeof elementEditsSchema>;

/** A copy of the tree with the edits applied to the elements they name. */
export function applyElementEdits(tree: ElementNode, edits: Readonly<ElementEdits>): ElementNode {
  if (Object.keys(edits).length === 0) return tree;
  const copy = structuredClone(tree);
  walkElements(copy, (node) => {
    const edit = edits[node.id];
    if (!edit) return;
    const classes = new Set(node.classIds);
    for (const name of edit.removeClasses) classes.delete(name);
    for (const name of edit.addClasses) classes.add(name);
    node.classIds = [...classes];
    if (edit.htmlId !== undefined) node.htmlId = edit.htmlId ?? undefined;
    for (const [name, value] of Object.entries(edit.attributes ?? {})) {
      const attributes = { ...node.attributes };
      if (value === null) delete attributes[name];
      else attributes[name] = value;
      node.attributes = attributes;
    }
  });
  return copy;
}
