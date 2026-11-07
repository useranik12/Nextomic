import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import type { Readable } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import { isAddressAllowed } from "./address-guard";
import { ConnectorError } from "./errors";

// The only way connector code reaches the network. Each hop resolves the host, checks every
// address against the guard and then connects to the checked address itself, so DNS cannot
// switch to an internal address between the check and the connection.

export const DEFAULT_TIMEOUT_MS = 15_000;
export const MAX_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
export const MAX_REDIRECTS = 3;
export const DEFAULT_CONTENT_TYPES: readonly string[] = [
  "application/json",
  "+json",
  "text/",
  "application/xml",
  "+xml"
];

/** Connection-level headers a caller may never set or forward. */
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "accept-encoding"
]);
/** Credentials dropped when a redirect leaves the original origin. */
const CREDENTIAL_HEADERS = new Set(["authorization", "cookie", "apikey", "x-api-key"]);
const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9a-z-]+$/;

export interface SafeFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
  allowPrivateHosts: boolean;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** Media types the response may have: `text/` matches by prefix, `+json` by suffix. */
  allowedContentTypes?: readonly string[];
  signal?: AbortSignal;
  /** Resolves a host name to addresses. Tests swap it; production uses the system resolver. */
  resolve?: (host: string) => Promise<string[]>;
}

export interface SafeResponse {
  status: number;
  url: string;
  headers: Record<string, string>;
  contentType: string;
  body: Buffer;
  latencyMs: number;
}

const systemResolve = async (host: string) =>
  (await lookup(host, { all: true, verbatim: true })).map((entry) => entry.address);

/** Lower-cases names and drops connection-level, malformed and header-injecting entries. */
export function cleanHeaders(headers: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const name = key.trim().toLowerCase();
    if (!HEADER_NAME.test(name) || HOP_BY_HOP.has(name) || /[\r\n\0]/.test(value)) continue;
    out[name] = value;
  }
  return out;
}

export function contentTypeAllowed(contentType: string, allowed: readonly string[]): boolean {
  const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!type) return false;
  return allowed.some((rule) =>
    rule.startsWith("+")
      ? type.endsWith(rule)
      : rule.endsWith("/")
        ? type.startsWith(rule)
        : type === rule
  );
}

const bareHost = (url: URL) => url.hostname.replace(/^\[|\]$/g, "");

function checkUrl(url: URL, allowPrivateHosts: boolean) {
  if (url.protocol !== "https:" && !(url.protocol === "http:" && allowPrivateHosts))
    throw new ConnectorError("blocked_host", "Only https:// addresses are allowed.");
  if (url.username || url.password)
    throw new ConnectorError(
      "invalid_request",
      "Put credentials in the connector secrets, not in the address."
    );
}

async function resolveChecked(url: URL, options: SafeFetchOptions): Promise<string> {
  const host = bareHost(url);
  let addresses: string[] = [];
  if (isIP(host)) addresses = [host];
  else {
    try {
      addresses = await (options.resolve ?? systemResolve)(host);
    } catch {
      addresses = [];
    }
  }
  const [first] = addresses;
  if (first === undefined)
    throw new ConnectorError("network", `The host "${host}" could not be found.`);
  // Every address must pass: a host that also points inside the network is refused.
  if (!addresses.every((address) => isAddressAllowed(address, options.allowPrivateHosts)))
    throw new ConnectorError(
      "blocked_host",
      `The host "${host}" points to a private or reserved address.`
    );
  return first;
}

function decode(stream: Readable, encoding: string | undefined): Readable {
  switch ((encoding ?? "").trim().toLowerCase()) {
    case "gzip":
    case "x-gzip":
      return stream.pipe(createGunzip());
    case "deflate":
      return stream.pipe(createInflate());
    case "br":
      return stream.pipe(createBrotliDecompress());
    default:
      return stream;
  }
}

function flatHeaders(raw: http.IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || key === "set-cookie") continue;
    out[key] = Array.isArray(value) ? value.join(", ") : value;
  }
  return out;
}

interface Hop {
  url: URL;
  address: string;
  method: string;
  headers: Record<string, string>;
  body: string | Buffer | undefined;
  signal: AbortSignal;
}

