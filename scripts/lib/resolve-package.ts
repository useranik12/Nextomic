import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dirname, "..", "..");

// Bun's default linker here keeps each workspace's own node_modules rather than hoisting
// everything to the repo root, so a package can live under apps/editor/node_modules,
// packages/db/node_modules, or the root — check every workspace, not just one.
const SEARCH_ROOTS = [
  repoRoot,
  join(repoRoot, "apps/editor"),
  join(repoRoot, "packages/schema"),
  join(repoRoot, "packages/renderer"),
  join(repoRoot, "packages/css-framework"),
  join(repoRoot, "packages/runtime"),
  join(repoRoot, "packages/db"),
  join(repoRoot, "packages/integrations"),
  join(repoRoot, "packages/storage")
];

export function findPackageJson(name: string): { path: string; version: string } | null {
  for (const root of SEARCH_ROOTS) {
    const pkgJsonPath = join(root, "node_modules", ...name.split("/"), "package.json");
    if (existsSync(pkgJsonPath)) {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8")) as { version: string };
      return { path: pkgJsonPath, version: pkg.version };
    }
  }
  return null;
}
