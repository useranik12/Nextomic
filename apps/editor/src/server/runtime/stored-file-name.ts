/** A name safe to store: no folders, no control characters, bounded, extension kept. */
export function storedFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "";
  const clean = base
    .replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .replace(/^\.+/, "")
    .trim();
  if (clean === "") return "file";
  if (clean.length <= 150) return clean;
  const dot = clean.lastIndexOf(".");
  const ext = dot > 0 ? clean.slice(dot).slice(0, 20) : "";
  return `${clean.slice(0, 150 - ext.length)}${ext}`;
}
