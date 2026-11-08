"use client";

import { callProblems, type JsonShape, type RestCall, type RestConfig } from "@nextomic/schema";
import { useState } from "react";
import { ActionButton } from "@/components/ui/controls";
import { SwitchRow } from "@/components/ui/switch-row";
import { Icon } from "@/lib/icons/Icon";
import { DraftScope } from "../draft-scope";
import { AuthBlock } from "./auth-block";
import { BodyTab } from "./body-tab";
import { CallConnection } from "./call-connection";
import { EditorFooter } from "./editor-footer";
import { KeyValueLines } from "./key-value-lines";
import { ResponseType } from "./response-type";
import { Tabs } from "./tabs";
import { TestPreview } from "./test-preview";
import type { ApiDataModel, SecretDraft } from "./use-api-data";
import { useCallTest } from "./use-call-test";
import { VariablesTab } from "./variables-tab";

const MAIN_TABS = [
  { id: "definition", label: "Call Definition" },
  { id: "test", label: "Test API" }
] as const;
type SubTab = "header" | "body" | "variables" | "auth" | "advanced";

/** "Define API Call": the definition and test tabs, with Delete, Cancel and Save. */
export function CallEditor({
  model,
  saved,
  config,
  isNew
}: {
  model: ApiDataModel;
  saved: RestCall;
  config: RestConfig;
  isNew: boolean;
}) {
  const [draft, setDraft] = useState(saved);
  const [secrets, setSecrets] = useState<SecretDraft>({});
  const [main, setMain] = useState<(typeof MAIN_TABS)[number]["id"]>("definition");
  const [sub, setSub] = useState<SubTab>("header");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const test = useCallTest(model);
  const group = config.groups.find((g) => g.id === draft.groupId) ?? null;
  const typedSecret = Object.values(secrets).some((v) => v !== "" && v !== undefined);
  const shape: JsonShape | null = test.result?.ok ? test.shape : null;
  const dirty =
    isNew || typedSecret || shape !== null || JSON.stringify(draft) !== JSON.stringify(saved);
  const problems = callProblems(draft, group);
  const subTabs = [
    { id: "header" as const, label: "Header" },
    { id: "body" as const, label: "Body" },
    { id: "variables" as const, label: "Variables" },
    ...(group ? [] : [{ id: "auth" as const, label: "Authentication" }]),
    { id: "advanced" as const, label: "Advanced Settings" }
  ];
  const shownSub = subTabs.some((t) => t.id === sub) ? sub : "header";

  async function save(): Promise<boolean> {
    if (problems[0]) {
      setError(problems[0]);
      return false;
    }
    setSaving(true);
    setError(null);
    const result = await model.saveCall(draft, secrets, shape);
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
      label="API Call"
      dirty={dirty}
      onSave={save}
      onDiscard={discard}
      className="flex flex-col gap-6"
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Define API Call</h1>
        <p className="text-small text-default-500">
          Provide the API name, authentication and other details. Save settings and go to the Test
          API tab to save the response for dynamic data.
        </p>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs label="API call" variant="pill" tabs={MAIN_TABS} value={main} onChange={setMain} />
        {main === "test" ? (
          <ActionButton
            size="sm"
            isLoading={test.running}
            onPress={() => void test.run(draft, config, secrets)}
          >
            <Icon name="ph:play" width={14} height={14} />
            Test API Call
          </ActionButton>
        ) : null}
      </div>
      {main === "definition" ? (
        <>
          <CallConnection call={draft} groups={config.groups} onChange={setDraft} />
          <Tabs
            label="Call settings"
            variant="underline"
            tabs={subTabs}
            value={shownSub}
            onChange={setSub}
          />
          {shownSub === "header" ? (
            <KeyValueLines
              title="Headers to add"
              kind="header"
              items={draft.headers}
              onChange={(headers) => setDraft({ ...draft, headers })}
              addPlaceholder="Add header as key:value"
              addLabel="Add Header"
            />
          ) : shownSub === "body" ? (
            <BodyTab call={draft} onChange={setDraft} />
          ) : shownSub === "variables" ? (
            <VariablesTab call={draft} onChange={setDraft} />
          ) : shownSub === "auth" ? (
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
              tip="Sends cookies, authorization headers and TLS client certificates of the app's visitor with this call (built apps)."
              selected={draft.includeCredentials || Boolean(group?.includeCredentials)}
              disabled={Boolean(group?.includeCredentials)}
              onChange={(includeCredentials) => setDraft({ ...draft, includeCredentials })}
            />
          )}
        </>
      ) : (
        <>
          <TestPreview test={test} call={draft} config={config} />
          <ResponseType call={draft} onChange={setDraft} json={test.result?.json ?? null} />
        </>
      )}
      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : problems.length > 0 ? (
        <p className="text-small text-warning">{problems[0]}</p>
      ) : null}
      <EditorFooter
        deleteLabel="Delete API"
        saveLabel="Save API"
        confirmTitle={`Delete ${saved.name}?`}
        confirmText="The call, its saved response shape and its authentication values are removed. Pages that use it will need another call."
        canDelete={!isNew}
        dirty={dirty}
        saving={saving}
        onDelete={() => void model.deleteCall(saved.id).then((r) => setError(r.error))}
        onCancel={discard}
        onSave={() => void save()}
      />
    </DraftScope>
  );
}
