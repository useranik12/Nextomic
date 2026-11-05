/**
 * Extracts only the icons listed in apps/editor/src/lib/icons/registry.ts from each Iconify
 * data package (e.g. @iconify-json/ph) and writes a small, tree-shaken bundle to
 * apps/editor/src/lib/icons/bundled-icons.json. No runtime calls to Iconify's API ship in the
 * builder UI (see docs/ui-reference.md section 3, "Icons (builder UI)").
 *
 * Run via `bun run icons:build` whenever the registry changes.
 */
import { getIconData, type IconifyJSON } from "@iconify/utils";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ICON_REGISTRY } from "../apps/editor/src/lib/icons/registry";
import { findPackageJson } from "./lib/resolve-package";

const outPath = join(import.meta.dirname, "..", "apps/editor/src/lib/icons/bundled-icons.json");

function loadIconSet(prefix: string): IconifyJSON {
  const pkg = findPackageJson(`@iconify-json/${prefix}`);
  if (!pkg) {
    throw new Error(
      `Missing icon data package "@iconify-json/${prefix}" — add it to apps/editor/package.json.`
    );
  }
  const iconsJsonPath = join(dirname(pkg.path), "icons.json");
  return JSON.parse(readFileSync(iconsJsonPath, "utf-8")) as IconifyJSON;
}

function main(): void {
  const byPrefix = new Map<string, string[]>();
  for (const { id } of ICON_REGISTRY) {
    const [prefix, name] = id.split(":");
    if (!prefix || !name) throw new Error(`Invalid icon id "${id}", expected "<set>:<name>"`);
    const list = byPrefix.get(prefix) ?? [];
    list.push(name);
    byPrefix.set(prefix, list);
  }

  const bundled: Record<string, IconifyJSON> = {};

  for (const [prefix, names] of byPrefix) {
    const fullSet = loadIconSet(prefix);
    const icons: IconifyJSON["icons"] = {};
    for (const name of names) {
      const data = getIconData(fullSet, name);
      if (!data) {
        throw new Error(`Icon "${prefix}:${name}" not found in @iconify-json/${prefix}.`);
      }
      icons[name] = data;
    }
    bundled[prefix] = {
      prefix,
      icons,
      width: fullSet.width,
      height: fullSet.height
    };
  }

  writeFileSync(outPath, `${JSON.stringify(bundled, null, 2)}\n`);
  const total = Object.values(bundled).reduce((sum, set) => sum + Object.keys(set.icons).length, 0);
  // eslint-disable-next-line no-console
  console.log(`Bundled ${total} icon(s) from ${byPrefix.size} set(s) -> ${outPath}`);
}

main();
