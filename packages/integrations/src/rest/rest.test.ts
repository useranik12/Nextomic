import { createServer, type Server } from "node:http";
import {
  newRestCall,
  newRestGroup,
  restConfigSchema,
  restVariableSchema,
  type RestCall
} from "@nextomic/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { restConnector, type RestCallResult } from "./connector";
import { buildRequest, maskSecrets } from "./request";

const variable = (name: string, patch: object = {}) =>
  restVariableSchema.parse({ id: name, name, ...patch });

describe("rest request building", () => {
  const group = {
    ...newRestGroup("g1", "Main"),
    baseUrl: "https://api.example.com/v1/",
    headers: [{ key: "X-App", value: "nextomic" }],
    auth: { type: "bearer" as const, username: "", apiKeyName: "", apiKeyIn: "header" as const }
  };
  const call: RestCall = {
    ...newRestCall("c1", "g1", "Create"),
    method: "POST",
    url: "/users/[id]",
    headers: [{ key: "X-User", value: "[jwt]" }],
    bodyType: "json",
    body: '{"name": "[name]", "count": [count]}',
    variables: [
      variable("id"),
      variable("name"),
      variable("count", { type: "int", defaultValue: "2" })
    ]
  };

  it("joins the URL, fills values, adds group auth and headers", () => {
    const built = buildRequest({
      call,
      group,
      values: { id: "a b", name: "Ana" },
      builtIns: { jwt: "eyJ.sample", user_ip: "" },
      secrets: { "g1.token": "secret-token" }
    });
    expect(built.url).toBe("https://api.example.com/v1/users/a%20b");
    expect(built.headers).toMatchObject({
      authorization: "Bearer secret-token",
      "x-app": "nextomic",
      "x-user": "eyJ.sample",
      "content-type": "application/json"
    });
    expect(built.body).toBe('{"name": "Ana", "count": 2}');
    expect(maskSecrets(built.headers.authorization ?? "", built.secretValues)).toBe("Bearer ••••");
  });

  it("adds query parameters to a typed query string and fills group variables", () => {
    const built = buildRequest({
      call: {
        ...call,
        method: "GET",
        url: "/[version]/search?fixed=1",
        query: [
          { key: "q", value: "[term]" },
          { key: "page", value: "2" }
        ],
        variables: [variable("term")]
      },
      group: { ...group, variables: [variable("version", { defaultValue: "v2" })] },
      values: { term: "a&b" },
      builtIns: { jwt: "", user_ip: "" },
      secrets: {}
    });
    expect(built.url).toBe("https://api.example.com/v1/v2/search?fixed=1&q=a%26b&page=2");
    expect(built.body).toBeUndefined();
  });

  it("puts an API key in the query and builds form and multipart bodies", () => {
    const own: RestCall = {
      ...newRestCall("c2", null, "Upload"),
      method: "PUT",
      url: "https://x.dev/upload",
      auth: { type: "apiKey", username: "", apiKeyName: "key", apiKeyIn: "query" },
      bodyType: "multipart",
      fields: [{ key: "title", value: "[t]" }],
      variables: [variable("t")]
    };
    const built = buildRequest({
      call: own,
      group: null,
      values: { t: "Hi" },
      builtIns: { jwt: "", user_ip: "" },
      secrets: { "c2.apiKey": "k-123456" },
      boundary: "B"
    });
    expect(built.url).toBe("https://x.dev/upload?key=k-123456");
    expect(String(built.body)).toBe(
      '--B\r\nContent-Disposition: form-data; name="title"\r\n\r\nHi\r\n--B--\r\n'
    );
    const form = buildRequest({
      call: { ...own, bodyType: "form" },
      group: null,
      values: { t: "a&b" },
      builtIns: { jwt: "", user_ip: "" },
      secrets: {}
    });
    expect(form.body).toBe("title=a%26b");
  });

  it("never sends a body with GET", () => {
    const built = buildRequest({
      call: { ...call, method: "GET" },
      group,
      values: {},
      builtIns: { jwt: "", user_ip: "" },
      secrets: {}
    });
    expect(built.body).toBeUndefined();
  });
});

describe("rest connector against a local server", () => {
  let server: Server;
  let base = "";
  beforeAll(async () => {
    server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk: Buffer) => (body += chunk.toString()));
      req.on("end", () => {
        const status = req.url?.startsWith("/fail") ? 401 : 200;
        res.writeHead(status, { "content-type": "application/json", "set-cookie": "s=1" });
        res.end(
          JSON.stringify({ method: req.method, auth: req.headers.authorization ?? null, body })
        );
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  });
  afterAll(() => server.close());

  const ctx = () => ({
    projectId: "p",
    workspaceId: "w",
    allowPrivateHosts: true,
    signal: AbortSignal.timeout(5000)
  });

  it("runs a draft call, hides secrets and cookies, keeps 4xx as a result", async () => {
    const cfg = restConfigSchema.parse({
      groups: [{ id: "g1", name: "Local", baseUrl: base, auth: { type: "bearer" } }]
    });
    const draft = {
      ...newRestCall("c1", "g1", "Query"),
      method: "QUERY" as const,
      url: "/fail",
      bodyType: "text" as const,
      body: "q"
    };
    const out = await restConnector.execute(
      cfg,
      { "g1.token": "tok-secret-1" },
      { resourceId: "call:c1", params: { call: draft } },
      ctx()
    );
    const result = out.data as RestCallResult;
    expect(result.status).toBe(401);
    expect(result.ok).toBe(false);
    expect(result.json).toEqual({ method: "QUERY", auth: "Bearer tok-secret-1", body: "q" });
    expect(result.requestHeaders.authorization).toBe("Bearer ••••");
    expect(result.responseHeaders["set-cookie"]).toBeUndefined();
  });

  it("refuses a turned-off saved call and an unsaved group", async () => {
    const cfg = restConfigSchema.parse({
      calls: [{ id: "c9", name: "Off", active: false, url: `${base}/x` }]
    });
    await expect(
      restConnector.execute(cfg, {}, { resourceId: "call:c9", params: { callId: "c9" } }, ctx())
    ).rejects.toThrow("turned off");
    const orphan = newRestCall("c8", "missing", "Orphan");
    await expect(
      restConnector.execute(cfg, {}, { resourceId: "call:c8", params: { call: orphan } }, ctx())
    ).rejects.toThrow("Save the API group");
  });
});
