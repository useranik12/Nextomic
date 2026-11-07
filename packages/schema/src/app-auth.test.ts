import { describe, expect, it } from "vitest";
import {
  appAuthSettingsSchema,
  defaultAppAuthSettings,
  newPageRequiresAuth,
  pageRequiresAuth,
  tokenTags
} from "./app-auth";
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
