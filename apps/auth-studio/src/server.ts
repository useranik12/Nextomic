import { createAuth } from "@nextomic/auth";
import { betterAuthStudio } from "better-auth-studio/express";
import express from "express";
import { readStudioEnv } from "./studio-env";

// The standalone auth service: the same Better Auth configuration as the builder (shared through
// @nextomic/auth), on the same database and secret, with Better Auth Studio as its dashboard.
// It serves only the dashboard. Better Auth's own endpoints (sign-up, sign-in) are NOT mounted
// here: people sign in to the builder, and the dashboard has its own sign-in for the allowlist.

const settings = readStudioEnv();

const auth = createAuth({
  // The builder sends mail through its queue and worker. This service has no flow that sends any
  // (the dashboard creates and edits accounts directly), so a call is a bug worth surfacing.
  sendEmail: async ({ kind }) => {
    throw new Error(`The auth service does not send mail (${kind}); the builder does.`);
  },
  requireEmailVerification: Boolean(process.env.SMTP_HOST)
});

const app = express();
// One proxy hop (Traefik): the client address used by the optional IP allowlist is then the real one.
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true });
});
app.get("/", (_req, res) => {
  res.redirect(settings.basePath);
});
app.use(express.json({ limit: "1mb" }));
app.use(
  settings.basePath,
  betterAuthStudio({
    auth,
    basePath: settings.basePath,
    metadata: { title: "Nextomic Auth", theme: "dark" },
    access: {
      // The accounts have no platform-wide role column, so the email list is the gate. Studio
      // always checks a role first; the empty role is what accounts without one carry.
      roles: [""],
      allowEmails: settings.adminEmails,
      ...(settings.allowedIps.length > 0 ? { allowIpAddresses: settings.allowedIps } : {})
    }
  })
);

app.listen(settings.port, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`auth dashboard listening on :${settings.port}${settings.basePath}`);
});
