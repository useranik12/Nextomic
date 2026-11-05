import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

type PackageManifest = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const workspaceDirectories = ["apps", "packages"];
const root = process.cwd();

async function readManifest(path: string): Promise<PackageManifest> {
  return Bun.file(path).json() as Promise<PackageManifest>;
}

const manifestPaths = [resolve(root, "package.json")];
for (const directory of workspaceDirectories) {
  const entries = await readdir(resolve(root, directory), { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      manifestPaths.push(resolve(root, directory, entry.name, "package.json"));
    }
  }
}

const packages = await Promise.all(manifestPaths.map(readManifest));
const dependencies = Object.fromEntries(
  packages
    .flatMap((manifest) => Object.entries({ ...manifest.dependencies, ...manifest.devDependencies }))
    .sort(([left], [right]) => left.localeCompare(right))
);

await Bun.write(
  resolve(root, "builder-dependencies.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), dependencies }, null, 2)}\n`
);
