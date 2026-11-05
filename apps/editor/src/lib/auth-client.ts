import { createAuthClient } from "better-auth/react";

export const authClient: ReturnType<typeof createAuthClient> = createAuthClient();
export const { signIn, signOut, signUp, useSession } = authClient;
