"use client";

import {
  availableVariables,
  callProblems,
  restCallSchema,
  type RestCall,
  type RestConfig
} from "@nextomic/schema";
import { useState } from "react";
import { ActionButton } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { DraftScope } from "../draft-scope";
import { CallDefinition, type SubTab } from "./call-definition";
import { EditorFooter } from "./editor-footer";
import { ResponseType } from "./response-type";
import { Tabs } from "./tabs";
import { TestPreview } from "./test-preview";
import type { ApiDataModel, SecretDraft } from "./use-api-data";
import { useCallTest } from "./use-call-test";

const MAIN_TABS = [
  { id: "definition", label: "Call Definition" },
  { id: "test", label: "Test API" }
] as const;

/** The first schema problem of a draft, named by where it is (the server checks the same). */
function schemaProblem(call: RestCall): string | null {
  const parsed = restCallSchema.safeParse(call);
  if (parsed.success) return null;
  const issue = parsed.error.issues[0];
  if (!issue) return null;
  const [first, second, third] = issue.path;
  if (first === "response" && second === "jsonPaths" && typeof third === "number")
    return `JSON path ${third + 1}: ${issue.message}`;
  if (first === "variables" && typeof second === "number")
    return `Variable ${second + 1}: ${issue.message}`;
  if (first === "query" && typeof second === "number")
    return `Query parameter ${second + 1}: ${issue.message}`;
  return issue.message;
}

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
  const shape = test.unsavedShape;
  const dirty =
    isNew || typedSecret || shape !== null || JSON.stringify(draft) !== JSON.stringify(saved);
  const schemaIssue = schemaProblem(draft);
  const problems = [...(schemaIssue ? [schemaIssue] : []), ...callProblems(draft, group)];
  const variables = availableVariables(draft.variables, group?.variables);

  async function save(): Promise<boolean> {
    if (problems[0]) {
      setError(problems[0]);
      return false;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await model.saveCall(draft, secrets, shape);
      if (result.error) {
        setError(result.error);
        return false;
      }
      // The stored call is the new baseline, and the saved test shape is no longer pending.
      if (result.saved) setDraft(result.saved);
      test.markSaved();
      setSecrets({});
      return true;
    } catch {
      setError("Could not save the API call. Check your connection and try again.");
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
        <CallDefinition
          draft={draft}
          onChange={setDraft}
          config={config}
          group={group}
          variables={variables}
          sub={sub}
          onSub={setSub}
          masks={model.data?.secrets ?? {}}
          secrets={secrets}
          onSecretsChange={setSecrets}
        />
      ) : (
        <>
          <TestPreview test={test} call={draft} config={config} />
          <ResponseType
            call={draft}
            onChange={setDraft}
            json={test.result?.json ?? null}
            shown={test.shown}
            onToggleShown={test.toggleShown}
          />
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
