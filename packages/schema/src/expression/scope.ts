import { DateTime } from "luxon";
import { parseStateValue, type StateType } from "../state";

// The names an expression can use, built from a dynamic context: page, template, request, user,
// env, now, param, state, app, const, plus $now and $today as dates. Variables are turned from
// their stored text into typed values (numbers, booleans, JSON, dates) using their declared type.

export interface TypedText {
  type: StateType;
  isList: boolean;
}

/** A stored text as the value an expression sees. Empty text is null. */
export function typedValue(text: string, spec: TypedText | undefined): unknown {
  if (!spec) return text;
  if (text.trim() === "") return null;
  if (!spec.isList && spec.type === "timestamptz") {
    const iso = DateTime.fromISO(text, { setZone: true });
    const value = iso.isValid ? iso : DateTime.fromSQL(text, { setZone: true });
    return value.isValid ? value : null;
  }
  const value = parseStateValue(spec, text);
  if (value === undefined || (typeof value === "number" && !Number.isFinite(value))) return null;
  return value;
}

/** Typed values for a group of variables (`state`, `app`, `const`, `param`). */
export function typedGroup(
  values: Readonly<Record<string, string>>,
  types: Readonly<Record<string, TypedText>>,
  group: string
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, text] of Object.entries(values))
    out[name] = typedValue(text, types[`${group}.${name}`]);
  return out;
}

/** $now and $today in a time zone (UTC when the zone is unknown). */
export function nowValues(nowIso: string, timeZone: string): { $now: DateTime; $today: DateTime } {
  const base = DateTime.fromISO(nowIso);
  const zoned = base.setZone(timeZone);
  const now = zoned.isValid ? zoned : base.setZone("UTC");
  return { $now: now, $today: now.startOf("day") };
}

/** What each root name is, for the autocomplete. */
export const ROOT_DOCS: Record<string, string> = {
  page: "The page: name, route, id, status, categories, tags and dates.",
  template: "The template being shown: name, type, status and dates.",
  request: "The address: url, path, query.",
  user: "The signed-in visitor: id, email, name, role (empty when signed out).",
  env: "Where it runs: env.mode is editor, preview or live.",
  now: "Now as text: iso, date, time, year.",
  param: "Page parameters from the address.",
  state: "Page state variables.",
  app: "App state variables.",
  const: "Constants.",
  $now: 'The current date and time (a date you can format: $now.toFormat("dd LLL yyyy")).',
  $today: "Today at midnight (a date)."
};
