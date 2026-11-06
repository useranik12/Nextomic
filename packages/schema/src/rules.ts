import { z } from "zod";
import { propValueSchema, dynamicTextOf, type PropValue } from "./value";

// Rules decide where a template (and later a theme, popup or element) applies. A rule compares one
// piece of data (a field) with a value. Rules join in groups with all (AND) or any (OR), and a
// group can hold other groups.

export type RuleKind = "text" | "number" | "date" | "time" | "boolean";

export interface RuleFieldDef {
  id: string;
  label: string;
  group: string;
  kind: RuleKind;
  /** The field also needs a name or selector, such as the parameter name. */
  key?: { label: string; placeholder: string };
  /** Only known in the visitor's browser; the server treats it as not matching until the runtime exists. */
  browserOnly?: boolean;
}

const text = (
  id: string,
  label: string,
  group: string,
  extra: Partial<RuleFieldDef> = {}
): RuleFieldDef => ({ id, label, group, kind: "text", ...extra });

export const RULE_FIELDS: readonly RuleFieldDef[] = [
  { id: "site.whole", label: "Whole site", group: "Site", kind: "boolean" },
  text("page.name", "Page name", "Page"),
  text("page.id", "Page ID", "Page"),
  text("page.createdBy", "Page created by", "Page"),
  { id: "page.publishedAt", label: "Page published date", group: "Page", kind: "date" },
  text("page.route", "Page route", "Page"),
  text("page.param", "Page parameter", "Page", {
    key: { label: "Parameter name", placeholder: "id" }
  }),
  text("page.state", "Page state", "Page", {
    browserOnly: true,
    key: { label: "State variable", placeholder: "isOpen" }
  }),
  text("page.elementById", "Element attribute by ID", "Page", {
    browserOnly: true,
    key: { label: "CSS ID : attribute", placeholder: "nxtomc-ab12cd34:aria-label" }
  }),
  text("page.elementByClass", "Element with class", "Page", {
    browserOnly: true,
    key: { label: "Class name", placeholder: "card" }
  }),
  text("page.elementByAttribute", "Element with attribute", "Page", {
    browserOnly: true,
    key: { label: "Attribute", placeholder: "data-role" }
  }),
  text("user.name", "User name", "User"),
  text("user.email", "User email", "User"),
  text("user.role", "User role", "User"),
  text("user.username", "Username", "User"),
  text("user.id", "User ID", "User"),
  { id: "user.joinedAt", label: "User joined on", group: "User", kind: "date" },
  text("user.workspace", "User workspace", "User"),
  text("user.projectName", "Project name", "User"),
  text("user.projectId", "Project ID", "User"),
  text("user.image", "User image", "User"),
  { id: "user.emailVerified", label: "Email verified", group: "User", kind: "boolean" },
  text("user.verificationStatus", "Verification status", "User"),
  { id: "user.loggedIn", label: "Logged in", group: "User", kind: "boolean" },
  { id: "now.date", label: "Date", group: "Date and time", kind: "date" },
  { id: "now.time", label: "Time", group: "Date and time", kind: "time" },
  text("now.iso", "Date and time (ISO)", "Date and time"),
  text("now.dayOfWeek", "Day of week (1 Monday to 7 Sunday)", "Date and time", { kind: "number" }),
  text("now.dayOfMonth", "Day of month", "Date and time", { kind: "number" }),
  text("now.month", "Month (1 to 12)", "Date and time", { kind: "number" }),
  text("now.year", "Year", "Date and time", { kind: "number" }),
  text("now.hour", "Hour (0 to 23)", "Date and time", { kind: "number" }),
  text("now.minute", "Minute", "Date and time", { kind: "number" }),
  { id: "now.isWeekend", label: "Is weekend", group: "Date and time", kind: "boolean" },
  text("browser.name", "Browser name", "Browser"),
  text("browser.version", "Browser version", "Browser", { kind: "number" }),
  text("browser.language", "Browser language", "Browser"),
  { id: "browser.isMobile", label: "Mobile browser", group: "Browser", kind: "boolean" },
  text("os.name", "Operating system", "Operating system"),
  text("os.device", "Device type", "Operating system"),
  text("url.full", "Current URL", "URL"),
  text("url.host", "Host", "URL"),
  text("url.path", "Path", "URL"),
  text("url.query", "Query string", "URL"),
  text("url.referrer", "Referrer URL", "URL"),
  { id: "is.page", label: "Is a page", group: "Document", kind: "boolean" },
  { id: "is.template", label: "Is a template", group: "Document", kind: "boolean" },
  text("template.type", "Template type", "Document"),
  text("dynamic", "Dynamic data", "Dynamic data", {
    key: { label: "Dynamic data tag", placeholder: "{{param.id}}" }
  })
];

