import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface DependencyEntry {
  name: string;
  version: string;
  purpose: string;
}

export interface BuilderDependenciesManifest {
  generatedAt: string | null;
  groups: Record<string, DependencyEntry[]>;
}

/** Settings > Dependencies read-only view reads this (see docs/dependencies.md, "builder-dependencies.json GENERATED, READ-ONLY"). */
export function getBuilderDependencies(): BuilderDependenciesManifest {
  // apps/editor is the Next.js process cwd; the manifest lives at the repo root.
  const path = join(process.cwd(), "../../builder-dependencies.json");
  return JSON.parse(readFileSync(path, "utf-8"));
}
