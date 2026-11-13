import { createHash } from "node:crypto";
import {
  ICON_CATALOG,
  ICONIFY_MAX_BYTES,
  iconKeySchema,
  iconLibrarySchema,
  iconSvg,
  iconifyNames,
  iconifySetSchema,
  MEDIA_SEGMENT,
  type IconifySet,
  type IconLibrary
} from "@nextomic/schema";
import { z } from "zod";
import { getStorageAdapter } from "@/lib/storage";
import { fetchHttps } from "./remote-fetch";

// Icon libraries. Sets come from the `@iconify-json/<prefix>` npm packages through jsDelivr, the
// same allowlisted, redirect-free fetch the fonts use. The package listing carries a sha256 per
// file, so every download is checked against it before anything is stored. Nothing from a package
// is ever executed: only `icons.json` is read, and only after it parses as an Iconify set.

const HOSTS = new Set(["cdn.jsdelivr.net", "data.jsdelivr.com"]);
const DATA = "https://data.jsdelivr.com/v1/packages/npm";
const FILES = "https://cdn.jsdelivr.net/npm";
const MAX_API_BYTES = 2_000_000;
const DOWNLOAD_TIMEOUT_MS = 120_000;

export class IconError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IconError";
  }
}

const fetchBytes = (url: string, maxBytes: number, timeoutMs?: number) =>
  fetchHttps({
    url,
    hosts: HOSTS,
    maxBytes,
    what: "icon source",
    ...(timeoutMs ? { timeoutMs } : {}),
    fail: (message) => new IconError(message)
  });

