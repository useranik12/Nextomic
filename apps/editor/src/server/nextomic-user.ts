import { getDb, passkey } from "@nextomic/db";
import type { NextomicUser } from "@nextomic/schema";
import { count, eq } from "drizzle-orm";
import { getUserWorkspace } from "@/lib/auth";
import { getServerSession } from "@/lib/session";

// The builder account offered to dynamic data as {{nextomic.user.*}} in the editor and preview.
// Only plain profile facts: never a session token, JWT or secret.

export async function currentNextomicUser(): Promise<NextomicUser | null> {
  const session = await getServerSession();
  return session ? nextomicUserOf(session.user) : null;
}

type SessionUser = NonNullable<Awaited<ReturnType<typeof getServerSession>>>["user"];

/** The profile facts of a signed-in builder account (API routes pass their own session). */
export async function nextomicUserOf(user: SessionUser): Promise<NextomicUser> {
  const [membership, keys] = await Promise.all([
    getUserWorkspace(user.id),
    getDb().select({ n: count() }).from(passkey).where(eq(passkey.userId, user.id))
  ]);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ?? "",
    role: membership?.role ?? "",
    emailVerified: user.emailVerified,
    twoFactorEnabled: Boolean((user as { twoFactorEnabled?: boolean | null }).twoFactorEnabled),
    passkeys: keys[0]?.n ?? 0,
    createdAt: new Date(user.createdAt).toISOString()
  };
}
