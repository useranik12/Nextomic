import {
  appendQuery,
  authPlacement,
  BODY_METHODS,
  fillBrackets,
  fillJsonBody,
  requestBaseUrl,
  requestHeaders,
  requestValues,
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

function applyAuth(
  auth: RestAuth,
  ownerId: string,
  secrets: Record<string, string>,
  headers: Record<string, string>,
  url: URL
): string[] {
  const placed = authPlacement(
    auth,
    (field) => secrets[`${ownerId}.${field}`] ?? "",
    (text) => Buffer.from(text).toString("base64")
  );
  if (!placed) return [];
  if (placed.in === "query") url.searchParams.set(placed.name, placed.value);
  else headers[placed.name] = placed.value;
  return placed.secrets;
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
  const values = requestValues(call, group, input.values, input.builtIns);
  const raw = requestBaseUrl(call, group, values);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConnectorError("invalid_request", `"${raw.slice(0, 200)}" is not a full URL.`);
  }
  // Query parameters add to any query string typed in the URL; URLSearchParams encodes them.
  appendQuery(url, call, values);

  const headers = requestHeaders(call, group, values);
  const owner = group ?? call;
  const secretValues = applyAuth(owner.auth, owner.id, input.secrets, headers, url);
  if (input.builtIns.jwt) secretValues.push(input.builtIns.jwt);

  let body: string | Buffer | undefined;
  if (BODY_METHODS.has(call.method)) {
    const fieldValues = () =>
      call.fields.map((f) => ({ key: f.key, value: fillBrackets(f.value, values) }));
    if (call.bodyType === "json" && call.body.trim()) body = fillJsonBody(call.body, values);
    else if (call.bodyType === "text") body = fillBrackets(call.body, values);
    else if (call.bodyType === "form")
      body = new URLSearchParams(
        fieldValues().map((f): [string, string] => [f.key, f.value])
      ).toString();
    else if (call.bodyType === "multipart") {
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
