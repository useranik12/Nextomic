import { tokenTags, type AppAuthSettings } from "./app-auth";
import { withLoopScope, type LoopFrame } from "./query-scope";
import { z } from "zod";
import { walkElements, type ElementNode } from "./element";
import type { PageSettings } from "./page";
import type { PropValue } from "./value";
import { stateTypeSchema, type StateType } from "./state";
import { runExpression, toText } from "./expression/evaluate";
import { nowValues, typedGroup } from "./expression/scope";
import { splitTemplate } from "./expression/template";

// The values dynamic tokens ({{page.name}}, {{param.id}}, {{now.date}} ...) resolve to. The editor
// canvas, the preview and the published site each build one and hand it to the renderer. It is
// plain data so it can cross the canvas iframe boundary.

const text = (max = 200) => z.string().max(max).default("");

/** Properties every page and template has, readable as {{page.status}}, {{template.status}} and so on. */
function pageMetaShape() {
  return {
    id: text(100),
    /** draft, published or modified */
    status: text(20),
    createdBy: text(),
    createdAt: text(40),
    updatedAt: text(40),
    publishedAt: text(40),
    /** Category and tag names, joined with ", ". */
    categories: text(1000),
    tags: text(1000)
  };
}

export const templateMetaSchema = z.object({
  name: z.string().max(200),
  /** header, footer, error-404 or toast */
  type: text(20),
  ...pageMetaShape()
});
export type TemplateMeta = z.infer<typeof templateMetaSchema>;

/** Builder account data offered as {{nextomic.user.*}}. No tokens or secrets, ever. */
export const nextomicUserSchema = z.object({
  id: z.string().max(200),
  name: z.string().max(200),
  email: z.string().max(320),
  image: z.string().max(2000),
  /** Workspace role: owner, admin or member. */
  role: z.string().max(32),
  emailVerified: z.boolean(),
  twoFactorEnabled: z.boolean(),
  /** Number of passkeys on the account. */
  passkeys: z.number().int().min(0),
  createdAt: z.string().max(40)
});
export type NextomicUser = z.infer<typeof nextomicUserSchema>;

export const dynamicContextSchema = z.object({
  page: z.object({
    name: z.string().max(200),
    route: z.string().max(300),
    ...pageMetaShape()
  }),
  /** The template being shown, when a template is. */
  template: templateMetaSchema.nullable().default(null),
  /** The toast a toast template shows ({{ toast.title }}, message, type); null elsewhere. */
  toast: z
    .object({ title: z.string().max(500), message: z.string().max(5000), type: z.string().max(20) })
    .nullable()
    .default(null),
  /** Page parameter values by name (the route or query value, else the default). */
  params: z.record(z.string(), z.string().max(2000)),
  /** Page state variables by name: their starting value as text (json stays JSON text). */
  state: z.record(z.string(), z.string().max(100_000)),
  /** App state variables by name: their default value as text (persisted values join in the runtime). */
  app: z.record(z.string(), z.string().max(100_000)).default({}),
  /** Constants by name: their fixed value as text. */
  constants: z.record(z.string(), z.string().max(100_000)).default({}),
  /**
   * Declared types of variables, keyed "app.name", "const.name", "state.name", "param.name", so
   * expressions see numbers, booleans, JSON and dates instead of text.
   */
  types: z
    .record(
      z.string(),
      z.object({ type: stateTypeSchema, isList: z.boolean(), ref: z.string().default("") })
    )
    .default({}),
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
   * Elements that have an ID, by that ID: their attributes as text. Read with
   * `{{attr @ ELEMENT_ID:attribute-name}}`.
   */
  elements: z
    .record(
      z.string(),
      z.object({
        attrs: z.record(z.string(), z.string().max(5000))
      })
    )
    .default({}),
  /** The signed-in user of the built app, if any. Empty fields while nobody is signed in. */
  user: z
    .object({
      id: z.string().max(200).default(""),
      email: z.string().max(320).default(""),
      phone: z.string().max(40).default(""),
      emailVerified: z.boolean().default(false),
      name: z.string().max(200).default(""),
      role: z.string().max(64).default(""),
      /** Decoded access token claims; filled only when App Settings keeps token data. */
      jwt: z.record(z.string(), z.unknown()).default({}),
      /** Raw access token; filled only when the project opts in (never for custom code). */
      accessToken: z.string().max(16_384).default("")
    })
    .nullable(),
  /** The builder user (Nextomic account) viewing the editor or preview; null on live sites. */
  nextomicUser: nextomicUserSchema.nullable().default(null),
  /**
   * App Settings > Authentication "Expose the raw access token": only then does the page itself
   * read {{ user.accessToken }}. Server-run fields (query settings, API calls) always get it.
   */
  exposeAccessToken: z.boolean().default(false)
});
export type DynamicContext = z.infer<typeof dynamicContextSchema>;

