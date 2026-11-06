import { z } from "zod";
import { walkElements, type ElementNode } from "./element";
import type { PageSettings } from "./page";
import type { PropValue } from "./value";

// The values dynamic tokens ({{page.name}}, {{param.id}}, {{now.date}} ...) resolve to. The editor
// canvas, the preview and the published site each build one and hand it to the renderer. It is
// plain data so it can cross the canvas iframe boundary.

export const dynamicContextSchema = z.object({
  page: z.object({ name: z.string().max(200), route: z.string().max(300) }),
  /** Page parameter values by name (the route or query value, else the default). */
  params: z.record(z.string(), z.string().max(2000)),
  /** Page state variables by name: their starting value as text (json stays JSON text). */
  state: z.record(z.string(), z.string().max(100_000)),
  /** The moment `now.*` tokens show, as an ISO string. */
  nowIso: z.string().max(40),
  /** IANA time zone `now.date` and `now.time` are shown in. */
  timeZone: z.string().max(64).default("UTC"),
  /** Where the page is shown: the editor canvas, the owner preview or the live site. */
  mode: z.enum(["editor", "preview", "live"]),
  request: z.object({
    url: z.string().max(2000),
    path: z.string().max(300),
    query: z.string().max(2000)
  }),
  /**
   * Elements that have an ID, by that ID: their attributes and props as text. Read with
   * `{{attr.NAME@ELEMENT_ID}}` and `{{prop.NAME@ELEMENT_ID}}`.
   */
  elements: z
    .record(
      z.string(),
      z.object({
        attrs: z.record(z.string(), z.string().max(5000)),
        props: z.record(z.string(), z.string().max(5000))
      })
    )
    .default({}),
  /** The signed-in visitor, if any. Empty fields while nobody is signed in. */
  user: z
    .object({
      id: z.string().max(200).default(""),
      email: z.string().max(320).default(""),
      name: z.string().max(200).default(""),
      role: z.string().max(64).default("")
    })
    .nullable()
});
export type DynamicContext = z.infer<typeof dynamicContextSchema>;

function flatten(value: PropValue | undefined): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "object") return String(value);
  return value.parts.map((part) => (typeof part === "string" ? part : "")).join("");
}

export interface DynamicContextInput {
  page: { name: string; route: string; settings: Pick<PageSettings, "params" | "state"> };
  mode: DynamicContext["mode"];
  /** Parameter values from the address (route segments and query string), by name. */
  paramValues?: Readonly<Record<string, string>>;
  query?: string;
  origin?: string;
  nowIso?: string;
  timeZone?: string;
  user?: DynamicContext["user"];
  /** The page tree, so element attributes and props can be read by ID. */
  tree?: ElementNode;
}

function plainText(value: PropValue | undefined): string {
  return flatten(value);
}

/** Attributes and props of every element that has an ID, as plain text (tokens inside are dropped). */
function elementValues(root: ElementNode): DynamicContext["elements"] {
  const out: DynamicContext["elements"] = {};
  walkElements(root, (node) => {
    if (!node.htmlId) return;
    const attrs: Record<string, string> = {};
    for (const [name, value] of Object.entries(node.attributes ?? {}))
      attrs[name] = plainText(value);
    const props: Record<string, string> = {};
    for (const [name, value] of Object.entries(node.props)) props[name] = plainText(value);
    out[node.htmlId] = { attrs, props };
  });
  return out;
}

/** Builds the context for a page: parameters take the given value, else their default. */
export function buildDynamicContext(input: DynamicContextInput): DynamicContext {
  const { page, paramValues = {} } = input;
  const params: Record<string, string> = {};
  for (const p of page.settings.params) params[p.name] = paramValues[p.name] ?? p.defaultValue;
  const state: Record<string, string> = {};
  for (const v of page.settings.state) state[v.name] = flatten(v.defaultValue);
  const query = input.query ?? "";
  return {
    page: { name: page.name, route: page.route },
    params,
    state,
    nowIso: input.nowIso ?? new Date().toISOString(),
    timeZone: input.timeZone ?? "UTC",
    mode: input.mode,
    request: {
      url: `${input.origin ?? ""}${page.route}${query ? `?${query}` : ""}`,
      path: page.route,
      query
    },
    elements: input.tree ? elementValues(input.tree) : {},
    user: input.user ?? null
  };
}

function nowParts(iso: string, timeZone: string): { date: string; time: string; year: string } {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return { date: "", time: "", year: "" };
  const zone = (() => {
    try {
      new Intl.DateTimeFormat("en", { timeZone });
      return timeZone;
    } catch {
      return "UTC";
    }
  })();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(at);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).format(at);
  return { date, time, year: date.slice(0, 4) };
}

/** Follows `a.b.0.c` through JSON text; anything that is not there gives "". */
function jsonPath(text: string, path: readonly string[]): string {
  let node: unknown;
  try {
    node = JSON.parse(text);
  } catch {
    return "";
  }
  for (const key of path) {
    if (node === null || typeof node !== "object") return "";
    node = (node as Record<string, unknown>)[key];
  }
  if (node === undefined || node === null) return "";
  return typeof node === "object" ? JSON.stringify(node) : String(node);
}

/** `attr.NAME` or `prop.NAME` read from the element with this ID; anything missing gives "". */
function fromElement(context: DynamicContext, what: string, elementId: string): string {
  const [group, name] = what.split(".");
  const element = context.elements[elementId];
  if (!element || !name) return "";
  if (group === "attr") return element.attrs[name] ?? "";
  if (group === "prop") return element.props[name] ?? "";
  return "";
}

/**
 * Turns a token such as `param.id` or `now.date` into text. Unknown tokens give "" so a typo never
 * prints raw braces on a live page.
 */
export function createTokenResolver(context: DynamicContext): (token: string) => string {
  const when = nowParts(context.nowIso, context.timeZone);
  return (raw) => {
    const at = raw.lastIndexOf("@");
    if (at > 0) return fromElement(context, raw.slice(0, at).trim(), raw.slice(at + 1).trim());
    const [group, name, ...rest] = raw.trim().split(".");
    if (!group || !name) return "";
    switch (group) {
      case "page":
        return name === "name" ? context.page.name : name === "route" ? context.page.route : "";
      case "request":
        return name === "url"
          ? context.request.url
          : name === "path"
            ? context.request.path
            : name === "query"
              ? context.request.query
              : "";
      case "now":
        return name === "iso"
          ? context.nowIso
          : name === "date"
            ? when.date
            : name === "time"
              ? when.time
              : name === "year"
                ? when.year
                : "";
      case "user": {
        const user = context.user;
        if (!user) return "";
        return name === "id"
          ? user.id
          : name === "email"
            ? user.email
            : name === "name"
              ? user.name
              : name === "role"
                ? user.role
                : "";
      }
      case "env":
        return name === "mode" ? context.mode : "";
      case "param":
        return context.params[name] ?? "";
      case "state": {
        const value = context.state[name];
        if (value === undefined) return "";
        return rest.length > 0 ? jsonPath(value, rest) : value;
      }
      default:
        return "";
    }
  };
}