export const RULE_FIELD_IDS = RULE_FIELDS.map((f) => f.id) as [string, ...string[]];
export const ruleFieldById = (id: string): RuleFieldDef | undefined =>
  RULE_FIELDS.find((f) => f.id === id);

export const RULE_OPS = [
  "equals",
  "notEquals",
  "greaterThan",
  "lessThan",
  "isIn",
  "isNotIn",
  "before",
  "after",
  "isTrue",
  "isFalse",
  "contains",
  "notContains",
  "startsWith",
  "endsWith",
  "isEmpty",
  "isNotEmpty"
] as const;
export type RuleOp = (typeof RULE_OPS)[number];

export const RULE_OP_LABELS: Record<RuleOp, string> = {
  equals: "equals",
  notEquals: "does not equal",
  greaterThan: "is more than",
  lessThan: "is less than",
  isIn: "is in",
  isNotIn: "is not in",
  before: "is before",
  after: "is after",
  isTrue: "is true",
  isFalse: "is false",
  contains: "contains",
  notContains: "does not contain",
  startsWith: "starts with",
  endsWith: "ends with",
  isEmpty: "is empty",
  isNotEmpty: "is not empty"
};

const TEXT_OPS: RuleOp[] = [
  "equals",
  "notEquals",
  "contains",
  "notContains",
  "startsWith",
  "endsWith",
  "isIn",
  "isNotIn",
  "isEmpty",
  "isNotEmpty"
];

/** The operators that make sense for a field kind. */
export function opsForKind(kind: RuleKind): RuleOp[] {
  switch (kind) {
    case "boolean":
      return ["isTrue", "isFalse"];
    case "number":
      return ["equals", "notEquals", "greaterThan", "lessThan", "isIn", "isNotIn"];
    case "date":
    case "time":
      return ["equals", "notEquals", "before", "after", "isIn", "isNotIn"];
    default:
      return TEXT_OPS;
  }
}

/** Operators that need no value. */
export const VALUELESS_OPS: readonly RuleOp[] = ["isTrue", "isFalse", "isEmpty", "isNotEmpty"];

export const ruleSchema = z.object({
  id: z.string().min(1).max(64),
  field: z.enum(RULE_FIELD_IDS),
  key: z.string().max(200).default(""),
  op: z.enum(RULE_OPS),
  /** Excluding: the rule must NOT match. */
  exclude: z.boolean().default(false),
  /** Static text mixed with dynamic tags; tags are resolved before comparing. */
  value: propValueSchema.default("")
});
export type Rule = z.infer<typeof ruleSchema>;

export interface RuleGroup {
  id: string;
  match: "all" | "any";
  /** Excluding: the group must NOT match. */
  exclude?: boolean;
  items: (Rule | RuleGroup)[];
}

export const ruleGroupSchema: z.ZodType<RuleGroup, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(64),
    match: z.enum(["all", "any"]).default("all"),
    exclude: z.boolean().optional(),
    items: z.array(z.union([ruleSchema, ruleGroupSchema])).max(50)
  })
);

export const isRuleGroup = (item: Rule | RuleGroup): item is RuleGroup => "items" in item;

export const emptyRuleGroup = (id: string): RuleGroup => ({ id, match: "all", items: [] });

/** How deep groups nest and how many rules a set holds; keeps evaluation and the editor bounded. */
export const MAX_RULE_DEPTH = 4;
export const MAX_RULES = 100;

export function countRules(group: RuleGroup): number {
  return group.items.reduce((n, i) => n + (isRuleGroup(i) ? countRules(i) : 1), 0);
}

export function ruleDepth(group: RuleGroup): number {
  return 1 + Math.max(0, ...group.items.filter(isRuleGroup).map(ruleDepth));
}

export const ruleSetSchema = ruleGroupSchema.refine(
  (g) => ruleDepth(g) <= MAX_RULE_DEPTH && countRules(g) <= MAX_RULES,
  { message: `Rules can nest ${MAX_RULE_DEPTH} levels and hold ${MAX_RULES} rules.` }
);

/** True when any rule in the set can only be known in the visitor's browser. */
export function needsBrowser(group: RuleGroup): boolean {
  return group.items.some((i) =>
    isRuleGroup(i) ? needsBrowser(i) : Boolean(ruleFieldById(i.field)?.browserOnly)
  );
}