function send(hop: Hop): Promise<http.IncomingMessage> {
  const secure = hop.url.protocol === "https:";
  const host = bareHost(hop.url);
  const headers: Record<string, string> = {
    "user-agent": "Nextomic-Connector/1",
    accept: "application/json, text/*;q=0.9, */*;q=0.1",
    ...hop.headers,
    host: hop.url.host,
    "accept-encoding": "gzip, deflate, br"
  };
  if (hop.body !== undefined) headers["content-length"] = String(Buffer.byteLength(hop.body));
  const request = (secure ? https : http).request({
    host: hop.address,
    port: hop.url.port || (secure ? 443 : 80),
    path: `${hop.url.pathname}${hop.url.search}`,
    method: hop.method,
    headers,
    signal: hop.signal,
    // The connection goes to the checked address; TLS still verifies the certificate by name.
    ...(secure && !isIP(host) ? { servername: host } : {})
  });
  return new Promise((resolve, reject) => {
    request.once("response", resolve);
    request.once("error", reject);
    request.end(hop.body);
  });
}

function tooLarge(maxBytes: number) {
  return new ConnectorError("too_large", `The response is larger than ${maxBytes} bytes.`);
}

async function readBody(response: http.IncomingMessage, maxBytes: number): Promise<Buffer> {
  const declared = Number(response.headers["content-length"] ?? NaN);
  if (Number.isFinite(declared) && declared > maxBytes) {
    response.destroy();
    throw tooLarge(maxBytes);
  }
  const chunks: Buffer[] = [];
  let size = 0;
  // The limit counts decoded bytes, so a small compressed bomb cannot get past it.
  for await (const chunk of decode(response, response.headers["content-encoding"])) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.length;
    if (size > maxBytes) {
      response.destroy();
      throw tooLarge(maxBytes);
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function toConnectorError(error: unknown, timedOut: boolean): ConnectorError {
  if (error instanceof ConnectorError) return error;
  if (timedOut) return new ConnectorError("timeout", "The service did not answer in time.");
  if (error instanceof Error && error.name === "AbortError")
    return new ConnectorError("timeout", "The request was cancelled.");
  const code = (error as { code?: unknown } | null)?.code;
  const text = typeof code === "string" ? code : "";
  if (text === "ECONNREFUSED")
    return new ConnectorError("network", "The service refused the connection.");
  if (text.startsWith("ERR_TLS") || text.includes("CERT"))
    return new ConnectorError("network", "The service's TLS certificate is not valid.");
  if (text.startsWith("Z_") || text.startsWith("ERR_BROTLI"))
    return new ConnectorError("upstream", "The response could not be decoded.");
  return new ConnectorError("network", "The service could not be reached.");
}

function withoutCredentials(headers: Record<string, string>) {
  return Object.fromEntries(Object.entries(headers).filter(([k]) => !CREDENTIAL_HEADERS.has(k)));
}

function parseUrl(input: string): URL {
  try {
    return new URL(input);
  } catch {
    throw new ConnectorError("invalid_request", "The address is not a valid URL.");
  }
}

/** Fetches `input` under every connector rule: guard, redirects, timeout, size and type limits. */
export async function safeFetch(input: string, options: SafeFetchOptions): Promise<SafeResponse> {
  const started = performance.now();
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 1), MAX_TIMEOUT_MS);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = Math.min(options.maxRedirects ?? MAX_REDIRECTS, MAX_REDIRECTS);
  const allowed = options.allowedContentTypes ?? DEFAULT_CONTENT_TYPES;
  let url = parseUrl(input);
  let method = (options.method ?? "GET").toUpperCase();
  let headers = cleanHeaders(options.headers);
  let body = options.body;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    for (let redirects = 0; ; redirects++) {
      checkUrl(url, options.allowPrivateHosts);
      const address = await resolveChecked(url, options);
      const response = await send({
        url,
        address,
        method,
        headers,
        body,
        signal: controller.signal
      });
      const status = response.statusCode ?? 0;
      const location = response.headers.location;
      if (status >= 300 && status < 400 && location) {
        response.resume();
        if (redirects >= maxRedirects)
          throw new ConnectorError(
            "too_many_redirects",
            `The service redirected more than ${maxRedirects} times.`
          );
        const next = new URL(location, url);
        if (next.origin !== url.origin) headers = withoutCredentials(headers);
        if (status === 303 || ((status === 301 || status === 302) && method === "POST")) {
          method = "GET";
          body = undefined;
          delete headers["content-type"];
        }
        url = next;
        continue;
      }
      const contentType = response.headers["content-type"] ?? "";
      const bytes = await readBody(response, maxBytes);
      if (bytes.length > 0 && !contentTypeAllowed(contentType, allowed))
        throw new ConnectorError(
          "bad_content_type",
          `The service answered with an unsupported type (${contentType || "none"}).`,
          { status }
        );
      return {
        status,
        url: url.toString(),
        headers: flatHeaders(response.headers),
        contentType,
        body: bytes,
        latencyMs: Math.round(performance.now() - started)
      };
    }
  } catch (error) {
    throw toConnectorError(error, timedOut);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
