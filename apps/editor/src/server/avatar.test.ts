import { describe, expect, it } from "vitest";
import { avatarLetter } from "@/components/ui/user-avatar";
import { AVATAR_FILE, sniffAvatarFormat } from "./avatar";

const bytes = (...values: number[]) => new Uint8Array([...values, 0, 0, 0, 0, 0, 0, 0, 0]);

describe("avatars", () => {
  it("detects formats from file bytes and refuses SVG", () => {
    expect(sniffAvatarFormat(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
    expect(sniffAvatarFormat(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpg");
    expect(sniffAvatarFormat(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe("gif");
    expect(
      sniffAvatarFormat(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))
    ).toBe("webp");
    expect(
      sniffAvatarFormat(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))
    ).toBeNull();
  });

  it("serves only generated file names", () => {
    expect(AVATAR_FILE.test("0123456789abcdef01234567.png")).toBe(true);
    expect(AVATAR_FILE.test("../secret.png")).toBe(false);
    expect(AVATAR_FILE.test("0123456789abcdef01234567.svg")).toBe(false);
  });

  it("shows the first letter of the name", () => {
    expect(avatarLetter("ana pramanik")).toBe("A");
    expect(avatarLetter("  émile")).toBe("É");
    expect(avatarLetter("")).toBe("?");
  });
});
