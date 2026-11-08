import { restCallSchema, restConfigSchema, type RestCall, type RestConfig } from "@nextomic/schema";
import { z } from "zod";
import { ConnectorError } from "../errors";
import { registerConnector } from "../registry";
import { safeFetch } from "../safe-fetch";
import type { Connector, ConnectorContext, ExecuteResult, Resource, TestResult } from "../types";
import { buildRequest, maskSecrets } from "./request";

// The REST connector behind the API Data page. One per project: its config holds every group and
// call, its sealed secrets the auth values. Calls run through safeFetch (SSRF rules, timeout, size
// cap). A 4xx or 5xx answer is a result, not an error: the Test tab shows it.

export type RestSecrets = Record<string, string>;

const secretsSchema = z.record(z.string().max(1000), z.string().max(20_000));

/** Shown back to the builder; never more than this much of a body. */
const MAX_BODY_CHARS = 1_000_000;

/** Response headers the Test tab may show (cookies never). */
const HIDDEN_RESPONSE_HEADERS = new Set(["set-cookie", "set-cookie2"]);

export const restExecuteSchema = z
  .object({
    /** A saved call, or the unsaved definition being tested in the builder. */
    callId: z.string().min(1).max(64).optional(),
    call: restCallSchema.optional(),
    values: z.record(z.string().max(64), z.unknown()).default({}),
    /** Builder test only: sample values for the server-filled variables. */
    builtIns: z
      .object({ jwt: z.string().max(16_384).default(""), user_ip: z.string().max(64).default("") })
      .default({}),
    /** Builder test only: auth values typed but not saved yet, keyed `<owner id>.<field>`. */
    secrets: z.record(z.string().max(200), z.string().max(20_000)).default({})
  })
  .refine((v) => v.callId !== undefined || v.call !== undefined, "Name the call to run.");

export interface RestCallResult {
  status: number;
  ok: boolean;
  latencyMs: number;
  /** The URL that was called, secrets hidden. */
  url: string;
  method: string;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  contentType: string;
  /** The body as text (cut at 1 MB) and, when it is JSON, parsed. */
  body: string;
  truncated: boolean;
  json: unknown;
}

function findCall(cfg: RestConfig, request: z.infer<typeof restExecuteSchema>): RestCall {
  if (request.call) return request.call;
  const saved = cfg.calls.find((c) => c.id === request.callId);
  if (!saved) throw new ConnectorError("not_found", "This API call does not exist.");
  return saved;
}

async function execute(
  cfg: RestConfig,
  secrets: RestSecrets,
  req: { resourceId: string; params: Record<string, unknown> },
  ctx: ConnectorContext
): Promise<ExecuteResult> {
  const parsed = restExecuteSchema.safeParse(req.params);
  if (!parsed.success)
    throw new ConnectorError(
      "invalid_request",
      parsed.error.issues[0]?.message ?? "The request is not valid."
    );
  const call = findCall(cfg, parsed.data);
  if (!call.active && !parsed.data.call)
    throw new ConnectorError("invalid_request", "This API call is turned off.");
  const group = call.groupId ? (cfg.groups.find((g) => g.id === call.groupId) ?? null) : null;
  if (call.groupId && !group)
    throw new ConnectorError("invalid_request", "Save the API group before testing its calls.");

  // Typed but unsaved auth values may only stand in for this call's or its group's own fields.
  const owner = group?.id ?? call.id;
  const overrides = Object.fromEntries(
    Object.entries(parsed.data.secrets).filter(([k, v]) => k.startsWith(`${owner}.`) && v !== "")
  );
  const built = buildRequest({
    call,
    group,
    values: parsed.data.values,
    builtIns: parsed.data.builtIns,
    secrets: { ...secrets, ...overrides }
  });
  const response = await safeFetch(built.url, {
    method: built.method,
    headers: built.headers,
    body: built.body,
    allowPrivateHosts: ctx.allowPrivateHosts,
    signal: ctx.signal
  });
  const text = response.body.toString("utf8");
  let json: unknown = null;
  if (/json/i.test(response.contentType) || /^\s*[[{]/.test(text))
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  const mask = (value: string) => maskSecrets(value, built.secretValues);
  const result: RestCallResult = {
    status: response.status,
    ok: response.status >= 200 && response.status < 300,
    latencyMs: response.latencyMs,
    url: mask(built.url),
    method: built.method,
    requestHeaders: Object.fromEntries(Object.entries(built.headers).map(([k, v]) => [k, mask(v)])),
    responseHeaders: Object.fromEntries(
      Object.entries(response.headers).filter(([k]) => !HIDDEN_RESPONSE_HEADERS.has(k))
    ),
    contentType: response.contentType,
    body: text.slice(0, MAX_BODY_CHARS),
    truncated: text.length > MAX_BODY_CHARS,
    json
  };
  return { status: response.status, data: result };
}

async function test(): Promise<TestResult> {
  return { ok: true, message: "API Data has no shared connection. Test each call.", latencyMs: 0 };
}

async function listResources(cfg: RestConfig): Promise<Resource[]> {
  return cfg.calls.map((c) => ({ id: `call:${c.id}`, kind: "call", name: c.name }));
}

export const restConnector: Connector<RestConfig, RestSecrets> = {
  type: "rest",
  configSchema: restConfigSchema as unknown as z.ZodType<RestConfig>,
  secretsSchema,
  test,
  listResources,
  execute
};

registerConnector(restConnector);