async function fetchApi<T>(url: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T> {
  const data = await fetchBytes(url, MAX_API_BYTES);
  try {
    return schema.parse(JSON.parse(new TextDecoder().decode(data)));
  } catch {
    throw new IconError("The icon source sent data this builder does not understand.");
  }
}

const sha256Hex = (data: Uint8Array): string => createHash("sha256").update(data).digest("hex");
const sha256Base64 = (data: Uint8Array): string =>
  createHash("sha256").update(data).digest("base64");

export const iconSetKey = (projectId: string, key: string): string => {
  if (!MEDIA_SEGMENT.test(projectId)) throw new IconError("Invalid project.");
  return `icons/${projectId}/${iconKeySchema.parse(key)}.json`;
};

const catalogEntry = (prefix: string) => {
  const entry = ICON_CATALOG.find((c) => c.prefix === prefix);
  if (!entry) throw new IconError("That icon set is not in the catalog.");
  return entry;
};

// ---- Versions and downloads --------------------------------------------------------------------

const versionSchema = z.object({ version: z.string().regex(/^\d+\.\d+\.\d+$/) });
const listingSchema = z.object({
  files: z.array(z.object({ name: z.string(), hash: z.string(), size: z.number() }))
});

/** The newest published version of a catalog set. */
export async function latestIconVersion(prefix: string): Promise<string> {
  catalogEntry(prefix);
  const { version } = await fetchApi(
    `${DATA}/@iconify-json/${prefix}/resolved?specifier=latest`,
    versionSchema
  );
  return version;
}

interface Downloaded {
  prefix: string;
  version: string;
  data: Uint8Array;
  set: IconifySet;
}

let recent: { at: number; value: Downloaded } | null = null;
const RECENT_MS = 2 * 60 * 1000;

/** Downloads, verifies and parses one release of a catalog set. */
async function downloadSet(prefix: string, version: string): Promise<Downloaded> {
  if (recent && recent.value.prefix === prefix && recent.value.version === version) {
    if (Date.now() - recent.at < RECENT_MS) return recent.value;
  }
  const listing = await fetchApi(
    `${DATA}/@iconify-json/${prefix}@${version}?structure=flat`,
    listingSchema
  );
  const file = listing.files.find((f) => f.name === "/icons.json");
  if (!file) throw new IconError("That release has no icon data.");
  if (file.size > ICONIFY_MAX_BYTES) {
    throw new IconError(
      `This set is ${Math.round(file.size / 1e6)} MB. The limit is ${Math.round(ICONIFY_MAX_BYTES / 1e6)} MB.`
    );
  }
  const data = await fetchBytes(
    `${FILES}/@iconify-json/${prefix}@${version}/icons.json`,
    ICONIFY_MAX_BYTES,
    DOWNLOAD_TIMEOUT_MS
  );
  if (sha256Base64(data) !== file.hash) {
    throw new IconError("The downloaded icons failed the integrity check. Nothing was installed.");
  }
  let set: IconifySet;
  try {
    set = iconifySetSchema.parse(JSON.parse(new TextDecoder().decode(data)));
  } catch {
    throw new IconError("The icon data could not be read.");
  }
  if (set.prefix !== prefix) throw new IconError("The icon data belongs to another set.");
  const value = { prefix, version, data, set };
  recent = { at: Date.now(), value };
  return value;
}

// Caches are keyed by project, library and content hash. The hash comes from the caller's draft
// settings, so it must never be the only key: a made-up hash could otherwise reach another
// project's cached icons.
const nameIndex = new Map<string, string[]>();
const setCache = new Map<string, IconifySet>();
const SET_CACHE_MAX = 4;

const cacheKey = (projectId: string, library: Pick<IconLibrary, "key" | "sha256">): string =>
  `${projectId}:${library.key}:${library.sha256}`;

function remember(id: string, set: IconifySet): void {
  nameIndex.set(id, iconifyNames(set));
  setCache.delete(id);
  setCache.set(id, set);
  while (setCache.size > SET_CACHE_MAX) setCache.delete(setCache.keys().next().value as string);
  while (nameIndex.size > 100) nameIndex.delete(nameIndex.keys().next().value as string);
}

// ---- Install, update, remove -------------------------------------------------------------------

/** Downloads a catalog set (the newest release, or the given one) into project storage. */
export async function installIconSet(
  projectId: string,
  prefix: string,
  version?: string
): Promise<IconLibrary> {
  const entry = catalogEntry(prefix);
  if (entry.bytes > ICONIFY_MAX_BYTES) {
    throw new IconError(
      `${entry.name} is ${Math.round(entry.bytes / 1e6)} MB. The limit is ${Math.round(ICONIFY_MAX_BYTES / 1e6)} MB.`
    );
  }
  const key = iconSetKey(projectId, prefix);
  const release = await downloadSet(prefix, version ?? (await latestIconVersion(prefix)));
  await getStorageAdapter().put({
    key,
    data: release.data,
    contentType: "application/json"
  });
  const sha = sha256Hex(release.data);
  remember(cacheKey(projectId, { key: prefix, sha256: sha }), release.set);
  return iconLibrarySchema.parse({
    key: prefix,
    name: entry.name,
    source: "iconify",
    version: release.version,
    author: entry.author,
    license: entry.license,
    licenseUrl: entry.licenseUrl,
    requiresAttribution: entry.requiresAttribution,
    brand: entry.brand,
    mode: "svg",
    palette: entry.palette,
    animated: entry.animated,
    samples: entry.samples,
    count: Object.keys(release.set.icons).length,
    bytes: release.data.length,
    sha256: sha,
    enabled: true,
    installedAt: new Date().toISOString()
  });
}

export interface IconUpdateInfo {
  key: string;
  installed: string;
  latest: string;
  hasUpdate: boolean;
}

/** For each installed catalog set, whether a newer release exists. */
export async function checkIconUpdates(
  libraries: readonly Pick<IconLibrary, "key" | "source" | "version">[]
): Promise<IconUpdateInfo[]> {
  const sets = libraries.filter((l) => l.source === "iconify");
  const out: IconUpdateInfo[] = [];
  for (const lib of sets) {
    const latest = await latestIconVersion(lib.key);
    out.push({
      key: lib.key,
      installed: lib.version,
      latest,
      hasUpdate: compareVersions(latest, lib.version) > 0
    });
  }
  return out;
}

/** Positive when `a` is newer than `b` (plain major.minor.patch). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export interface IconUpdatePreview {
  latest: string;
  added: number;
  removed: string[];
  removedCount: number;
}

/** What an update would change: icons added, and the names that disappear. Stores nothing. */
export async function previewIconUpdate(
  projectId: string,
  library: Pick<IconLibrary, "key" | "sha256">
): Promise<IconUpdatePreview> {
  const current = await iconNames(projectId, library);
  const release = await downloadSet(library.key, await latestIconVersion(library.key));
  const next = new Set(iconifyNames(release.set));
  const old = new Set(current);
  const removed = current.filter((n) => !next.has(n));
  return {
    latest: release.version,
    added: [...next].filter((n) => !old.has(n)).length,
    removed: removed.slice(0, 100),
    removedCount: removed.length
  };
}

// ---- Reading and searching ---------------------------------------------------------------------

async function loadSet(
  projectId: string,
  library: Pick<IconLibrary, "key" | "sha256">
): Promise<IconifySet> {
  const hit = setCache.get(cacheKey(projectId, library));
  if (hit) return hit;
  const data = await getStorageAdapter().get(iconSetKey(projectId, library.key));
  if (!data) throw new IconError("The icons of this library are missing from storage.");
  let set: IconifySet;
  try {
    set = iconifySetSchema.parse(JSON.parse(new TextDecoder().decode(data)));
  } catch {
    throw new IconError("The icons of this library could not be read.");
  }
  remember(cacheKey(projectId, library), set);
  return set;
}

async function iconNames(
  projectId: string,
  library: Pick<IconLibrary, "key" | "sha256">
): Promise<string[]> {
  const id = cacheKey(projectId, library);
  const known = nameIndex.get(id);
  if (known) return known;
  await loadSet(projectId, library);
  return nameIndex.get(id) ?? [];
}

export const searchInputSchema = z.object({
  query: z.string().trim().max(60),
  /** One library key, or empty for every enabled library. */
  library: z.union([iconKeySchema, z.literal("")]),
  offset: z.number().int().min(0).max(100_000)
});
export const ICON_SEARCH_PAGE = 60;

export interface IconHit {
  library: string;
  name: string;
  svg: string;
}

/** Names matching every word of the query, whole-word and prefix matches first. */
export function matchNames(names: readonly string[], query: string): string[] {
  const words = query
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean);
  if (words.length === 0) return [...names];
  const score = (name: string): number => {
    const parts = name.split("-");
    let total = 0;
    for (const w of words) {
      if (parts.includes(w)) total += 0;
      else if (parts.some((p) => p.startsWith(w))) total += 1;
      else if (name.includes(w)) total += 2;
      else return -1;
    }
    return total;
  };
  return names
    .map((name) => ({ name, s: score(name) }))
    .filter((m) => m.s >= 0)
    .sort((a, b) => a.s - b.s || a.name.length - b.name.length || a.name.localeCompare(b.name))
    .map((m) => m.name);
}