/** What rules read. Missing facts are empty text, so a rule on them simply does not match. */
export interface RuleContext {
  kind: "page" | "template";
  templateType: string;
  page: {
    name: string;
    id: string;
    createdBy: string;
    publishedAt: string;
    route: string;
    params: Record<string, string>;
    state: Record<string, string>;
  };
  user: {
    name: string;
    email: string;
    role: string;
    username: string;
    id: string;
    joinedAt: string;
    workspace: string;
    projectName: string;
    projectId: string;
    image: string;
    emailVerified: boolean;
    verificationStatus: string;
    loggedIn: boolean;
  };
  nowIso: string;
  timeZone: string;
  browser: { name: string; version: string; language: string; isMobile: boolean };
  os: { name: string; device: string };
  url: { full: string; host: string; path: string; query: string; referrer: string };
  /** Resolves one dynamic tag (the text between the braces) to its value. */
  resolveTag: (tag: string) => string;
}

function zoned(iso: string, timeZone: string) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  let zone = "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    zone = timeZone;
  } catch {
    zone = "UTC";
  }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      weekday: "short"
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value])
  ) as Record<string, string>;
  const weekday =
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday ?? "") + 1;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday
  };
}

const TAG = /\{\{\s*([^{}]+?)\s*\}\}/g;

/** Replaces each {{tag}} in the text with its value. */
export function resolveTagText(text: string, ctx: RuleContext): string {
  return text.replace(TAG, (_, tag: string) => ctx.resolveTag(tag));
}

/** The value of a field right now, as text (booleans as "true" or "false"); null when unknown here. */
export function readField(field: string, key: string, ctx: RuleContext): string | null {
  const when = zoned(ctx.nowIso, ctx.timeZone);
  const bool = (v: boolean) => (v ? "true" : "false");
  switch (field) {
    case "page.name":
      return ctx.page.name;
    case "page.id":
      return ctx.page.id;
    case "page.createdBy":
      return ctx.page.createdBy;
    case "page.publishedAt":
      return ctx.page.publishedAt;
    case "page.route":
      return ctx.page.route;
    case "page.param":
      return ctx.page.params[key] ?? "";
    case "page.state":
      return ctx.page.state[key] ?? "";
    case "user.name":
      return ctx.user.name;
    case "user.email":
      return ctx.user.email;
    case "user.role":
      return ctx.user.role;
    case "user.username":
      return ctx.user.username;
    case "user.id":
      return ctx.user.id;
    case "user.joinedAt":
      return ctx.user.joinedAt;
    case "user.workspace":
      return ctx.user.workspace;
    case "user.projectName":
      return ctx.user.projectName;
    case "user.projectId":
      return ctx.user.projectId;
    case "user.image":
      return ctx.user.image;
    case "user.verificationStatus":
      return ctx.user.verificationStatus;
    case "user.emailVerified":
      return bool(ctx.user.emailVerified);
    case "user.loggedIn":
      return bool(ctx.user.loggedIn);
    case "now.iso":
      return ctx.nowIso;
    case "now.date":
      return when?.date ?? "";
    case "now.time":
      return when?.time ?? "";
    case "now.dayOfWeek":
      return when ? String(when.weekday) : "";
    case "now.dayOfMonth":
      return when ? String(when.day) : "";
    case "now.month":
      return when ? String(when.month) : "";
    case "now.year":
      return when ? String(when.year) : "";
    case "now.hour":
      return when ? String(when.hour) : "";
    case "now.minute":
      return when ? String(when.minute) : "";
    case "now.isWeekend":
      return when ? bool(when.weekday >= 6) : "false";
    case "browser.name":
      return ctx.browser.name;
    case "browser.version":
      return ctx.browser.version;
    case "browser.language":
      return ctx.browser.language;
    case "browser.isMobile":
      return bool(ctx.browser.isMobile);
    case "os.name":
      return ctx.os.name;
    case "os.device":
      return ctx.os.device;
    case "url.full":
      return ctx.url.full;
    case "url.host":
      return ctx.url.host;
    case "url.path":
      return ctx.url.path;
    case "url.query":
      return ctx.url.query;
    case "url.referrer":
      return ctx.url.referrer;
    case "site.whole":
      return "true";
    case "is.page":
      return bool(ctx.kind === "page");
    case "is.template":
      return bool(ctx.kind === "template");
    case "template.type":
      return ctx.templateType;
    case "dynamic":
      return resolveTagText(key, ctx);
    default:
      return null; // browser-only facts (elements) are not known on the server
  }
}

