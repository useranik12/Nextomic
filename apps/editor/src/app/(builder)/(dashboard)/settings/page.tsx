import { getDb, userPreferences } from "@nextomic/db";
import { eq } from "drizzle-orm";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { DependenciesTable } from "@/components/settings/dependencies-table";
import { PasskeySettings } from "@/components/settings/passkey-settings";
import { PasswordChange } from "@/components/settings/password-change";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { TwoFactorSettings } from "@/components/settings/two-factor-settings";
import { passwordPolicy } from "@/lib/auth";
import { getBuilderDependencies } from "@/lib/deps-manifest";
import { getServerSession } from "@/lib/session";

export default async function SettingsPage() {
  const sessionData = await getServerSession();
  if (!sessionData) return null; // layout already redirects unauthenticated users

  const db = getDb();
  const [preference] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, sessionData.user.id))
    .limit(1);

  const manifest = getBuilderDependencies();

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-foreground">Profile</h2>
        <ProfileSettings
          name={sessionData.user.name}
          email={sessionData.user.email}
          image={sessionData.user.image ?? null}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-foreground">Security</h2>
        <div className="flex flex-col gap-5 rounded-2xl border border-separator bg-surface/40 p-5">
          <PasswordChange email={sessionData.user.email} policy={passwordPolicy} />
          <div className="border-t border-border pt-5">
            <TwoFactorSettings enabled={Boolean(sessionData.user.twoFactorEnabled)} />
          </div>
          <div className="border-t border-border pt-5">
            <PasskeySettings />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-foreground">Appearance</h2>
        <AppearanceSettings initialColorMode={preference?.colorMode ?? "dark"} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-foreground">Dependencies</h2>
        <DependenciesTable manifest={manifest} />
      </section>
    </div>
  );
}
