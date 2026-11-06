import { z } from "zod";
import { conditionGroupSchema, type ConditionGroup } from "./condition";
import { styleMapSchema, type StyleMap } from "./style";
import { propValueSchema, type PropValue } from "./value";

export const HTML_ID_PREFIX = "nxtomc-";
export const HTML_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_:.-]*$/;
export const CLASS_NAME_PATTERN = /^-?[_a-zA-Z][_a-zA-Z0-9-]*$/;

export interface ElementNode {
  id: string;
  htmlId?: string | undefined;
  type: string;
  name?: string | undefined;
  htmlTag?: string | undefined;
  classIds: string[];
  props: Record<string, PropValue>;
  attributes?: Record<string, PropValue> | undefined;
  styles: StyleMap;
  customCss?: string | undefined;
  /** Hidden in the editor and in output; set from the element menu. */
  hidden?: boolean | undefined;
  visibility?: ConditionGroup | undefined;
  // Action flows land in Phase 5; flows are stored opaque until then.
  actions: Record<string, unknown[]>;
  children: ElementNode[];
}

export const elementNodeSchema: z.ZodType<ElementNode, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(64),
    htmlId: z.string().regex(HTML_ID_PATTERN).max(64).optional(),
    type: z.string().min(1).max(64),
    name: z.string().max(100).optional(),
    htmlTag: z
      .string()
      .regex(/^[a-z][a-z0-9-]*$/)
      .max(32)
      .optional(),
    classIds: z.array(z.string().regex(CLASS_NAME_PATTERN).max(64)).max(50).default([]),
    props: z.record(z.string(), propValueSchema).default({}),
    attributes: z.record(z.string(), propValueSchema).optional(),
    styles: styleMapSchema.default({ breakpoints: {} }),
    customCss: z.string().max(100_000).optional(),
    hidden: z.boolean().optional(),
    visibility: conditionGroupSchema.optional(),
    actions: z.record(z.string(), z.array(z.unknown())).default({}),
    children: z.array(elementNodeSchema).default([])
  })
);

const HTML_ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function randomSuffix(length: number, random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += HTML_ID_ALPHABET[Math.floor(random() * HTML_ID_ALPHABET.length)];
  }
  return out;
}

// `nxtomc-` + 8 random a-z0-9, unique among `taken`.
export function generateHtmlId(
  taken: ReadonlySet<string>,
  random: () => number = Math.random
): string {
  for (;;) {
    const candidate = `${HTML_ID_PREFIX}${randomSuffix(8, random)}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export function newElementId(): string {
  return crypto.randomUUID();
}

export function walkElements(
  node: ElementNode,
  visit: (node: ElementNode, parent: ElementNode | null) => void,
  parent: ElementNode | null = null
): void {
  visit(node, parent);
  node.children.forEach((child) => walkElements(child, visit, node));
}

export function collectHtmlIds(root: ElementNode): Set<string> {
  const ids = new Set<string>();
  walkElements(root, (node) => {
    if (node.htmlId) ids.add(node.htmlId);
  });
  return ids;
}
