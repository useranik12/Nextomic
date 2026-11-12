import { describe, expect, it } from "vitest";
import { storedFileName } from "./stored-file-name";

describe("storedFileName", () => {
  it("drops folders of both kinds and bad characters", () => {
    expect(storedFileName("../../etc/passwd")).toBe("passwd");
    expect(storedFileName(["C:", "x", "my photo?.png"].join(String.fromCharCode(92)))).toBe(
      "my photo_.png"
    );
  });
  it("never starts with a dot and never ends empty", () => {
    expect(storedFileName(".htaccess")).toBe("htaccess");
    expect(storedFileName("...")).toBe("file");
  });
  it("shortens long names but keeps the extension", () => {
    const name = storedFileName(`${"a".repeat(400)}.pdf`);
    expect(name.length).toBeLessThanOrEqual(150);
    expect(name.endsWith(".pdf")).toBe(true);
  });
});
