import {
  BODY_METHODS,
  callVariables,
  fillBrackets,
  joinUrl,
  variableValue,
  type RestAuth,
  type RestCall,
  type RestGroup
} from "./rest";

// The parts of an API call's HTTP request that need no secrets or network: values, URL with query
// parameters, and headers. The server (`buildRequest`) and the builder's live preview share them,
// so the preview shows exactly what is sent.

/** Shown instead of a secret value. */
export const SECRET_MASK = "••••";

/** Variable values by name (passed, else default, typed) plus the server-filled ones. */
export function requestValues(
  call: RestCall,
  group: RestGroup | null,
  passed: Record<string, unknown>,
  builtIns: { jwt: string; user_ip: string }
): Record<string, unknown> {
  const values: Record<string, unknown> = { ...builtIns };
  for (const variable of callVariables(call, group))
    values[variable.name] = variableValue(variable, passed[variable.name]);
  return values;
}

/** The base URL and endpoint joined and filled (percent-encoded values), before query parameters. */
export const requestBaseUrl = (
  call: RestCall,
  group: RestGroup | null,
  values: Record<string, unknown>
): string =>
  group
    ? joinUrl(fillBrackets(group.baseUrl, values, true), fillBrackets(call.url, values, true))
    : fillBrackets(call.url, values, true);

/** Adds the Query tab's parameters to a URL, after any query string typed in it. */
export function appendQuery(url: URL, call: RestCall, values: Record<string, unknown>): void {
  for (const q of call.query)
    url.searchParams.append(fillBrackets(q.key, values), fillBrackets(q.value, values));
}

const hasHeader = (headers: Record<string, string>, name: string) =>
  Object.keys(headers).some((k) => k.toLowerCase() === name.toLowerCase());

/**
 * Group headers, then the call's (lowercased, filled), then the body's content type. Multipart
 * gets its boundary when the body is built.
 */
export function requestHeaders(
  call: RestCall,
  group: RestGroup | null,
  values: Record<string, unknown>
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const h of [...(group?.headers ?? []), ...call.headers])
    headers[h.key.toLowerCase()] = fillBrackets(h.value, values).replace(/[\r\n]/g, " ");
  if (!BODY_METHODS.has(call.method)) return headers;
  if (call.bodyType === "json" && call.body.trim() && !hasHeader(headers, "content-type"))
    headers["content-type"] = "application/json";
  else if (call.bodyType === "text" && !hasHeader(headers, "content-type"))
    headers["content-type"] = "text/plain; charset=utf-8";
  else if (call.bodyType === "form") headers["content-type"] = "application/x-www-form-urlencoded";
  else if (call.bodyType === "multipart") headers["content-type"] = "multipart/form-data";
  return headers;
}

/**
 * Where an auth block puts its value (header or query parameter), with `value` giving the secret
 * of a field ("" when none). Null when nothing is sent.
 */
export function authPlacement(
  auth: RestAuth,
  value: (field: string) => string,
  encodeBasic: (text: string) => string
): { in: "header" | "query"; name: string; value: string; secrets: string[] } | null {
  if (auth.type === "bearer") {
    const token = value("token");
    return token
      ? { in: "header", name: "authorization", value: `Bearer ${token}`, secrets: [token] }
      : null;
  }
  if (auth.type === "basic") {
    const password = value("password");
    const encoded = encodeBasic(`${auth.username}:${password}`);
    return {
      in: "header",
      name: "authorization",
      value: `Basic ${encoded}`,
      secrets: [encoded, ...(password ? [password] : [])]
    };
  }
  if (auth.type === "apiKey" && auth.apiKeyName) {
    const key = value("apiKey");
    if (!key) return null;
    return auth.apiKeyIn === "query"
      ? { in: "query", name: auth.apiKeyName, value: key, secrets: [key] }
      : { in: "header", name: auth.apiKeyName.toLowerCase(), value: key, secrets: [key] };
  }
  return null;
}

/**
 * The URL and headers a call will send, for the builder's preview: secrets (saved or typed auth
 * values, the jwt sample) show as ••••. `hasSecret` says whether an auth field has a value.
 */
export function previewRequest(input: {
  call: RestCall;
  group: RestGroup | null;
  values: Record<string, unknown>;
  builtIns: { jwt: string; user_ip: string };
  hasSecret: (ownerId: string, field: string) => boolean;
}): { url: string; headers: Record<string, string> } {
  const { call, group } = input;
  const values = requestValues(call, group, input.values, input.builtIns);
  const headers = requestHeaders(call, group, values);
  const owner = group ?? call;
  const auth = authPlacement(
    owner.auth,
    (field) => (input.hasSecret(owner.id, field) ? SECRET_MASK : ""),
    () => SECRET_MASK
  );
  if (auth?.in === "header") headers[auth.name] = auth.value;
  const raw = requestBaseUrl(call, group, values);
  let url: string;
  try {
    const parsed = new URL(raw);
    appendQuery(parsed, call, values);
    if (auth?.in === "query") parsed.searchParams.set(auth.name, auth.value);
    url = parsed.toString().split(encodeURIComponent(SECRET_MASK)).join(SECRET_MASK);
  } catch {
    // Not a full URL yet (still being typed): show what there is.
    const query = call.query.map(
      (q) =>
        `${encodeURIComponent(fillBrackets(q.key, values))}=${encodeURIComponent(fillBrackets(q.value, values))}`
    );
    url = query.length ? `${raw}${raw.includes("?") ? "&" : "?"}${query.join("&")}` : raw;
  }
  const jwt = input.builtIns.jwt;
  const mask = (text: string) => (jwt.length >= 4 ? text.split(jwt).join(SECRET_MASK) : text);
  return {
    url: mask(url),
    headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, mask(v)]))
  };
}
