// Reads a font file's weight and style so the user does not have to type them.

export interface DetectedFace {
  weight: number;
  /** Set for a variable font: the top of its weight range. */
  weightMax?: number;
  style: "normal" | "italic";
}

const SPECIFIC_WEIGHTS: [RegExp, number][] = [
  [/thin|hairline/i, 100],
  [/extra-?light|ultra-?light/i, 200],
  [/semi-?bold|demi-?bold/i, 600],
  [/extra-?bold|ultra-?bold/i, 800],
  [/black|heavy/i, 900]
];
const PLAIN_WEIGHTS: [RegExp, number][] = [
  [/light/i, 300],
  [/regular|normal|book/i, 400],
  [/medium/i, 500],
  [/bold/i, 700]
];

/** Weight and style from a file name such as `Satoshi-MediumItalic.woff2` or `Inter-700.woff2`. */
export function detectFaceFromName(fileName: string): DetectedFace {
  const name = fileName.replace(/\.[^.]+$/, "");
  const style = /italic|oblique|[-_ ]it$/i.test(name) ? "italic" : "normal";
  if (/variable|\[wght|[-_]vf\b/i.test(name)) return { weight: 100, weightMax: 900, style };
  const numeric = /(?:^|[^0-9])([1-9]00)(?![0-9])/.exec(name);
  if (numeric?.[1]) return { weight: Number(numeric[1]), style };
  // Words such as ExtraLight and SemiBold contain Light and Bold, so they are tried first.
  const hit = [...SPECIFIC_WEIGHTS, ...PLAIN_WEIGHTS].find(([re]) => re.test(name));
  return { weight: hit?.[1] ?? 400, style };
}

const u16 = (v: DataView, o: number): number => v.getUint16(o, false);
const fixed = (v: DataView, o: number): number => v.getInt32(o, false) / 65536;
const tagAt = (bytes: Uint8Array, at: number): string =>
  String.fromCharCode(...bytes.slice(at, at + 4));

/**
 * Weight and style from the tables of a TrueType or OpenType file: the variable `wght` axis when it
 * has one, otherwise the OS/2 weight class and italic bit. Returns null for woff and woff2, whose
 * tables are compressed (the file name is used for those).
 */
export function detectFaceFromBytes(bytes: Uint8Array): Partial<DetectedFace> | null {
  if (bytes.length < 12) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const head = view.getUint32(0, false);
  if (head !== 0x00010000 && tagAt(bytes, 0) !== "OTTO" && tagAt(bytes, 0) !== "true") return null;
  const count = u16(view, 4);
  const tables = new Map<string, number>();
  for (let i = 0; i < count; i += 1) {
    const at = 12 + i * 16;
    if (at + 16 > bytes.length) return null;
    tables.set(tagAt(bytes, at), view.getUint32(at + 8, false));
  }
  const out: Partial<DetectedFace> = {};
  const os2 = tables.get("OS/2");
  if (os2 !== undefined && os2 + 64 <= bytes.length) {
    const weightClass = u16(view, os2 + 4);
    if (weightClass >= 1 && weightClass <= 1000) out.weight = weightClass;
    out.style = (u16(view, os2 + 62) & 1) === 1 ? "italic" : "normal";
  }
  const fvar = tables.get("fvar");
  if (fvar !== undefined && fvar + 16 <= bytes.length) {
    const first = fvar + u16(view, fvar + 4);
    const axes = u16(view, fvar + 8);
    const size = u16(view, fvar + 10);
    for (let i = 0; i < axes; i += 1) {
      const at = first + i * size;
      if (at + 20 > bytes.length) break;
      if (tagAt(bytes, at) === "wght") {
        out.weight = Math.round(fixed(view, at + 4));
        out.weightMax = Math.round(fixed(view, at + 12));
      }
    }
  }
  return out;
}

/** Weight and style of a font file the user picked: from its bytes when they can be read, else its name. */
export async function detectFace(file: File): Promise<DetectedFace> {
  const named = detectFaceFromName(file.name);
  let read: Partial<DetectedFace> | null = null;
  try {
    read = detectFaceFromBytes(new Uint8Array(await file.arrayBuffer()));
  } catch {
    read = null;
  }
  if (!read || read.weight === undefined) return named;
  const italic = read.style === "italic" || named.style === "italic";
  return {
    weight: read.weight,
    ...(read.weightMax !== undefined && read.weightMax > read.weight
      ? { weightMax: read.weightMax }
      : {}),
    style: italic ? "italic" : "normal"
  };
}
