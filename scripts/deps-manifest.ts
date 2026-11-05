import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { findPackageJson } from "./lib/resolve-package";

interface DependencyEntry {
  name: string;
  version: string;
  purpose: string;
}

interface Manifest {
  $comment: string;
  generatedAt: string | null;
  lockfile: string;
  readOnly: boolean;
  groups: Record<string, DependencyEntry[]>;
}

const rootDir = join(import.meta.dirname, "..");
const manifestPath = join(rootDir, "builder-dependencies.json");

function resolveInstalledVersion(name: string): string | null {
  return findPackageJson(name)?.version ?? null;
}

function main(): void {
  const manifest: Manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const pending: string[] = [];

  for (const group of Object.values(manifest.groups)) {
    for (const dep of group) {
      const version = resolveInstalledVersion(dep.name);
      if (version) {
        dep.version = version;
      } else {
        // Declared for a later phase (see docs/phases.md) and not installed yet — leave the
        // placeholder rather than failing the build over a dependency this phase doesn't need.
        dep.version = "GENERATED";
        pending.push(dep.name);
      }
    }
  }

  manifest.generatedAt = new Date().toISOString();
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  // eslint-disable-next-line no-console
  console.log(`builder-dependencies.json regenerated at ${manifest.generatedAt}`);
  if (pending.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`Not yet installed (later phase): ${pending.join(", ")}`);
  }
}

main();
