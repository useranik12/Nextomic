import { readFile } from "node:fs/promises";
import { join, normalize, relative, resolve } from "node:path";
import { NextResponse } from "next/server";

const ALLOWED_FORMATS = new Set(["svg", "png", "webp"]);
const CONTENT_TYPES: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  webp: "image/webp"
};

// apps/editor is the Next.js process cwd; assets/ lives at the repo root, two levels above it.
const brandingsRoot = resolve(process.cwd(), "../../assets/brandings");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ format: string; filename: string }> }
) {
  const { format, filename } = await params;

  if (!ALLOWED_FORMATS.has(format)) {
    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  }

  const resolvedPath = resolve(brandingsRoot, format, normalize(filename));
  const rel = relative(join(brandingsRoot, format), resolvedPath);
  if (rel.startsWith("..") || rel.includes("..")) {
    return NextResponse.json({ error: "Invalid asset path" }, { status: 400 });
  }

  try {
    const file = await readFile(resolvedPath);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": CONTENT_TYPES[format] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
