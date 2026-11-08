"use client";

import type { RestConfig, RestGroup } from "@nextomic/schema";
import { useState } from "react";
import { FormInput } from "@/components/ui/controls";
import { SwitchRow } from "@/components/ui/switch-row";
import { DraftScope } from "../draft-scope";
import { DynamicBolt } from "../right-panel/dynamic-bolt";
import { AuthBlock } from "./auth-block";
import { EditorFooter } from "./editor-footer";
import { KeyValueLines } from "./key-value-lines";
import { Tabs } from "./tabs";
import type { ApiDataModel, SecretDraft } from "./use-api-data";

const TABS = [
  { id: "header", label: "Header" },
  { id: "auth", label: "Authentication" },
  { id: "advanced", label: "Advanced Settings" }
] as const;
type Tab = (typeof TABS)[number]["id"];

/** "Define API Group": name, base URL, shared headers, shared authentication, Include credentials. */
export function GroupEditor({
  model,
  saved,
  config,
  isNew
}: {
  model: ApiDataModel;
  saved: RestGroup;
  config: RestConfig;
  isNew: boolean;
}) {
  const [draft, setDraft] = useState(saved);
  const [secrets, setSecrets] = useState<SecretDraft>({});
  const [tab, setTab] = useState<Tab>("header");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typedSecret = Object.values(secrets).some((v) => v !== "" && v !== undefined);
  const dirty = isNew || typedSecret || JSON.stringify(draft) !== JSON.stringify(saved);
  const calls = config.calls.filter((c) => c.groupId === saved.id).length;

  async function save(): Promise<boolean> {
    setSaving(true);
    setError(null);
    const result = await model.saveGroup(draft, secrets);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return false;
    }
    setSecrets({});
    return true;
  }
  const discard = () => {
    setDraft(saved);
    setSecrets({});
    setError(null);
    if (isNew) model.select(null);
  };

  return (
    <DraftScope
      label="API Group"
      dirty={dirty}
      onSave={save}
      onDiscard={discard}
      className="flex flex-col gap-6"
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Define API Group</h1>
        <p className="text-small text-default-500">
          Calls in a group share its base URL, headers, authentication and advanced settings.
        </p>
      </header>
      <section
        aria-label="Group"
        className="flex flex-col gap-4 rounded-large border border-default-200 p-5"
      >
        <h2 className="text-small font-medium text-foreground">Group</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput
            compact
            label="Group Name"
            value={draft.name}
            onValueChange={(name) => setDraft({ ...draft, name })}
          />
          <div className="flex items-end gap-1.5">
            <FormInput
              compact
              label="Base URL"
              placeholder="https://api.example.com/v1"
              value={draft.baseUrl}
              onValueChange={(baseUrl) => setDraft({ ...draft, baseUrl })}
            />
            <div className="pb-1">
              <DynamicBolt
                label="Base URL"
                onInsert={(t) => setDraft({ ...draft, baseUrl: `${draft.baseUrl}{{${t}}}` })}
              />
            </div>
          </div>
        </div>
      </section>
      <Tabs label="Group settings" variant="underline" tabs={TABS} value={tab} onChange={setTab} />
      {tab === "header" ? (
        <KeyValueLines
          title="Headers for every call"
          kind="header"
          items={draft.headers}
          onChange={(headers) => setDraft({ ...draft, headers })}
          addPlaceholder="Add header as key:value"
          addLabel="Add Header"
        />
      ) : tab === "auth" ? (
        <AuthBlock
          ownerId={draft.id}
          auth={draft.auth}
          onChange={(auth) => setDraft({ ...draft, auth })}
          masks={model.data?.secrets ?? {}}
          secrets={secrets}
          onSecretsChange={setSecrets}
        />
      ) : (
        <SwitchRow
          label="Include credentials"
          tip="Sends cookies, authorization headers and TLS client certificates of the app's visitor with every call of this group (built apps)."
          selected={draft.includeCredentials}
          onChange={(includeCredentials) => setDraft({ ...draft, includeCredentials })}
        />
      )}
      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
      <EditorFooter
        deleteLabel="Delete Group"
        saveLabel="Save Group"
        confirmTitle={`Delete ${saved.name}?`}
        confirmText={
          calls > 0
            ? `Its ${calls} call${calls === 1 ? "" : "s"} stay as ungrouped calls with the group's URL, headers and authentication copied in.`
            : "The group is removed."
        }
        canDelete={!isNew}
        dirty={dirty}
        saving={saving}
        onDelete={() => void model.deleteGroup(saved.id).then((r) => setError(r.error))}
        onCancel={discard}
        onSave={() => void save()}
      />
    </DraftScope>
  );
}
