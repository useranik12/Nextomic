"use client";

import { Checkbox, Switch } from "@heroui/react";
import type { AppAuthSettings, ProjectSettings } from "@nextomic/schema";
import { SelectField, type SelectOption } from "@/components/ui/controls";
import { InfoTip } from "@/components/ui/info-tip";
import type { PageSummary } from "@/server/pages";
import { useEditorStore } from "./store/editor-store";

const NONE = "none";

/**
 * App Settings > Authentication: sign-in for the people who use the built app (docs/app-auth.md).
 * Every change saves at once through `change`.
 */
export function AppAuthSettingsGroup({
  pages,
  saving,
  change
}: {
  pages: PageSummary[];
  saving: boolean;
  change: (patch: Partial<ProjectSettings>) => Promise<void>;
}) {
  const auth = useEditorStore((s) => s.project.appAuth);
  const dataTypes = useEditorStore((s) => s.project.dataTypes);
  const set = (patch: Partial<AppAuthSettings>) => void change({ appAuth: { ...auth, ...patch } });

  const pageOptions = (exclude: string): SelectOption[] => [
    { value: NONE, label: "Not chosen" },
    ...pages
      .filter((p) => p.id !== exclude)
      .map((p) => ({ value: p.id, label: `${p.name} (${p.route})` }))
  ];
  const off = !auth.enabled || saving;

  return (
    <section
      aria-labelledby="app-auth-heading"
      className="flex flex-col gap-3 border-t border-divider pt-4"
    >
      <h3 id="app-auth-heading" className="text-small font-medium text-foreground">
        Authentication
      </h3>
      <div className="flex items-center gap-1.5">
        <Switch
          size="sm"
          isSelected={auth.enabled}
          isDisabled={saving}
          onValueChange={(on) => set({ enabled: on })}
        >
          <span className="text-small text-foreground">Use authentication</span>
        </Switch>
        <InfoTip
          label="Use authentication"
          text="Lets people sign in to the app. Off: no page requires sign-in and authentication actions are hidden."
        />
      </div>
      <div
        className={`flex flex-col gap-3 ${auth.enabled ? "" : "opacity-60"}`}
        aria-disabled={!auth.enabled}
      >
        <SelectField
          label="Authentication method"
          value={auth.provider}
          isDisabled={off}
          options={[
            { value: "supabase", label: "Supabase" },
            { value: "custom", label: "Custom (REST API and others)" }
          ]}
          onValueChange={(v) => set({ provider: v === "custom" ? "custom" : "supabase" })}
        />
        {auth.provider === "custom" ? (
          <SelectField
            label="User data type"
            value={auth.userDataTypeId || NONE}
            isDisabled={off || dataTypes.length === 0}
            description={
              dataTypes.length === 0
                ? "Add a data type on the Data Types page first."
                : "The app keeps the signed-in user's data in this data type."
            }
            options={[
              { value: NONE, label: "Not chosen" },
              ...dataTypes.map((d) => ({ value: d.id, label: d.name }))
            ]}
            onValueChange={(v) => set({ userDataTypeId: v === NONE ? "" : v })}
          />
        ) : null}
        <Checkbox
          size="sm"
          isSelected={auth.requireByDefault}
          isDisabled={off}
          onValueChange={(on) => set({ requireByDefault: on })}
        >
          <span className="text-small">New pages require authentication</span>
        </Checkbox>
        <div className="flex items-center gap-1.5">
          <Checkbox
            size="sm"
            isSelected={auth.tokenClaims}
            isDisabled={off}
            onValueChange={(on) => set({ tokenClaims: on })}
          >
            <span className="text-small">Keep token data as dynamic data</span>
          </Checkbox>
          <InfoTip
            label="Keep token data as dynamic data"
            text="Adds one JSON tag, User > Token data (JWT): the decoded claims of the signed-in user's token. Read any claim with dot notation, for example {{user.jwt.role}} or {{user.jwt.exp}}. It follows the session and refreshes with it."
          />
        </div>
        <div className="flex flex-col gap-1">
          <Checkbox
            size="sm"
            isSelected={auth.exposeAccessToken}
            isDisabled={off}
            onValueChange={(on) => set({ exposeAccessToken: on })}
          >
            <span className="text-small">Expose the raw access token to the page</span>
          </Checkbox>
          {auth.exposeAccessToken ? (
            <p role="note" className="pl-7 text-tiny text-warning">
              Any script on the page can read {"{{user.accessToken}}"} and act as the user until it
              expires. Prefer [jwt] in API calls: the server fills it and the browser never sees the
              token. Custom code elements never get it.
            </p>
          ) : null}
        </div>
        <SelectField
          label="Login page"
          value={auth.entryPageId || NONE}
          isDisabled={off}
          description="Never requires sign-in. Signed-out visitors of protected pages are sent here; signed-in users are sent away from it."
          options={pageOptions("")}
          onValueChange={(v) => set({ entryPageId: v === NONE ? "" : v })}
        />
        <SelectField
          label="After sign-in page"
          value={auth.loggedInPageId || NONE}
          isDisabled={off}
          description="Where users go after signing in when the action flow does not navigate itself."
          options={pageOptions(auth.entryPageId)}
          onValueChange={(v) => set({ loggedInPageId: v === NONE ? "" : v })}
        />
      </div>
    </section>
  );
}
