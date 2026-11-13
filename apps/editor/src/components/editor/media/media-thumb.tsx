"use client";

import type { MediaAsset } from "@nextomic/schema";
import { Icon } from "@/lib/icons/Icon";

/** The public URL of an asset; the hash makes a replaced file show up at once. */
export const mediaSrc = (asset: Pick<MediaAsset, "path" | "hash">) =>
  `${asset.path}?v=${asset.hash.slice(0, 8)}`;

/** What to show for a file's own name: its title, else the name it was uploaded with. */
export const mediaLabel = (asset: Pick<MediaAsset, "title" | "originalName">) =>
  asset.title || asset.originalName;

function KindIcon({ kind }: { kind: MediaAsset["kind"] }) {
  const props = { width: 28, height: 28, className: "text-muted" };
  if (kind === "video") return <Icon name="ph:video" {...props} />;
  if (kind === "audio") return <Icon name="ph:music-notes" {...props} />;
  if (kind === "other") return <Icon name="ph:file-pdf" {...props} />;
  return <Icon name="ph:image-square" {...props} />;
}

/**
 * A file preview. Thumbnails (default) are inert; `interactive` is the details-drawer preview with
 * real controls for video and audio and an embedded viewer for PDFs.
 */
export function MediaThumb({
  asset,
  className = "",
  fit = "cover",
  interactive = false
}: {
  asset: MediaAsset;
  className?: string;
  fit?: "cover" | "contain";
  interactive?: boolean;
}) {
  const fitClass = fit === "cover" ? "object-cover" : "object-contain";
  const src = mediaSrc(asset);
  const isPdf = asset.mime === "application/pdf";
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-default/40 ${className}`}
    >
      {asset.kind === "image" || asset.kind === "svg" ? (
        <img
          src={src}
          alt={asset.alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          className={`h-full w-full ${fitClass}`}
        />
      ) : asset.kind === "video" ? (
        <>
          <video
            src={interactive ? src : `${src}#t=0.1`}
            preload="metadata"
            muted={!interactive}
            controls={interactive}
            playsInline
            aria-label={mediaLabel(asset)}
            className={`h-full w-full ${fitClass}`}
          />
          {interactive ? null : (
            <span
              aria-hidden
              className="pointer-events-none absolute flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white"
            >
              <Icon name="ph:play" width={16} height={16} />
            </span>
          )}
        </>
      ) : asset.kind === "audio" && interactive ? (
        <audio
          src={src}
          controls
          preload="metadata"
          aria-label={mediaLabel(asset)}
          className="w-4/5"
        />
      ) : isPdf && interactive ? (
        <object
          data={src}
          type="application/pdf"
          aria-label={mediaLabel(asset)}
          className="h-full w-full"
        >
          <KindIcon kind={asset.kind} />
        </object>
      ) : (
        <KindIcon kind={asset.kind} />
      )}
    </div>
  );
}
