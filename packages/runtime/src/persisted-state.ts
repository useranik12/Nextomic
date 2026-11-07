import { COOKIE_VALUE_LIMIT, checkStateValue, type AppStateVariable } from "@nextomic/schema";

// Persisted app state (docs/dynamic-data-and-actions.md section 5): values saved in the visitor's
// browser and restored on the next visit. Local storage by default, a cookie for small values the
// server reads while rendering. Every value is saved with the variable's type signature; after a
// publish that changes the type, a stored value that still fits is kept, anything else falls back
// to the default (never a crash). Persisted values are visitor-editable: never trust them.

export type PersistedDef = Pick<
  AppStateVariable,
  "name" | "type" | "isList" | "ref" | "defaultValue" | "persist" | "storage" | "keepAfterLogout"
>;

/** Key/value storage (local storage in the browser). */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  keys(): string[];
}

/** Cookie access (document.cookie in the browser). */
export interface CookieJar {
  get(name: string): string | null;
  set(name: string, value: string): void;
  remove(name: string): void;
  names(): string[];
}

export interface PersistEnv {
  /** The project id; the editor preview passes `preview-<id>` so preview data never mixes in. */
  namespace: string;
  local: KeyValueStore;
  cookies: CookieJar;
}

/** Total size of local storage values one site may use. */
export const PERSIST_TOTAL_LIMIT = 1_000_000;

const signature = (def: Pick<PersistedDef, "type" | "isList">) =>
  `${def.type}${def.isList ? "[]" : ""}`;

const localKey = (env: PersistEnv, name: string) => `nxt:${env.namespace}:state:${name}`;
// Cookie names may not contain ":"; keep them to letters, digits, "_" and "-".
const cookieName = (env: PersistEnv, name: string) =>
  `nxt_${env.namespace.replace(/[^A-Za-z0-9_-]/g, "")}_state_${name}`;

interface Stored {
  s: string;
  v: string;
}

function parseStored(raw: string | null): Stored | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === "object" && "s" in value && "v" in value) {
      const { s, v } = value as { s: unknown; v: unknown };
      if (typeof s === "string" && typeof v === "string") return { s, v };
    }
  } catch {
    // Not ours or damaged: treated as missing.
  }
  return null;
}

function readRaw(env: PersistEnv, def: PersistedDef): string | null {
  return def.storage === "cookie"
    ? env.cookies.get(cookieName(env, def.name))
    : env.local.get(localKey(env, def.name));
}

function removeRaw(env: PersistEnv, def: Pick<PersistedDef, "name" | "storage">) {
  if (def.storage === "cookie") env.cookies.remove(cookieName(env, def.name));
  else env.local.remove(localKey(env, def.name));
}

/**
 * The starting value of every app state variable: the stored value for persisted ones (when it
 * still fits the current type), else the default. Values that no longer fit are removed.
 */
export function restorePersisted(
  defs: readonly PersistedDef[],
  env: PersistEnv
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const def of defs) {
    values[def.name] = def.defaultValue;
    if (!def.persist) continue;
    const stored = parseStored(readRaw(env, def));
    if (!stored) continue;
    if (checkStateValue(def, stored.v) === null) {
      values[def.name] = stored.v;
      if (stored.s !== signature(def)) writePersisted(def, stored.v, env);
    } else {
      removeRaw(env, def);
    }
  }
  return values;
}

export type PersistResult = { ok: true } | { ok: false; reason: string };

function localUsage(env: PersistEnv, except: string): number {
  const prefix = `nxt:${env.namespace}:`;
  let total = 0;
  for (const key of env.local.keys())
    if (key.startsWith(prefix) && key !== except)
      total += key.length + (env.local.get(key)?.length ?? 0);
  return total;
}

/** Saves a persisted variable's new value. Refuses values that do not fit or are too large. */
export function writePersisted(def: PersistedDef, value: string, env: PersistEnv): PersistResult {
  if (!def.persist) return { ok: false, reason: `"${def.name}" is not persisted.` };
  const problem = checkStateValue(def, value);
  if (problem) return { ok: false, reason: problem };
  const raw = JSON.stringify({ s: signature(def), v: value } satisfies Stored);
  try {
    if (def.storage === "cookie") {
      if (encodeURIComponent(raw).length > COOKIE_VALUE_LIMIT)
        return { ok: false, reason: `"${def.name}" is too large for a cookie (about 4 KB).` };
      env.cookies.set(cookieName(env, def.name), raw);
      return { ok: true };
    }
    const key = localKey(env, def.name);
    if (localUsage(env, key) + key.length + raw.length > PERSIST_TOTAL_LIMIT)
      return { ok: false, reason: "Persisted state is full (about 1 MB)." };
    env.local.set(key, raw);
    return { ok: true };
  } catch {
    return { ok: false, reason: "The browser refused to store the value." };
  }
}

/** On logout: clears every persisted value except those with "Keep after logout", and leftovers. */
export function clearOnLogout(defs: readonly PersistedDef[], env: PersistEnv): void {
  const keep = new Set(defs.filter((d) => d.persist && d.keepAfterLogout).map((d) => d.name));
  clearWhere(env, (name) => !keep.has(name));
}

/** Clears every persisted value of the namespace ("Clear persisted state" in the preview). */
export function clearAllPersisted(env: PersistEnv): void {
  clearWhere(env, () => true);
}

function clearWhere(env: PersistEnv, shouldClear: (name: string) => boolean) {
  const localPrefix = `nxt:${env.namespace}:state:`;
  for (const key of env.local.keys())
    if (key.startsWith(localPrefix) && shouldClear(key.slice(localPrefix.length)))
      env.local.remove(key);
  const cookiePrefix = cookieName(env, "");
  for (const name of env.cookies.names())
    if (name.startsWith(cookiePrefix) && shouldClear(name.slice(cookiePrefix.length)))
      env.cookies.remove(name);
}

/** Local storage and document.cookie; a browser that blocks storage behaves as empty. */
export function browserPersistEnv(namespace: string): PersistEnv {
  const safe = <T>(run: () => T, fallback: T): T => {
    try {
      return run();
    } catch {
      return fallback;
    }
  };
  return {
    namespace,
    local: {
      get: (key) => safe(() => window.localStorage.getItem(key), null),
      set: (key, value) => window.localStorage.setItem(key, value),
      remove: (key) => safe(() => window.localStorage.removeItem(key), undefined),
      keys: () => safe(() => Object.keys(window.localStorage), [])
    },
    cookies: {
      get: (name) => {
        const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
        return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
      },
      set: (name, value) => {
        const secure = window.location.protocol === "https:" ? "; Secure" : "";
        document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
      },
      remove: (name) => {
        document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
      },
      names: () =>
        document.cookie
          .split("; ")
          .filter(Boolean)
          .map((c) => c.slice(0, c.indexOf("=")))
    }
  };
}
