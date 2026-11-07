// File kinds for the storage preview: which player to use and the colour of the type chip.

export type ObjectKind = "image" | "svg" | "video" | "audio" | "pdf" | "other";

const EXTENSIONS: Record<Exclude<ObjectKind, "other">, readonly string[]> = {
  svg: ["svg"],
  image: ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico"],
  video: ["mp4", "webm", "ogv", "mov", "m4v"],
  audio: ["mp3", "wav", "ogg", "oga", "m4a", "aac", "flac", "opus"],
  pdf: ["pdf"]
};

export const extensionOf = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
};

/** What kind of preview a file gets, from its MIME type, else its extension. */
export function objectKind(name: string, mimeType: string | null): ObjectKind {
  const mime = (mimeType ?? "").toLowerCase();
  if (mime === "image/svg+xml") return "svg";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  const ext = extensionOf(name);
  for (const [kind, list] of Object.entries(EXTENSIONS))
    if (list.includes(ext)) return kind as ObjectKind;
  return "other";
}

/** Orange image, cyan video, lime audio, light red PDF, gray for the rest. */
export const CHIP_CLASSES: Record<ObjectKind, string> = {
  image: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  svg: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  video: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  audio: "bg-lime-500/15 text-lime-600 dark:text-lime-400",
  pdf: "bg-red-400/15 text-red-500 dark:text-red-300",
  other: "bg-default-100 text-default-600"
};

export function formatBytes(size: number | null): string {
  if (size === null) return "Unknown";
  if (size < 1024) return `${size} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = size / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}
