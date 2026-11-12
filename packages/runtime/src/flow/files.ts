import { fileAccepted, MAX_UPLOAD_BYTES } from "@nextomic/schema";

// Files a visitor picked with Pick File(s). The browser keeps the File objects here and hands the
// flow only a small description (`PickedFile`), so a file never travels through state, tags or
// the page's HTML. Upload File, Put Data To Presigned S3 Storage and Clear Uploaded File take that
// description back and find the file by its id.

export interface PickedFile {
  id: string;
  name: string;
  size: number;
  type: string;
}

/** A file after it was stored in a bucket. */
export interface UploadedFile {
  name: string;
  size: number;
  type: string;
  bucket: string;
  path: string;
}

export class FileStore {
  private files = new Map<string, File>();
  private count = 0;

  add(file: File): PickedFile {
    this.count += 1;
    const id = `nxf-${Date.now().toString(36)}-${this.count}`;
    this.files.set(id, file);
    return { id, name: file.name, size: file.size, type: file.type };
  }

  get(id: string): File | undefined {
    return this.files.get(id);
  }

  remove(id: string): boolean {
    return this.files.delete(id);
  }
}

/** The ids named by a Pick File(s) output: one description, a list of them, or the same as JSON text. */
export function pickedIds(value: unknown): string[] {
  let data = value;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }
  const list = Array.isArray(data) ? data : [data];
  return list.flatMap((item) =>
    typeof item === "object" && item !== null && typeof (item as { id?: unknown }).id === "string"
      ? [(item as { id: string }).id]
      : []
  );
}

/** Opens the browser's file chooser; resolves with no files when the visitor cancels. */
export function chooseFiles(options: { multiple: boolean; accept: string }): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = options.multiple;
    if (options.accept) input.accept = options.accept;
    input.style.display = "none";
    const done = (files: File[]) => {
      input.remove();
      resolve(files);
    };
    input.addEventListener("change", () => done([...(input.files ?? [])]));
    input.addEventListener("cancel", () => done([]));
    document.body.append(input);
    input.click();
  });
}

/** What is wrong with a file for these limits, or null. */
export function fileProblem(
  file: { name: string; size: number; type: string },
  limits: { accept: string; maxSizeMb: number }
): string | null {
  const max = Math.min(MAX_UPLOAD_BYTES, limits.maxSizeMb * 1024 * 1024);
  if (file.size > max)
    return `${file.name} is larger than ${Math.round((max / 1024 / 1024) * 10) / 10} MB.`;
  if (!fileAccepted(limits.accept, file.name, file.type))
    return `${file.name} is not an accepted kind of file.`;
  return null;
}
