import { describe, expect, it } from "vitest";
import { appAuthSettingsSchema, newPageRequiresAuth, pageRequiresAuth } from "./app-auth";
import { buildDynamicContext, expressionScope } from "./dynamic-context";
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
