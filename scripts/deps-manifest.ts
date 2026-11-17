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
  const before = JSON.stringify(manifest);

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

  // The timestamp only moves when the content does, so regenerating an up-to-date manifest is a
  // no-op and the CI check (`git diff --exit-code`) stays meaningful.
  const unchanged = JSON.stringify(manifest) === before;
  if (!unchanged) manifest.generatedAt = new Date().toISOString();
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  // eslint-disable-next-line no-console
  console.log(
    unchanged
      ? "builder-dependencies.json already up to date"
      : `builder-dependencies.json regenerated at ${manifest.generatedAt}`
  );
  if (pending.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`Not yet installed (later phase): ${pending.join(", ")}`);
  }
}

main();
