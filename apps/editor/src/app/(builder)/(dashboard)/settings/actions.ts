"use server";

import { colorModeSchema } from "@nextomic/schema";
import { getDb, userPreferences } from "@nextomic/db";
import { getServerSession } from "@/lib/session";

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
