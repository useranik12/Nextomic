import { getDb, users } from "@nextomic/db";
import { eq, sql } from "drizzle-orm";
import { cache } from "react";
import type { JwtPayload } from "@supabase/supabase-js";
import { createSupabaseFromHeaders, createSupabaseServer } from "./supabase/server";

export interface BuilderSession {
  user: {
    /** The Supabase auth id (public.users.user_uid). */
    id: string;
    email: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
    image: string | null;
    emailVerified: boolean;
    createdAt: string;
    twoFactorEnabled: boolean;
  };
}

/** The display name: first and last name, or the part of the email before the @. */
export function displayName(
  firstName: string | null,
  lastName: string | null,
  email: string
): string {
  return [firstName, lastName].filter(Boolean).join(" ") || email.split("@")[0] || email;
}

type AccountFacts = {
  verified_factor: boolean;
  email_verified: boolean;
  created_at: string;
};

/** Facts only Auth knows: a verified authenticator app, a confirmed email, when the account began. */
async function accountFacts(userUid: string): Promise<AccountFacts> {
  const result = await getDb().execute<AccountFacts>(sql`
    select
      exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified') as verified_factor,
      u.email_confirmed_at is not null as email_verified,
      u.created_at::text as created_at
    from auth.users u where u.id = ${userUid}::uuid`);
  return (
    result.rows[0] ?? {
      verified_factor: false,
      email_verified: false,
      created_at: new Date().toISOString()
    }
  );
}

/** Number of passkeys the account has registered. */
export async function passkeyCount(userUid: string): Promise<number> {
  const result = await getDb().execute<{ n: number }>(
    sql`select count(*)::int as n from auth.webauthn_credentials where user_id = ${userUid}::uuid`
  );
  return result.rows[0]?.n ?? 0;
}

/**
 * The signed-in person, or null. The token is verified (never trusted from the cookie alone). An
 * account with two-step sign-in is signed in only once the second step passed (aal2): until then
 * it can reach nothing but the code page. Cached for the rest of the request.
 */
export const getServerSession = cache(async (): Promise<BuilderSession | null> => {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  return sessionFromClaims(data.claims);
});

/** The signed-in person of a request that carries its cookies in headers (Pages Router API routes). */
export async function getSessionFromHeaders(headers: Headers): Promise<BuilderSession | null> {
  const { data, error } = await createSupabaseFromHeaders(headers).auth.getClaims();
  if (error || !data) return null;
  return sessionFromClaims(data.claims);
}

async function sessionFromClaims(claims: JwtPayload): Promise<BuilderSession | null> {
  if (typeof claims.sub !== "string") return null;
  const sub = claims.sub;
  const facts = await accountFacts(sub);
  const viaPasskey =
    Array.isArray(claims.amr) &&
    claims.amr.some((m) => (m as { method?: string }).method === "passkey");
  if (claims.aal !== "aal2" && !viaPasskey && facts.verified_factor) return null;
  const email = typeof claims.email === "string" ? claims.email : "";

  const db = getDb();
  const profile = async () =>
    (
      await db
        .select({ firstName: users.firstName, lastName: users.lastName, image: users.userImage })
        .from(users)
        .where(eq(users.userUid, sub))
        .limit(1)
    )[0];
  let row = await profile();
  if (!row) {
    // The sign-up trigger did not run for this account (it was made before the trigger existed).
    await db.insert(users).values({ userUid: sub, email }).onConflictDoNothing();
    row = await profile();
  }
  return {
    user: {
      id: sub,
      email,
      name: displayName(row?.firstName ?? null, row?.lastName ?? null, email),
      firstName: row?.firstName ?? null,
      lastName: row?.lastName ?? null,
      image: row?.image ?? null,
      emailVerified: facts.email_verified,
      createdAt: facts.created_at,
      twoFactorEnabled: facts.verified_factor
    }
  };
}

/** The signed-in person after the password step, even before the second step (the code page). */
export async function getPartialSession(): Promise<{ id: string; email: string } | null> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data || typeof data.claims.sub !== "string") return null;
  return {
    id: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : ""
  };
}