const EMPTY_APP_USER = {
  id: "",
  email: "",
  phone: "",
  emailVerified: false,
  name: "",
  role: "",
  jwt: {},
  accessToken: ""
};
const EMPTY_NEXTOMIC_USER: NextomicUser = {
  id: "",
  name: "",
  email: "",
  image: "",
  role: "",
  emailVerified: false,
  twoFactorEnabled: false,
  passkeys: 0,
  createdAt: ""
};

function flatten(value: PropValue | undefined): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "object") return String(value);
  return value.parts.map((part) => (typeof part === "string" ? part : "")).join("");
}

type Typed<T> = T & { name: string; type: StateType; isList: boolean; ref: string };

export interface DynamicContextInput {
  page: {
    name: string;
    route: string;
    settings: Pick<PageSettings, "params" | "state">;
    meta?: Partial<DynamicContext["page"]>;
  };
  template?: DynamicContext["template"];
  toast?: DynamicContext["toast"];
  mode: DynamicContext["mode"];
  /** Parameter values from the address (route segments and query string), by name. */
  paramValues?: Readonly<Record<string, string>>;
  query?: string;
  /** Project app state and constants; their values are readable as {{app.x}} and {{const.x}}. */
  globals?: {
    appState: readonly Typed<{ defaultValue: string }>[];
    constants: readonly Typed<{ value: string }>[];
    appAuth?: AppAuthSettings;
  };
  origin?: string;
  nowIso?: string;
  timeZone?: string;
  user?: DynamicContext["user"];
  nextomicUser?: NextomicUser | null;
  /** The page tree, so element attributes and props can be read by ID. */
  tree?: ElementNode;
}

function plainText(value: PropValue | undefined): string {
  return flatten(value);
}

