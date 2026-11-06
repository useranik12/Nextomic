// HTML attributes an element can carry (Element tab > Attributes). Names are limited so an author
// cannot add event handlers, inline styles or anything that changes how the builder keys elements.

export const ATTRIBUTE_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

const BLOCKED = new Set(["id", "class", "style", "srcdoc", "data-nid"]);
const GENERAL = new Set([
  "title",
  "role",
  "tabindex",
  "lang",
  "dir",
  "alt",
  "name",
  "type",
  "value",
  "placeholder",
  "for",
  "href",
  "target",
  "rel",
  "src",
  "srcset",
  "sizes",
  "loading",
  "download",
  "width",
  "height",
  "autocomplete",
  "required",
  "disabled",
  "readonly",
  "checked",
  "selected",
  "multiple",
  "min",
  "max",
  "step",
  "pattern",
  "maxlength",
  "minlength",
  "rows",
  "cols",
  "colspan",
  "rowspan",
  "hidden",
  "draggable",
  "contenteditable",
  "spellcheck",
  "autofocus",
  "inputmode",
  "enterkeyhint",
  "accesskey",
  "translate"
]);

/** Attributes whose value is a link: only http(s), mailto, tel and relative paths are allowed in them. */
export const URL_ATTRIBUTES: ReadonlySet<string> = new Set([
  "href",
  "src",
  "poster",
  "action",
  "formaction"
]);

/** True when an attribute name may be set: aria-*, data-* or a known safe HTML attribute. */
export function isAllowedAttribute(name: string): boolean {
  if (!ATTRIBUTE_NAME_PATTERN.test(name) || name.length > 64 || BLOCKED.has(name)) return false;
  if (name.startsWith("on")) return false;
  return /^(aria|data)-[a-z0-9-]+$/.test(name) || GENERAL.has(name);
}
