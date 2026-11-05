/**
 * Fails if an icon id is used via <Icon name="..."> but not registered in
 * src/lib/icons/registry.ts, or registered but never used anywhere. Grep-based rather than a
 * full ESLint rule to keep Phase 0 scope small; revisit as a real lint rule if false
 * positives/negatives show up once more icons are added.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ICON_IDS } from "../apps/editor/src/lib/icons/registry";

const srcRoot = join(import.meta.dirname, "..", "apps/editor/src");
const iconUsagePattern = /<Icon\b[^>]*\bname=["']([^"']+)["']/g;

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath, files);
    } else if (/\.(tsx?|jsx?)$/.test(entry) && !entry.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

function main(): void {
  const used = new Set<string>();
  // The registry file itself and the Icon component intentionally mention every id; skip them.
  const skipFiles = new Set(["lib/icons/registry.ts", "lib/icons/Icon.tsx"]);

  for (const file of walk(srcRoot)) {
    const relPath = relative(srcRoot, file).replace(/\\/g, "/");
    if (skipFiles.has(relPath)) continue;
    const content = readFileSync(file, "utf-8");
    for (const match of content.matchAll(iconUsagePattern)) {
      used.add(match[1] as string);
    }
  }

  const registered = new Set(ICON_IDS);
  const unregistered = [...used].filter((id) => !registered.has(id));
  const unused = [...registered].filter((id) => !used.has(id));

  if (unregistered.length > 0 || unused.length > 0) {
    if (unregistered.length > 0) {
      console.error(`Icons used but not registered: ${unregistered.join(", ")}`);
    }
    if (unused.length > 0) {
      console.error(`Icons registered but never used: ${unused.join(", ")}`);
    }
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log(`Icon registry OK (${registered.size} icon(s), all used).`);
}

main();
