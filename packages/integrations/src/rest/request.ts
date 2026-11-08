import {
  BODY_METHODS,
  callVariables,
  fillBrackets,
  fillJsonBody,
  joinUrl,
  variableValue,
  type RestAuth,
  type RestCall,
  type RestGroup
} from "@nextomic/schema";
import { ConnectorError } from "../errors";

// Builds the HTTP request of an API call from its definition, its group and the values passed in.
// Pure: no network, so it is tested directly. Secrets come in as a flat map `<owner id>.<field>`.

export interface BuiltRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | Buffer | undefined;
  /** Values to hide in anything shown back (URL and request headers in the Test tab). */
  secretValues: string[];
}

export interface BuildInput {
  call: RestCall;
  group: RestGroup | null;
  /** Variable values by name; missing ones use the variable's default. */
  values: Record<string, unknown>;
  /** Server-filled values: `jwt` and `user_ip`. */
  builtIns: { jwt: string; user_ip: string };
  secrets: Record<string, string>;
  /** Multipart boundary; tests pass a fixed one. */
  boundary?: string;
}

const hasHeader = (headers: Record<string, string>, name: string) =>
  Object.keys(headers).some((k) => k.toLowerCase() === name.toLowerCase());

function applyAuth(
  auth: RestAuth,
  ownerId: string,
  secrets: Record<string, string>,
  headers: Record<string, string>,
  url: URL
): string[] {
  const secret = (field: string) => secrets[`${ownerId}.${field}`] ?? "";
  if (auth.type === "bearer") {
    const token = secret("token");
    if (token) headers.authorization = `Bearer ${token}`;
    return token ? [token] : [];
  }
  if (auth.type === "basic") {
    const password = secret("password");
    const encoded = Buffer.from(`${auth.username}:${password}`).toString("base64");
    headers.authorization = `Basic ${encoded}`;
    return [encoded, ...(password ? [password] : [])];
  }
  if (auth.type === "apiKey" && auth.apiKeyName) {
    const key = secret("apiKey");
    if (!key) return [];
    if (auth.apiKeyIn === "query") url.searchParams.set(auth.apiKeyName, key);
    else headers[auth.apiKeyName.toLowerCase()] = key;
    return [key];
  }
  return [];
}

function multipart(fields: { key: string; value: string }[], boundary: string): Buffer {
  const parts = fields.map(
    (f) =>
      `--${boundary}\r\nContent-Disposition: form-data; name="${f.key.replace(/["\r\n]/g, "_")}"\r\n\r\n${f.value}\r\n`
  );
  return Buffer.from(`${parts.join("")}--${boundary}--\r\n`, "utf8");
}

export function buildRequest(input: BuildInput): BuiltRequest {
  const { call, group } = input;
  const values: Record<string, unknown> = { ...input.builtIns };
  for (const variable of callVariables(call, group))
    values[variable.name] = variableValue(variable, input.values[variable.name]);

  const raw = group
    ? joinUrl(fillBrackets(group.baseUrl, values, true), fillBrackets(call.url, values, true))
    : fillBrackets(call.url, values, true);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConnectorError("invalid_request", `"${raw.slice(0, 200)}" is not a full URL.`);
  }
  // Query parameters add to any query string typed in the URL; URLSearchParams encodes them.
  for (const q of call.query)
    url.searchParams.append(fillBrackets(q.key, values), fillBrackets(q.value, values));

  const headers: Record<string, string> = {};
  for (const h of [...(group?.headers ?? []), ...call.headers])
    headers[h.key.toLowerCase()] = fillBrackets(h.value, values).replace(/[\r\n]/g, " ");
  const owner = group ?? call;
  const secretValues = applyAuth(owner.auth, owner.id, input.secrets, headers, url);
  if (input.builtIns.jwt) secretValues.push(input.builtIns.jwt);

  let body: string | Buffer | undefined;
  if (BODY_METHODS.has(call.method)) {
    const fieldValues = () =>
      call.fields.map((f) => ({ key: f.key, value: fillBrackets(f.value, values) }));
    if (call.bodyType === "json" && call.body.trim()) {
      body = fillJsonBody(call.body, values);
      if (!hasHeader(headers, "content-type")) headers["content-type"] = "application/json";
    } else if (call.bodyType === "text") {
      body = fillBrackets(call.body, values);
      if (!hasHeader(headers, "content-type"))
        headers["content-type"] = "text/plain; charset=utf-8";
    } else if (call.bodyType === "form") {
      body = new URLSearchParams(
        fieldValues().map((f): [string, string] => [f.key, f.value])
      ).toString();
      headers["content-type"] = "application/x-www-form-urlencoded";
    } else if (call.bodyType === "multipart") {
      const boundary = input.boundary ?? `nextomic-${crypto.randomUUID()}`;
      body = multipart(fieldValues(), boundary);
      headers["content-type"] = `multipart/form-data; boundary=${boundary}`;
    }
  }
  return { url: url.toString(), method: call.method, headers, body, secretValues };
}

/** Hides secret values in text shown back to the builder. */
export function maskSecrets(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const secret of secrets)
    if (secret.length >= 4) {
      out = out.split(secret).join("••••");
      out = out.split(encodeURIComponent(secret)).join("••••");
    }
  return out;
}
