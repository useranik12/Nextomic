import { MEDIA_MAX_UPLOAD_BYTES, formatBytes, type MediaAsset } from "@nextomic/schema";

// Browser side of the upload route: one file per request with a raw body. XHR rather than fetch so
// the person sees progress on big videos.

export interface UploadHandle {
  promise: Promise<MediaAsset>;
  abort: () => void;
}

export function uploadFile(
  projectId: string,
  file: File,
  options: { folderId?: string | null; replaceId?: string; onProgress?: (fraction: number) => void }
): UploadHandle {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<MediaAsset>((resolve, reject) => {
    if (file.size === 0) return reject(new Error("This file is empty."));
    if (file.size > MEDIA_MAX_UPLOAD_BYTES)
      return reject(
        new Error(
          `This file is ${formatBytes(file.size)}. Uploads can be up to ${formatBytes(MEDIA_MAX_UPLOAD_BYTES)}.`
        )
      );
    const params = new URLSearchParams();
    if (options.folderId) params.set("folderId", options.folderId);
    if (options.replaceId) params.set("replace", options.replaceId);
    const query = params.size > 0 ? `?${params}` : "";
    xhr.open("POST", `/api/projects/${encodeURIComponent(projectId)}/media${query}`);
    xhr.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) options.onProgress?.(e.loaded / e.total);
    };
    xhr.onerror = () =>
      reject(new Error("The upload failed. Check your connection and try again."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.onload = () => {
      let body: { asset?: MediaAsset; error?: string } = {};
      try {
        body = JSON.parse(xhr.responseText) as typeof body;
      } catch {
        // Not JSON: fall through to the generic message.
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.asset) resolve(body.asset);
      else reject(new Error(body.error ?? "Could not upload the file."));
    };
    xhr.send(file);
  });
  return { promise, abort: () => xhr.abort() };
}
