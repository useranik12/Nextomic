import {
  emailOTPClient,
  magicLinkClient,
  passkeyClient,
  twoFactorClient
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      // Sign-in with 2FA on: finish on the code page.
      onTwoFactorRedirect() {
        window.location.href = "/two-factor";
      }
    }),
    passkeyClient(),
    magicLinkClient(),
    emailOTPClient()
  ]
});
export const { signIn, signOut, signUp, useSession } = authClient;
