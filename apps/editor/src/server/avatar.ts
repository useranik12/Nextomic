import { randomBytes } from "node:crypto";
import { getDb, user } from "@nextomic/db";
import { eq } from "drizzle-orm";
import { getStorageAdapter } from "@/lib/storage";

// Builder user avatars. Files live in storage under `avatars/<userId>/<random>.<ext>` and are
// served by app/avatars/[userId]/[file]; the user's row keeps the link in `image`.

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export type AvatarFormat = "png" | "jpg" | "webp" | "gif";

export const AVATAR_MIME: Record<AvatarFormat, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif"
};

/** Avatar file names this module writes, and the only ones the route serves. */
export const AVATAR_FILE = /^[a-f0-9]{24}\.(png|jpg|webp|gif)$/;
export const USER_SEGMENT = /^[A-Za-z0-9_-]{1,100}$/;

export class AvatarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AvatarError";
  }
}

const startsWith = (data: Uint8Array, bytes: number[], at = 0) =>
  bytes.every((b, i) => data[at + i] === b);

/** The image format read from the file's own bytes; the declared type is never trusted. SVG is refused. */
export function sniffAvatarFormat(data: Uint8Array): AvatarFormat | null {
  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(data, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(data, [0x47, 0x49, 0x46, 0x38])) return "gif";
  if (startsWith(data, [0x52, 0x49, 0x46, 0x46]) && startsWith(data, [0x57, 0x45, 0x42, 0x50], 8))
    return "webp";
  return null;
}

const ownKey = (userId: string, image: string | null) => {
  const prefix = `/avatars/${userId}/`;
  if (!image?.startsWith(prefix)) return null;
  const file = image.slice(prefix.length);
  return AVATAR_FILE.test(file) ? `avatars/${userId}/${file}` : null;
};

async function currentImage(userId: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ image: user.image })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return row?.image ?? null;
}

async function setImage(userId: string, image: string | null) {
  await getDb().update(user).set({ image, updatedAt: new Date() }).where(eq(user.id, userId));
}

async function deleteQuietly(key: string | null) {
  if (!key) return;
  try {
    await getStorageAdapter().delete(key);
  } catch {
    // The row no longer points at the old file; a leftover file is harmless.
  }
}

/** Stores a new avatar for the user and returns its link. The previous file is removed. */
export async function saveAvatar(userId: string, file: File): Promise<string> {
  if (!USER_SEGMENT.test(userId)) throw new AvatarError("Invalid user.");
  if (file.size === 0) throw new AvatarError("Choose an image.");
  if (file.size > AVATAR_MAX_BYTES) throw new AvatarError("Images can be up to 2 MB.");
  const data = new Uint8Array(await file.arrayBuffer());
  const format = sniffAvatarFormat(data);
  if (!format) throw new AvatarError("Use a PNG, JPG, WebP or GIF image.");
  const name = `${randomBytes(12).toString("hex")}.${format}`;
  await getStorageAdapter().put({
    key: `avatars/${userId}/${name}`,
    data,
    contentType: AVATAR_MIME[format]
  });
  const previous = await currentImage(userId);
  const link = `/avatars/${userId}/${name}`;
  await setImage(userId, link);
  await deleteQuietly(ownKey(userId, previous));
  return link;
}

/** Clears the user's avatar, so the first letter of their name shows instead. */
export async function removeAvatar(userId: string): Promise<void> {
  const previous = await currentImage(userId);
  await setImage(userId, null);
  await deleteQuietly(ownKey(userId, previous));
}