const valueText = (value: PropValue | undefined, ctx: RuleContext): string =>
  resolveTagText(dynamicTextOf(value), ctx);

const list = (text: string) =>
  text
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");

function compare(kind: RuleKind, left: string, right: string): number | null {
  if (left.trim() === "" || right.trim() === "") return null;
  if (kind === "number") {
    const a = Number(left);
    const b = Number(right);
    return Number.isFinite(a) && Number.isFinite(b) ? a - b : null;
  }
  if (kind === "date") {
    const a = Date.parse(left);
    const b = Date.parse(right);
    if (Number.isFinite(a) && Number.isFinite(b)) return a - b;
  }
  // 24-hour times and ISO dates sort correctly as text.
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Whether one rule matches. A browser-only field matches nothing on the server. */
export function evaluateRule(rule: Rule, ctx: RuleContext): boolean {
  const def = ruleFieldById(rule.field);
  // Browser-only facts are unknown on the server: never a match, and never "excluded" either.
  if (!def || def.browserOnly) return false;
  const left = readField(rule.field, rule.key, ctx);
  // A fact that is not known never matches, and never counts as "excluded" either.
  if (left === null) return false;
  const found = ruleMatches(rule, def.kind, left, ctx);
  return rule.exclude ? !found : found;
}

function ruleMatches(rule: Rule, kind: RuleKind, left: string, ctx: RuleContext): boolean {
  const right = valueText(rule.value, ctx);
  const lower = (s: string) => s.toLowerCase();
  const same = (a: string, b: string) =>
    kind === "text" ? lower(a) === lower(b) : compare(kind, a, b) === 0;
  switch (rule.op) {
    case "isTrue":
      return lower(left) === "true";
    case "isFalse":
      return lower(left) !== "true";
    case "isEmpty":
      return left.trim() === "";
    case "isNotEmpty":
      return left.trim() !== "";
    case "equals":
      return same(left, right);
    case "notEquals":
      return !same(left, right);
    case "greaterThan":
    case "after": {
      const c = compare(kind, left, right);
      return c !== null && c > 0;
    }
    case "lessThan":
    case "before": {
      const c = compare(kind, left, right);
      return c !== null && c < 0;
    }
    case "contains":
      return lower(left).includes(lower(right));
    case "notContains":
      return !lower(left).includes(lower(right));
    case "startsWith":
      return lower(left).startsWith(lower(right));
    case "endsWith":
      return lower(left).endsWith(lower(right));
    case "isIn":
      return list(right).some((v) => same(left, v));
    case "isNotIn":
      return !list(right).some((v) => same(left, v));
  }
}

/** Whether a group matches. An empty group matches everywhere. */
export function evaluateRules(group: RuleGroup, ctx: RuleContext): boolean {
  if (group.items.length === 0) return true;
  const test = (item: Rule | RuleGroup) =>
    isRuleGroup(item) ? evaluateRules(item, ctx) : evaluateRule(item, ctx);
  const found = group.match === "all" ? group.items.every(test) : group.items.some(test);
  return group.exclude ? !found : found;
}

/** How narrowly a set targets: page (3) beats route (2) beats anything else (1) beats everywhere (0). */
export function ruleSpecificity(group: RuleGroup): number {
  let best = 0;
  for (const i of group.items) {
    if (isRuleGroup(i)) best = Math.max(best, ruleSpecificity(i));
    else if (i.field === "site.whole") continue;
    else if (i.field === "page.id" || i.field === "page.name") best = Math.max(best, 3);
    else if (i.field === "page.route" || i.field === "url.path") best = Math.max(best, 2);
    else best = Math.max(best, 1);
  }
  return best;
}

/** A context with nothing known about the visitor, for the editor and tests. */
export function blankRuleContext(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    kind: "page",
    templateType: "",
    page: {
      name: "",
      id: "",
      createdBy: "",
      publishedAt: "",
      route: "/",
      params: {},
      state: {}
    },
    user: {
      name: "",
      email: "",
      role: "",
      username: "",
      id: "",
      joinedAt: "",
      workspace: "",
      projectName: "",
      projectId: "",
      image: "",
      emailVerified: false,
      verificationStatus: "",
      loggedIn: false
    },
    nowIso: new Date().toISOString(),
    timeZone: "UTC",
    browser: { name: "", version: "", language: "", isMobile: false },
    os: { name: "", device: "" },
    url: { full: "", host: "", path: "/", query: "", referrer: "" },
    resolveTag: () => "",
    ...overrides
  };
}
