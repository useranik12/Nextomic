"use server";

import { colorModeSchema } from "@nextomic/schema";
import { getDb, userPreferences } from "@nextomic/db";
import { getServerSession } from "@/lib/session";
import { AvatarError, removeAvatar, saveAvatar } from "@/server/avatar";

export async function updateColorModeAction(colorMode: string): Promise<{ error: string | null }> {
  const sessionData = await getServerSession();
  if (!sessionData) return { error: "Not signed in." };

  const parsed = colorModeSchema.safeParse(colorMode);
  if (!parsed.success) return { error: "Invalid color mode." };

  const db = getDb();
  await db
    .insert(userPreferences)
    .values({ userId: sessionData.user.id, colorMode: parsed.data })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { colorMode: parsed.data }
    });

  return { error: null };
}

const AVATAR_FAILED = "Could not update the profile image.";

/** Uploads a new profile image (form field `file`) and stores its link on the user's row. */
export async function uploadAvatarAction(
  formData: FormData
): Promise<{ image: string | null; error: string | null }> {
  const sessionData = await getServerSession();
  if (!sessionData) return { image: null, error: "Not signed in." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { image: null, error: "Choose an image." };
  try {
    return { image: await saveAvatar(sessionData.user.id, file), error: null };
  } catch (error) {
    return { image: null, error: error instanceof AvatarError ? error.message : AVATAR_FAILED };
  }
}

export async function removeAvatarAction(): Promise<{ error: string | null }> {
  const sessionData = await getServerSession();
  if (!sessionData) return { error: "Not signed in." };
  try {
    await removeAvatar(sessionData.user.id);
    return { error: null };
  } catch {
    return { error: AVATAR_FAILED };
  }
}
