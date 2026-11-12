import { describe, expect, it } from "vitest";
import {
  clearSessionCookie,
  cookiesOf,
  dynamicUser,
  readPending,
  readSession,
  safePath,
  sessionCookie,
  sessionCookieName,
  tokenClaims,
  verifierCookie,
  verifierPath
} from "./auth-session";
import { callbackUrl, publicUser, siteHref, siteOrigin } from "./auth-action";

const session = { accessToken: "a.b.c", refreshToken: "refresh-token", expiresAt: 2_000_000_000 };
const asRequest = (setCookie: string) => new Headers({ cookie: setCookie.split(";")[0] ?? "" });

describe("session cookie", () => {
  it("is httpOnly, SameSite=Lax, Secure on https, and reads back", () => {
    const line = sessionCookie("live", "p1", session, true);
    expect(line).toContain("HttpOnly");
    expect(line).toContain("SameSite=Lax");
    expect(line).toContain("Secure");
    expect(line).toContain("Path=/;");
    expect(line.startsWith(`${sessionCookieName("live", "p1")}=`)).toBe(true);
    expect(readSession("live", "p1", asRequest(line))).toEqual(session);
  });

  it("is not Secure on plain http and keeps live and preview apart", () => {
    const line = sessionCookie("preview", "p1", session, false);
    expect(line).not.toContain("Secure");
    expect(readSession("preview", "p1", asRequest(line))).toEqual(session);
    expect(readSession("live", "p1", asRequest(line))).toBeNull();
    expect(readSession("preview", "other", asRequest(line))).toBeNull();
  });

  it("refuses a session too large for a cookie", () => {
    expect(() =>
      sessionCookie("live", "p1", { ...session, accessToken: "x".repeat(5000) }, false)
    ).toThrow(/too large/);
  });

  it("clears with Max-Age=0", () => {
    expect(clearSessionCookie("live", "p1", false)).toContain("Max-Age=0");
  });

  it("ignores a tampered or foreign cookie value", () => {
    const name = sessionCookieName("live", "p1");
    expect(
      readSession("live", "p1", new Headers({ cookie: `${name}=not-base64-json` }))
    ).toBeNull();
    const partial = Buffer.from(JSON.stringify({ a: "x" })).toString("base64url");
    expect(readSession("live", "p1", new Headers({ cookie: `${name}=${partial}` }))).toBeNull();
  });

  it("parses the cookie header", () => {
    expect(cookiesOf(new Headers({ cookie: "a=1; b=2=3; bad" }))).toEqual({ a: "1", b: "2=3" });
  });
});

describe("pending sign-in cookie", () => {
  it("is scoped to the auth routes and read from either site", () => {
    const line = verifierCookie(
      "preview",
      "p1",
      { verifier: "v", next: "/x", mode: "preview" },
      false
    );
    expect(line).toContain(`Path=${verifierPath("p1")}`);
    expect(line).toContain("Max-Age=600");
    expect(line).toContain("HttpOnly");
    expect(readPending("p1", asRequest(line))).toEqual({
      verifier: "v",
      next: "/x",
      mode: "preview"
    });
    expect(readPending("p2", asRequest(line))).toBeNull();
  });

  it("drops an unsafe next path when it is read back", () => {
    const line = verifierCookie(
      "live",
      "p1",
      { verifier: "v", next: "//evil.test", mode: "live" },
      false
    );
    expect(readPending("p1", asRequest(line))?.next).toBe("");
  });
});

describe("safePath", () => {
  it("allows only paths on this site", () => {
    expect(safePath("/account?tab=1")).toBe("/account?tab=1");
    for (const bad of [
      "https://evil.test",
      "//evil.test",
      "/" + String.fromCharCode(92) + "evil.test",
      "javascript:alert(1)",
      "account",
      "/a\nb",
      "",
      undefined,
      null,
      `/${"x".repeat(2100)}`
    ])
      expect(safePath(bad as string | undefined)).toBe("");
  });
});

describe("user for the page", () => {
  const visitor = {
    accessToken: `h.${Buffer.from(JSON.stringify({ sub: "u1", role: "authenticated" })).toString("base64url")}.s`,
    user: {
      id: "u1",
      email: "a@b.co",
      phone: "",
      emailVerified: true,
      name: "Ann",
      role: "member",
      metadata: {}
    }
  };

  it("is null while signed out or with authentication off", () => {
    expect(dynamicUser(null, { enabled: true, tokenClaims: false })).toBeNull();
    expect(dynamicUser(visitor, { enabled: false, tokenClaims: false })).toBeNull();
  });

  it("fills the user tags and claims only when the project keeps them", () => {
    expect(dynamicUser(visitor, { enabled: true, tokenClaims: false })).toMatchObject({
      id: "u1",
      email: "a@b.co",
      jwt: {}
    });
    expect(dynamicUser(visitor, { enabled: true, tokenClaims: true })?.jwt).toMatchObject({
      sub: "u1"
    });
    expect(tokenClaims("not-a-jwt")).toEqual({});
  });
});

describe("auth action helpers", () => {
  it("never puts tokens in the page's user", () => {
    const user = publicUser({
      id: "1",
      email: "e",
      phone: "",
      emailVerified: false,
      name: "",
      role: "",
      metadata: { a: 1 }
    });
    expect(Object.keys(user ?? {}).sort()).toEqual(
      ["email", "emailVerified", "id", "metadata", "name", "phone", "role"].sort()
    );
  });

  it("builds the callback from the visitor-facing host", () => {
    const headers = new Headers({ "x-forwarded-proto": "https", "x-forwarded-host": "app.test" });
    expect(siteOrigin(headers)).toBe("https://app.test");
    expect(callbackUrl(headers, "p1")).toBe("https://app.test/api/site/p1/auth/callback");
  });

  it("builds same-site redirect addresses for live and preview", () => {
    expect(siteHref("live", "p1", "/")).toBe("/site/p1");
    expect(siteHref("live", "p1", "/account?x=1")).toBe("/site/p1/account?x=1");
    expect(siteHref("preview", "p1", "/account?x=1")).toBe("/preview/p1?x=1&path=%2Faccount");
    expect(siteHref("live", "p1", "//evil.test")).toBe("/site/p1");
  });
});
