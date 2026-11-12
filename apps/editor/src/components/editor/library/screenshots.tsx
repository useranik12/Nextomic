"use client";

import { toCanvas } from "html-to-image";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import type { LibraryItem } from "@/server/library";

const FRAME_WIDTH = 1280;
const FRAME_HEIGHT = 800;
const OUT_WIDTH = 480;
const OUT_HEIGHT = 300;

export const screenshotUrl = (projectId: string, item: LibraryItem): string =>
  `/api/screenshots/${projectId}/${item.kind}/${item.id}?v=${encodeURIComponent(item.screenshotAt ?? "")}`;

/** The address that renders an item the way a visitor sees it (the owner preview). */
export function previewAddress(projectId: string, item: LibraryItem): string {
  return item.kind === "page"
    ? `/preview/${projectId}?path=${encodeURIComponent(item.route ?? "/")}`
    : `/preview/${projectId}?template=${encodeURIComponent(item.id)}`;
}

/** A transparent pixel used for an image that cannot be fetched, so one bad image does not stop the picture. */
const PLACEHOLDER =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Browsers reject with an Event (not an Error) when an image or font fails; say that in words. */
function reasonOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "an image or font in the page could not be loaded";
}

function loadFrame(address: string): Promise<{ frame: HTMLIFrameElement; doc: Document }> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    Object.assign(frame.style, {
      position: "fixed",
      left: "-10000px",
      top: "0",
      width: `${FRAME_WIDTH}px`,
      height: `${FRAME_HEIGHT}px`,
      border: "0",
      visibility: "hidden"
    });
    const timer = window.setTimeout(() => {
      frame.remove();
      reject(new Error("The preview took too long to load."));
    }, 15000);
    frame.onload = () => {
      window.clearTimeout(timer);
      const doc = frame.contentDocument;
      if (!doc) {
        frame.remove();
        reject(new Error("The preview could not be read."));
        return;
      }
      // Let fonts and images settle before the picture is taken.
      void doc.fonts.ready.then(() => window.setTimeout(() => resolve({ frame, doc }), 400));
    };
    frame.src = address;
    document.body.appendChild(frame);
  });
}

/**
 * Renders the preview of one item off screen, shrinks it to a small WebP and uploads it. The
 * upload replaces the item's single stored screenshot.
 */
/**
 * Images with no address, or ones that failed to load, make the drawing fail as a whole. The frame
 * is thrown away afterwards, so they are swapped for a blank pixel in place.
 */
async function neutralizeBrokenImages(doc: Document): Promise<void> {
  const swapped: Promise<void>[] = [];
  for (const img of Array.from(doc.images)) {
    const src = img.getAttribute("src")?.trim() ?? "";
    if (src === "" || (img.complete && img.naturalWidth === 0)) {
      img.removeAttribute("srcset");
      img.src = PLACEHOLDER;
      swapped.push(img.decode().catch(() => undefined));
    }
  }
  await Promise.all(swapped);
}

export async function generateScreenshot(projectId: string, item: LibraryItem): Promise<void> {
  const { frame, doc } = await loadFrame(previewAddress(projectId, item));
  try {
    await neutralizeBrokenImages(doc);
    const base = { width: FRAME_WIDTH, height: FRAME_HEIGHT, pixelRatio: 1, cacheBust: true };
    let source: HTMLCanvasElement;
    try {
      source = await toCanvas(doc.documentElement, base);
    } catch {
      // Web fonts or remote images that refuse to be copied: draw the page without them.
      try {
        source = await toCanvas(doc.documentElement, {
          ...base,
          skipFonts: true,
          imagePlaceholder: PLACEHOLDER
        });
      } catch (error) {
        throw new Error(`The page could not be drawn: ${reasonOf(error)}.`);
      }
    }
    const out = document.createElement("canvas");
    out.width = OUT_WIDTH;
    out.height = OUT_HEIGHT;
    const context = out.getContext("2d");
    if (!context) throw new Error("Canvas is not available.");
    context.drawImage(source, 0, 0, OUT_WIDTH, OUT_HEIGHT);
    const blob = await new Promise<Blob | null>((resolve) => {
      try {
        out.toBlob(resolve, "image/webp", 0.8);
      } catch {
        resolve(null);
      }
    });
    if (!blob)
      throw new Error(
        "The screenshot could not be encoded (the page holds a picture the browser would not copy)."
      );
    const response = await fetch(`/api/screenshots/${projectId}/${item.kind}/${item.id}`, {
      method: "PUT",
      body: blob,
      headers: { "Content-Type": "image/webp" }
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `The screenshot could not be saved (${response.status}${detail ? `: ${detail.slice(0, 120)}` : ""}).`
      );
    }
  } finally {
    frame.remove();
  }
}

/** Items whose screenshot is missing or older than their last edit. */
export const needsScreenshot = (item: LibraryItem): boolean =>
  item.screenshotAt === null || Date.parse(item.screenshotAt) < Date.parse(item.updatedAt);

/**
 * Makes screenshots for outdated items, one at a time, while `enabled`. Calls `onDone` after each
 * so the list can show the new picture.
 */
export function useScreenshotQueue(
  projectId: string,
  items: readonly LibraryItem[],
  enabled: boolean,
  onDone: () => void
): { busy: boolean; failed: number; reason: string | null; retry: () => void } {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(0);
  const [reason, setReason] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const tried = useRef(new Set<string>());
  const running = useRef(false);

  useEffect(() => {
    if (!enabled || running.current) return;
    const next = items.find(
      (i) => needsScreenshot(i) && !tried.current.has(`${i.id}:${i.updatedAt}`)
    );
    if (!next) {
      setBusy(false);
      return;
    }
    running.current = true;
    setBusy(true);
    tried.current.add(`${next.id}:${next.updatedAt}`);
    generateScreenshot(projectId, next)
      .then(() => setReason(null))
      .catch((error: unknown) => {
        setFailed((n) => n + 1);
        setReason(reasonOf(error));
      })
      .finally(() => {
        running.current = false;
        onDone();
      });
  }, [enabled, items, projectId, onDone, round]);

  const retry = () => {
    tried.current.clear();
    setFailed(0);
    setReason(null);
    setRound((n) => n + 1);
  };
  return { busy, failed, reason, retry };
}

/** A stored screenshot, or a quiet placeholder until one exists. */
export function Thumb({
  projectId,
  item,
  className
}: {
  projectId: string;
  item: LibraryItem;
  className: string;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [item.screenshotAt]);
  if (!item.screenshotAt || broken) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-default text-subtle`}
        role="img"
        aria-label={`No screenshot of ${item.name} yet`}
      >
        {item.kind === "page" ? (
          <Icon name="ph:file-text" width={20} height={20} />
        ) : (
          <Icon name="ph:layout" width={20} height={20} />
        )}
      </div>
    );
  }
  return (
    <img
      src={screenshotUrl(projectId, item)}
      alt={`Screenshot of ${item.name}`}
      loading="lazy"
      onError={() => setBroken(true)}
      className={`${className} object-cover object-top`}
    />
  );
}
