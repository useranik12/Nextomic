"use client";

import {
  availableVariables,
  groupProblems,
  type RestConfig,
  type RestGroup
} from "@nextomic/schema";
import { useState } from "react";
import { FormInput } from "@/components/ui/controls";
import { SwitchRow } from "@/components/ui/switch-row";
import { DraftScope } from "../draft-scope";
import { AuthBlock } from "./auth-block";
import { EditorFooter } from "./editor-footer";
import { KeyValueLines } from "./key-value-lines";
import { Tabs } from "./tabs";
import type { ApiDataModel, SecretDraft } from "./use-api-data";
import { VariableFields } from "./variable-assist";
import { VariablesTab } from "./variables-tab";

const TABS = [
  { id: "header", label: "Header" },
  { id: "variables", label: "Variables" },
  { id: "auth", label: "Authentication" },
  { id: "advanced", label: "Advanced Settings" }
] as const;
type Tab = (typeof TABS)[number]["id"];

/** "Define API Group": name, base URL, shared headers, variables, authentication, credentials. */
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
  const problems = groupProblems(draft);
  const variables = availableVariables(draft.variables);

  async function save(): Promise<boolean> {
    if (problems[0]) {
      setError(problems[0]);
      return false;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await model.saveGroup(draft, secrets);
      if (result.error) {
        setError(result.error);
        return false;
      }
      if (result.saved) setDraft(result.saved);
      setSecrets({});
      return true;
    } catch {
      setError("Could not save the API group. Check your connection and try again.");
      return false;
    } finally {
      setSaving(false);
    }
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
        <p className="text-sm text-muted">
          Calls in a group share its base URL, headers, variables, authentication and advanced
          settings.
        </p>
      </header>
      <VariableFields variables={variables} className="flex flex-col gap-6">
        <section
          aria-label="Group"
          className="flex flex-col gap-4 rounded-2xl border border-border p-5"
        >
          <h2 className="text-sm font-medium text-foreground">Group</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div data-no-vars>
              <FormInput
                compact
                label="Group Name"
                value={draft.name}
                onValueChange={(name) => setDraft({ ...draft, name })}
              />
            </div>
            <FormInput
              compact
              label="Base URL"
              placeholder="https://api.example.com/[version]"
              value={draft.baseUrl}
              onValueChange={(baseUrl) => setDraft({ ...draft, baseUrl })}
              className="font-mono"
            />
          </div>
        </section>
        <Tabs
          label="Group settings"
          variant="underline"
          tabs={TABS}
          value={tab}
          onChange={setTab}
        />
        {tab === "header" ? (
          <KeyValueLines
            title="Headers for every call"
            kind="header"
            items={draft.headers}
            onChange={(headers) => setDraft({ ...draft, headers })}
            addPlaceholder="Add header as key:value"
            addLabel="Add Header"
          />
        ) : tab === "variables" ? (
          <VariablesTab
            variables={draft.variables}
            onChange={(next) => setDraft({ ...draft, variables: next })}
            description="Shared by every call in this group. Type [ in the base URL, headers, query or body of a call to use one; a call's own variable with the same name wins. jwt and user_ip are filled by the server."
          />
        ) : tab === "auth" ? (
          <div data-no-vars>
            <AuthBlock
              ownerId={draft.id}
              auth={draft.auth}
              onChange={(auth) => setDraft({ ...draft, auth })}
              masks={model.data?.secrets ?? {}}
              secrets={secrets}
              onSecretsChange={setSecrets}
            />
          </div>
        ) : (
          <SwitchRow
            label="Include credentials"
            tip="Sends cookies, authorization headers and TLS client certificates of the app's visitor with every call of this group (built apps)."
            selected={draft.includeCredentials}
            onChange={(includeCredentials) => setDraft({ ...draft, includeCredentials })}
          />
        )}
      </VariableFields>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : problems.length > 0 ? (
        <p className="text-sm text-warning">{problems[0]}</p>
      ) : null}
      <EditorFooter
        deleteLabel="Delete Group"
        saveLabel="Save Group"
        confirmTitle={`Delete ${saved.name}?`}
        confirmText={
          calls > 0
            ? `Its ${calls} call${calls === 1 ? "" : "s"} stay as ungrouped calls with the group's URL, headers, variables and authentication copied in.`
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
