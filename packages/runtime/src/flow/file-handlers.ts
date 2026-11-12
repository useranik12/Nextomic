import { actionSlots, getAction, operandValue, toText } from "@nextomic/schema";
import { FlowError, numberParam, type ActionHandler } from "./engine";
import {
  chooseFiles,
  fileProblem,
  FileStore,
  pickedIds,
  type PickedFile,
  type UploadedFile
} from "./files";

// Pick File(s), Upload File, Clear Files, Put Data To Presigned S3 Storage and Download File
// (docs/dynamic-data-and-actions.md section 8.9). Picked files stay in the browser's FileStore; a
// flow only sees their descriptions.

export interface FileDeps {
  store: FileStore;
  /** Opens the file chooser (the editor's Test cannot: it has no click of the visitor). */
  choose: typeof chooseFiles;
  /** Sends one file to the server action `nodeId` (with its filled tag values); resolves where it was stored. */
  upload: (nodeId: string, values: string[], file: File) => Promise<UploadedFile>;
  /** Runs the saved server action `nodeId` (Download File); resolves what it answered. */
  runServer: (nodeId: string, values: string[]) => Promise<unknown>;
}

const slotValues = (type: string, ctx: Parameters<ActionHandler>[1]): string[] => {
  const def = getAction(type);
  if (!def) throw new FlowError("unknown-action", `Unknown action "${type}".`);
  return actionSlots(def, ctx.node.params).map((slot) => toText(operandValue(slot, ctx.scope)));
};

function filesOf(store: FileStore, value: unknown): { id: string; file: File }[] {
  const ids = pickedIds(value);
  if (ids.length === 0)
    throw new FlowError("no-files", "Choose the files from a Pick File(s) action.");
  return ids.map((id) => {
    const file = store.get(id);
    if (!file) throw new FlowError("file-gone", "A picked file is no longer kept in the browser.");
    return { id, file };
  });
}

export function fileHandlers(deps: FileDeps): Record<string, ActionHandler> {
  return {
    "files.pick": async (p, ctx) => {
      const multiple = toText(p.multiple) === "true";
      const accept = toText(p.accept);
      const limits = {
        accept,
        maxSizeMb: Math.max(1, numberParam(p.maxSizeMb, 10))
      };
      let chosen = await deps.choose({ multiple, accept });
      if (chosen.length === 0) return multiple ? [] : null;
      const max = multiple ? Math.max(1, numberParam(p.max, 100)) : 1;
      if (chosen.length > max) throw new FlowError("too-many", `Choose at most ${max} files.`);
      for (const file of chosen) {
        const problem = fileProblem(file, limits);
        if (problem) throw new FlowError("bad-file", problem);
      }
      chosen = chosen.slice(0, max);
      if (toText(p.mode) !== "supabase") {
        const picked = chosen.map((file) => deps.store.add(file));
        return multiple ? picked : (picked[0] ?? null);
      }
      const values = slotValues("files.pick", ctx);
      const stored: UploadedFile[] = [];
      for (const file of chosen) stored.push(await deps.upload(ctx.node.id, values, file));
      return multiple ? stored : (stored[0] ?? null);
    },
    "file.upload": async (p, ctx) => {
      const values = slotValues("file.upload", ctx);
      const stored: UploadedFile[] = [];
      for (const { file } of filesOf(deps.store, p.files))
        stored.push(await deps.upload(ctx.node.id, values, file));
      return stored;
    },
    "file.clearLocal": (p) => {
      for (const id of pickedIds(p.files)) deps.store.remove(id);
    },
    "s3.put": async (p, ctx) => {
      const url = toText(p.url);
      let target: URL;
      try {
        target = new URL(url);
      } catch {
        throw new FlowError("bad-url", "The presigned URL is not a web address.");
      }
      if (target.protocol !== "https:" && target.protocol !== "http:")
        throw new FlowError("bad-url", "The presigned URL is not a web address.");
      const file = filesOf(deps.store, p.file)[0]?.file;
      if (!file) throw new FlowError("no-files", "Choose a file from a Pick File(s) action.");
      const method = toText(p.method) === "POST" ? "POST" : "PUT";
      const contentType = toText(p.contentType) || file.type || "application/octet-stream";
      const response = await fetch(target, {
        method,
        body: file,
        headers: { "content-type": contentType },
        signal: ctx.signal
      });
      if (!response.ok)
        throw new FlowError("s3-failed", `The storage answered ${response.status}.`);
      return { status: response.status, etag: response.headers.get("etag") ?? "" };
    },
    "file.download": async (p, ctx) => {
      const answer = await deps.runServer(ctx.node.id, slotValues("file.download", ctx));
      const url =
        typeof answer === "object" && answer !== null ? (answer as { url?: unknown }).url : null;
      if (typeof url !== "string") throw new FlowError("no-url", "The file could not be found.");
      const link = document.createElement("a");
      link.href = url;
      link.download = toText(p.fileName) || "";
      link.rel = "noopener";
      link.style.display = "none";
      document.body.append(link);
      link.click();
      link.remove();
      return { url };
    }
  };
}

export type { PickedFile };