/** One page of matching icons, rendered. The browser never receives a whole set. */
export async function searchIcons(
  projectId: string,
  libraries: readonly IconLibrary[],
  input: z.infer<typeof searchInputSchema>
): Promise<{ hits: IconHit[]; total: number }> {
  const pool = libraries.filter(
    (l) => l.enabled && l.mode === "svg" && (input.library === "" || l.key === input.library)
  );
  const matches: { library: IconLibrary; name: string }[] = [];
  for (const library of pool) {
    for (const name of matchNames(await iconNames(projectId, library), input.query)) {
      matches.push({ library, name });
    }
  }
  const page = matches.slice(input.offset, input.offset + ICON_SEARCH_PAGE);
  const hits: IconHit[] = [];
  for (const { library, name } of page) {
    const svg = iconSvg(await loadSet(projectId, library), name);
    if (svg) hits.push({ library: library.key, name, svg });
  }
  return { hits, total: matches.length };
}

/** The credits a site must show for the libraries that require attribution. */
export function attributionCredits(libraries: readonly IconLibrary[]): string[] {
  return libraries
    .filter((l) => l.requiresAttribution)
    .map(
      (l) => `${l.name} by ${l.author} (${l.license})${l.licenseUrl ? ` - ${l.licenseUrl}` : ""}`
    );
}
