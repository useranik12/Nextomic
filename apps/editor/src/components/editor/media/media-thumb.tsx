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

export function MediaThumb({
  asset,
  className = "",
  fit = "cover"
}: {
  asset: MediaAsset;
  className?: string;
  fit?: "cover" | "contain";
}) {
  const fitClass = fit === "cover" ? "object-cover" : "object-contain";
  return (
    <div className={`flex items-center justify-center overflow-hidden bg-default/40 ${className}`}>
      {asset.kind === "image" || asset.kind === "svg" ? (
        <img
          src={mediaSrc(asset)}
          alt={asset.alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          className={`h-full w-full ${asset.kind === "svg" ? "object-contain p-3" : fitClass}`}
        />
      ) : asset.kind === "video" ? (
        <video
          src={`${mediaSrc(asset)}#t=0.1`}
          preload="metadata"
          muted
          playsInline
          aria-label={mediaLabel(asset)}
          className={`h-full w-full ${fitClass}`}
        />
      ) : (
        <KindIcon kind={asset.kind} />
      )}
    </div>
  );
}
