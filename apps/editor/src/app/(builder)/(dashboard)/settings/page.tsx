import { getDb, userPreferences } from "@nextomic/db";
import { eq } from "drizzle-orm";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { DependenciesTable } from "@/components/settings/dependencies-table";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { EmailSettings } from "@/components/settings/smtp/email-settings";
import { canManageWorkspace, requireWorkspaceMembership } from "@/lib/permissions";
import { EMAIL_KINDS, EMAIL_KIND_LABELS, TEMPLATE_VARIABLES } from "@/server/mail/templates";
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
  const membership = await requireWorkspaceMembership(sessionData.user.id);
  const templates = EMAIL_KINDS.map((kind) => ({
    kind,
    label: EMAIL_KIND_LABELS[kind],
    variables: TEMPLATE_VARIABLES[kind]
  }));

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
        <h2 className="text-xl font-semibold text-foreground">Appearance</h2>
        <AppearanceSettings initialColorMode={preference?.colorMode ?? "dark"} />
      </section>

      {canManageWorkspace(membership.role) ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-foreground">Email</h2>
          <EmailSettings adminEmail={sessionData.user.email} templates={templates} />
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-foreground">Dependencies</h2>
        <DependenciesTable manifest={manifest} />
      </section>
    </div>
  );
}