/** Attributes of every element that has an ID, as plain text (tokens inside are dropped). */
function elementValues(root: ElementNode): DynamicContext["elements"] {
  const out: DynamicContext["elements"] = {};
  walkElements(root, (node) => {
    if (!node.htmlId) return;
    const attrs: Record<string, string> = {};
    for (const [name, value] of Object.entries(node.attributes ?? {}))
      attrs[name] = plainText(value);
    out[node.htmlId] = { attrs };
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
  const types: DynamicContext["types"] = {};
  const typeOf = (v: { type: StateType; isList: boolean; ref?: string }) => ({
    type: v.type,
    isList: v.isList,
    ref: v.ref ?? ""
  });
  for (const p of page.settings.params) types[`param.${p.name}`] = typeOf({ ...p, isList: false });
  for (const v of page.settings.state) types[`state.${v.name}`] = typeOf(v);
  const app: Record<string, string> = {};
  for (const v of input.globals?.appState ?? []) {
    app[v.name] = v.defaultValue;
    types[`app.${v.name}`] = typeOf(v);
  }
  const constants: Record<string, string> = {};
  for (const c of input.globals?.constants ?? []) {
    constants[c.name] = c.value;
    types[`const.${c.name}`] = typeOf(c);
  }
  return {
    page: {
      id: "",
      status: "",
      createdBy: "",
      createdAt: "",
      updatedAt: "",
      publishedAt: "",
      categories: "",
      tags: "",
      ...page.meta,
      name: page.name,
      route: page.route
    },
    template: input.template ?? null,
    toast: input.toast ?? null,
    params,
    state,
    app,
    constants,
    types,
    nowIso: input.nowIso ?? new Date().toISOString(),
    timeZone: input.timeZone ?? "UTC",
    mode: input.mode,
    request: {
      url: `${input.origin ?? ""}${page.route}${query ? `?${query}` : ""}`,
      path: page.route,
      query
    },
    elements: input.tree ? elementValues(input.tree) : {},
    user: input.user ?? null,
    nextomicUser: input.nextomicUser ?? null,
    exposeAccessToken: input.globals?.appAuth ? tokenTags(input.globals.appAuth).raw : false
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

/** The target-attribute tag: `attr @ ELEMENT_ID:attribute-name`. Anything missing gives "". */
const ELEMENT_ATTRIBUTE = /^attr\s*@\s*([^\s:]+)\s*:\s*([^\s]+)$/;

function fromElement(context: DynamicContext, match: RegExpExecArray): string {
  const element = context.elements[match[1] as string];
  return element?.attrs[match[2] as string] ?? "";
}

/** The names an expression can use for this context. */
export function expressionScope(
  context: DynamicContext,
  /** True for values filled and used on the server only (query settings, API calls). */
  options: { server?: boolean } = {}
): Record<string, unknown> {
  const when = nowParts(context.nowIso, context.timeZone);
  // The raw token never reaches the page unless the project opted in (docs/app-auth.md).
  const token =
    options.server || context.exposeAccessToken ? (context.user?.accessToken ?? "") : "";
  return {
    page: context.page,
    template: context.template ?? {},
    toast: context.toast ?? { title: "", message: "", type: "" },
    request: context.request,
    user: {
      ...EMPTY_APP_USER,
      ...context.user,
      accessToken: token,
      loggedIn: context.user !== null
    },
    nextomic: { user: context.nextomicUser ?? EMPTY_NEXTOMIC_USER },
    env: { mode: context.mode },
    now: { iso: context.nowIso, date: when.date, time: when.time, year: when.year },
    param: typedGroup(context.params, context.types, "param"),
    state: typedGroup(context.state, context.types, "state"),
    app: typedGroup(context.app, context.types, "app"),
    const: typedGroup(context.constants, context.types, "const"),
    ...nowValues(context.nowIso, context.timeZone)
  };
}

/**
 * Turns what is written between {{ and }} into text. It is an expression (n8n style): names such
 * as `page.name`, methods such as `.toUpperCase()` or `$now.toFormat("yyyy")`, operators and
 * conditions. `attr @ ID:name` reads another element's attribute. Anything that fails or is
 * unknown gives "" so a typo never prints raw braces on a live page. Inside query loops, `frames`
 * adds the loop values.
 */
export function createTokenResolver(
  context: DynamicContext,
  /** Query loop rows around the element, innermost first (`item`, `index`, `parent`). */
  frames: readonly LoopFrame[] = []
): (token: string) => string {
  let scope: Record<string, unknown> | null = null;
  return (raw) => {
    const target = ELEMENT_ATTRIBUTE.exec(raw.trim());
    if (target) return fromElement(context, target);
    scope ??= withLoopScope(expressionScope(context), frames);
    try {
      return toText(runExpression(raw, scope));
    } catch {
      return "";
    }
  };
}

/** Replaces every {{tag}} in a text with what the resolver gives for it. */
export function fillTokens(text: string, resolve: (token: string) => string): string {
  return splitTemplate(text)
    .map((part) => (typeof part === "string" ? part : resolve(part.expr)))
    .join("");
}
