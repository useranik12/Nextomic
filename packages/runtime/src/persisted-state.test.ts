import { describe, expect, it } from "vitest";
import {
  PERSIST_TOTAL_LIMIT,
  clearAllPersisted,
  clearOnLogout,
  restorePersisted,
  writePersisted,
  type PersistEnv,
  type PersistedDef
} from "./persisted-state";

function memoryEnv(namespace = "p1"): PersistEnv {
  const local = new Map<string, string>();
  const cookies = new Map<string, string>();
  return {
    namespace,
    local: {
      get: (k) => local.get(k) ?? null,
      set: (k, v) => void local.set(k, v),
      remove: (k) => void local.delete(k),
      keys: () => [...local.keys()]
    },
    cookies: {
      get: (k) => cookies.get(k) ?? null,
      set: (k, v) => void cookies.set(k, v),
      remove: (k) => void cookies.delete(k),
      names: () => [...cookies.keys()]
    }
  };
}

const def = (over: Partial<PersistedDef> = {}): PersistedDef => ({
  name: "count",
  type: "int",
  isList: false,
  ref: "",
  defaultValue: "0",
  persist: true,
  storage: "local",
  keepAfterLogout: false,
  ...over
});

describe("persisted app state", () => {
  it("restores a saved value after reload and uses the default otherwise", () => {
    const env = memoryEnv();
    expect(restorePersisted([def()], env)).toEqual({ count: "0" });
    expect(writePersisted(def(), "5", env)).toEqual({ ok: true });
    expect(restorePersisted([def()], env)).toEqual({ count: "5" });
  });

  it("never persists a variable with Persist off", () => {
    const env = memoryEnv();
    expect(writePersisted(def({ persist: false }), "5", env).ok).toBe(false);
    expect(env.local.keys()).toEqual([]);
    expect(restorePersisted([def({ persist: false, defaultValue: "1" })], env)).toEqual({
      count: "1"
    });
  });

  it("refuses a value that does not fit the type", () => {
    expect(writePersisted(def(), "abc", memoryEnv()).ok).toBe(false);
    expect(writePersisted(def(), "4", memoryEnv()).ok).toBe(true);
    expect(writePersisted(def(), "4.5", memoryEnv()).ok).toBe(false);
  });

  it("logout clears persisted values except Keep after logout", () => {
    const env = memoryEnv();
    const lang = def({ name: "lang", type: "string", defaultValue: "en", keepAfterLogout: true });
    const consent = def({
      name: "consent",
      type: "boolean",
      defaultValue: "false",
      storage: "cookie",
      keepAfterLogout: true
    });
    writePersisted(def(), "3", env);
    writePersisted(lang, "fr", env);
    writePersisted(consent, "true", env);
    clearOnLogout([def(), lang, consent], env);
    expect(restorePersisted([def(), lang, consent], env)).toEqual({
      count: "0",
      lang: "fr",
      consent: "true"
    });
  });

  it("logout also clears values of variables that no longer exist", () => {
    const env = memoryEnv();
    writePersisted(def({ name: "old" }), "1", env);
    clearOnLogout([def()], env);
    expect(env.local.keys()).toEqual([]);
  });

  it("keeps a stored value that still fits after a type change, resets one that does not", () => {
    const env = memoryEnv();
    writePersisted(def(), "7", env);
    expect(restorePersisted([def({ type: "string" })], env)).toEqual({ count: "7" });
    expect(restorePersisted([def({ type: "boolean", defaultValue: "false" })], env)).toEqual({
      count: "false"
    });
    expect(env.local.keys()).toEqual([]);
  });

  it("limits cookie values to about 4 KB", () => {
    const big = def({ type: "string", storage: "cookie", defaultValue: "" });
    expect(writePersisted(big, "x".repeat(5000), memoryEnv()).ok).toBe(false);
    expect(writePersisted(big, "small", memoryEnv()).ok).toBe(true);
  });

  it("caps the total size of local storage", () => {
    const env = memoryEnv();
    const text = def({ type: "string", defaultValue: "" });
    const first = writePersisted(
      { ...text, name: "a" },
      "x".repeat(PERSIST_TOTAL_LIMIT - 1000),
      env
    );
    expect(first.ok).toBe(true);
    expect(writePersisted({ ...text, name: "b" }, "x".repeat(5000), env).ok).toBe(false);
  });

  it("keeps preview data apart from the live site and clears it on request", () => {
    const live = memoryEnv("p1");
    const preview: PersistEnv = { ...live, namespace: "preview-p1" };
    writePersisted(def(), "9", preview);
    expect(restorePersisted([def()], live)).toEqual({ count: "0" });
    clearAllPersisted(preview);
    expect(restorePersisted([def()], preview)).toEqual({ count: "0" });
  });

  it("treats damaged stored data as missing", () => {
    const env = memoryEnv();
    env.local.set("nxt:p1:state:count", "{not json");
    expect(restorePersisted([def()], env)).toEqual({ count: "0" });
  });
});
