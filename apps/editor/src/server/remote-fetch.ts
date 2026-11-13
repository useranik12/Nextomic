// The one place the builder downloads package files (fonts, icon sets). Every fetch is https only,
// restricted to a fixed host allowlist, never follows redirects, times out and has a size cap
// (docs/integrations.md SSRF rules). `what` names the source in messages ("font source").

export interface RemoteFetchOptions {
  url: string;
  hosts: ReadonlySet<string>;
  maxBytes: number;
  what: string;
  timeoutMs?: number;
  /** Builds the error to throw, so each caller keeps its own error class. */
  fail: (message: string) => Error;
}

export async function fetchHttps(options: RemoteFetchOptions): Promise<Uint8Array> {
  const { url, hosts, maxBytes, what, fail } = options;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw fail(`That address is not an allowed ${what}.`);
  }
  if (parsed.protocol !== "https:" || !hosts.has(parsed.hostname)) {
    throw fail(`That address is not an allowed ${what}.`);
  }
  let response: Response;
  try {
    response = await fetch(parsed, {
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs ?? 20_000)
    });
  } catch {
    throw fail(`Could not reach the ${what}. Try again in a moment.`);
  }
  if (!response.ok) throw fail(`The ${what} answered ${response.status}.`);
  const tooLarge = () => fail("A downloaded file is larger than the allowed size.");
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw tooLarge();
  const data = new Uint8Array(await response.arrayBuffer());
  if (data.length > maxBytes) throw tooLarge();
  return data;
}
