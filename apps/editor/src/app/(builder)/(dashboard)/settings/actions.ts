"use server";

import { colorModeSchema } from "@nextomic/schema";
import { getDb, userPreferences } from "@nextomic/db";
import { getServerSession } from "@/lib/session";
import { z } from "zod";
import { AccountError, confirmEmailChange, requestEmailChange, updateName } from "@/server/account";
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

type Result<T> = { data: T; error: null } | { data: null; error: string };

function failure(error: unknown, fallback: string): { data: null; error: string } {
  if (error instanceof AvatarError || error instanceof AccountError)
    return { data: null, error: error.message };
  if (error instanceof z.ZodError)
    return { data: null, error: error.issues[0]?.message ?? "Invalid input." };
  return { data: null, error: fallback };
}

/**
 * Saves the profile form: `name`, and either a new image (`file`) or `removeImage=true`.
 * Nothing changes until this runs (the page keeps the picked image as a preview).
 */
export async function saveProfileAction(
  formData: FormData
): Promise<Result<{ image: string | null }>> {
  const sessionData = await getServerSession();
  if (!sessionData) return { data: null, error: "Not signed in." };
  const userId = sessionData.user.id;
  try {
    await updateName(userId, String(formData.get("name") ?? ""));
    const file = formData.get("file");
    let image = sessionData.user.image ?? null;
    if (file instanceof File && file.size > 0) image = await saveAvatar(userId, file);
    else if (formData.get("removeImage") === "true") {
      await removeAvatar(userId);
      image = null;
    }
    return { data: { image }, error: null };
  } catch (error) {
    return failure(error, "Could not save the profile.");
  }
}

export async function requestEmailChangeAction(email: string): Promise<Result<string>> {
  const sessionData = await getServerSession();
  if (!sessionData) return { data: null, error: "Not signed in." };
  try {
    return { data: await requestEmailChange(sessionData.user, email), error: null };
  } catch (error) {
    return failure(error, "Could not send the code.");
  }
}

export async function confirmEmailChangeAction(code: string): Promise<Result<string>> {
  const sessionData = await getServerSession();
  if (!sessionData) return { data: null, error: "Not signed in." };
  try {
    return { data: await confirmEmailChange(sessionData.user.id, code), error: null };
  } catch (error) {
    return failure(error, "Could not change the email.");
  }
}
