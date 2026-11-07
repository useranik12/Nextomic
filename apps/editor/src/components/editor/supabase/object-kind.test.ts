import { describe, expect, it } from "vitest";
import { formatBytes, objectKind } from "./object-kind";

describe("storage object kinds", () => {
  it("uses the MIME type first, then the extension", () => {
    expect(objectKind("a.bin", "image/png")).toBe("image");
    expect(objectKind("logo.svg", null)).toBe("svg");
    expect(objectKind("x", "image/svg+xml")).toBe("svg");
    expect(objectKind("clip.MP4", null)).toBe("video");
    expect(objectKind("song.mp3", "application/octet-stream")).toBe("audio");
    expect(objectKind("doc.pdf", null)).toBe("pdf");
    expect(objectKind("notes.txt", "text/plain")).toBe("other");
    expect(objectKind("README", null)).toBe("other");
  });

  it("formats sizes", () => {
    expect(formatBytes(null)).toBe("Unknown");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(50 * 1024 * 1024)).toBe("50 MB");
  });
});
