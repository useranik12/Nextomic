import { describe, expect, it } from "vitest";
import {
  appAuthSettingsSchema,
  defaultAppAuthSettings,
  newPageRequiresAuth,
  pageRequiresAuth,
  rawTokenProblem,
  tokenTags,
  usesRawToken
} from "./app-auth";
import type { ElementNode } from "./element";
import { elementQuerySchema, type ElementQuery } from "./query";
import { collectLoopRows } from "./query-loop-rows";
import { buildDynamicContext, dynamicContextSchema, expressionScope } from "./dynamic-context";
import { runExpression } from "./expression/evaluate";
import { defaultPageSettings } from "./page";

const auth = (patch: object) => appAuthSettingsSchema.parse({ enabled: true, ...patch });

describe("app auth settings", () => {
  it("defaults to off", () => {
    expect(appAuthSettingsSchema.parse({})).toMatchObject({ enabled: false, provider: "supabase" });
  });

  it("never protects the login page, and nothing while auth is off", () => {
    const on = auth({ entryPageId: "login" });
    expect(pageRequiresAuth(on, { id: "dash", requiresAuth: true })).toBe(true);
    expect(pageRequiresAuth(on, { id: "login", requiresAuth: true })).toBe(false);
    expect(pageRequiresAuth({ ...on, enabled: false }, { id: "dash", requiresAuth: true })).toBe(
      false
    );
  });

  it("new pages require sign-in only when auth is on and the default is set", () => {
    expect(newPageRequiresAuth(auth({ requireByDefault: true }))).toBe(true);
    expect(newPageRequiresAuth(auth({ requireByDefault: false }))).toBe(false);
    expect(newPageRequiresAuth(appAuthSettingsSchema.parse({ requireByDefault: true }))).toBe(
      false
    );
  });
});

describe("user tags", () => {
  const context = (nextomicUser: Parameters<typeof buildDynamicContext>[0]["nextomicUser"]) =>
    expressionScope(
      buildDynamicContext({
        page: { name: "Home", route: "/", settings: defaultPageSettings() },
        mode: "editor",
        nextomicUser
      })
    );

  it("reads the builder account and an empty, logged-out app user", () => {
    const scope = context({
      id: "u1",
      name: "Ana",
      email: "ana@example.com",
      image: "",
      role: "owner",
      emailVerified: true,
      twoFactorEnabled: false,
      passkeys: 2,
      createdAt: "2026-11-08T00:00:00.000Z"
    });
    expect(runExpression("nextomic.user.name", scope)).toBe("Ana");
    expect(runExpression("nextomic.user.passkeys", scope)).toBe(2);
    expect(runExpression("user.loggedIn", scope)).toBe(false);
    expect(runExpression("user.phone", scope)).toBe("");
  });

  it("gives empty builder fields on live sites", () => {
    expect(runExpression("nextomic.user.email", context(null))).toBe("");
  });
});

describe("token tags", () => {
  it("are off by default and need authentication on", () => {
    expect(tokenTags(defaultAppAuthSettings())).toEqual({ claims: false, raw: false });
    const on = { ...defaultAppAuthSettings(), tokenClaims: true, exposeAccessToken: true };
    expect(tokenTags(on)).toEqual({ claims: false, raw: false });
    expect(tokenTags({ ...on, enabled: true })).toEqual({ claims: true, raw: true });
  });

  it("reads claims with dot notation and stays empty when signed out", () => {
    const base = { page: { name: "Home", route: "/", settings: defaultPageSettings() } };
    const user = dynamicContextSchema.shape.user.parse({
      id: "u1",
      jwt: { role: "editor", app_metadata: { plan: "pro" }, exp: 99 }
    });
    const scope = expressionScope(buildDynamicContext({ ...base, mode: "live", user }));
    expect(runExpression("user.jwt.app_metadata.plan", scope)).toBe("pro");
    expect(runExpression("user.jwt.exp", scope)).toBe(99);
    const empty = expressionScope(buildDynamicContext({ ...base, mode: "live" }));
    expect(runExpression("user.jwt.role", empty)).toBeUndefined();
    expect(runExpression("user.accessToken", empty)).toBe("");
  });
});

describe("raw token reach", () => {
  const page = { name: "Home", route: "/", settings: defaultPageSettings() };
  const user = {
    id: "u",
    email: "",
    phone: "",
    emailVerified: false,
    name: "",
    role: "",
    jwt: {},
    accessToken: "secret-token"
  };
  const context = (expose: boolean) =>
    buildDynamicContext({
      page,
      mode: "live",
      user,
      globals: {
        appState: [],
        constants: [],
        appAuth: { ...defaultAppAuthSettings(), enabled: true, exposeAccessToken: expose }
      }
    });

  it("hides the token from the page unless exposed; server fields always get it", () => {
    const read = (scope: Record<string, unknown>) => runExpression("user.accessToken", scope);
    expect(read(expressionScope(context(false)))).toBe("");
    expect(read(expressionScope(context(false), { server: true }))).toBe("secret-token");
    expect(read(expressionScope(context(true)))).toBe("secret-token");
  });

  it("fills query settings from the server scope but builds local rows from the page scope", async () => {
    const node = (id: string, query?: ElementQuery): ElementNode => ({
      id,
      type: "container",
      classIds: [],
      props: {},
      styles: { breakpoints: {} },
      actions: {},
      children: [],
      ...(query ? { query } : {})
    });
    const rest = elementQuerySchema.parse({
      enabled: true,
      name: "r",
      source: "rest",
      rest: { values: { auth: "{{ user.accessToken }}" } }
    });
    const local = elementQuerySchema.parse({
      enabled: true,
      name: "l",
      source: "local",
      local: { kind: "expression", expression: "{{ [user.accessToken] }}" }
    });
    const tree = { ...node("root"), children: [node("a", rest), node("b", local)] };
    const filled: string[] = [];
    const rows = await collectLoopRows(
      tree,
      expressionScope(context(false)),
      async (_instance, fill) => {
        filled.push(fill("{{ user.accessToken }}"));
        return { rows: [], hasMore: false };
      },
      10,
      undefined,
      undefined,
      expressionScope(context(false), { server: true })
    );
    expect(filled).toEqual(["secret-token"]);
    expect(rows.b?.rows).toEqual([""]);
  });

  it("flags the token outside query settings unless exposed", () => {
    const auth = { ...defaultAppAuthSettings(), enabled: true };
    const used = { props: { text: "{{ user.accessToken }}" }, children: [] };
    expect(rawTokenProblem(used, auth)).toMatch(/Expose the raw access token/);
    expect(rawTokenProblem(used, { ...auth, exposeAccessToken: true })).toBeNull();
    const inQuery = { props: {}, query: { rest: { values: { a: "{{ user.accessToken }}" } } } };
    expect(rawTokenProblem(inQuery, auth)).toBeNull();
    expect(usesRawToken({ t: "{{ user.accessTokenX }}" })).toBe(false);
  });
});
