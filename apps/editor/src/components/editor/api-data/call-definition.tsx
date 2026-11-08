"use client";

import type { SecretMask } from "@nextomic/integrations";
import type { AvailableVariable, RestCall, RestConfig, RestGroup } from "@nextomic/schema";
import { SwitchRow } from "@/components/ui/switch-row";
import { AuthBlock } from "./auth-block";
import { BodyTab } from "./body-tab";
import { CallConnection } from "./call-connection";
import { KeyValueLines } from "./key-value-lines";
import { Tabs } from "./tabs";
import type { SecretDraft } from "./use-api-data";
import { VariableFields } from "./variable-assist";
import { VariablesTab } from "./variables-tab";

export type SubTab = "header" | "query" | "body" | "variables" | "auth" | "advanced";

/** The Call Definition tab: connection, then Header, Query, Body, Variables, auth and advanced. */
export function CallDefinition({
  draft,
  onChange,
  config,
  group,
  variables,
  sub,
  onSub,
  masks,
  secrets,
  onSecretsChange
}: {
  draft: RestCall;
  onChange: (next: RestCall) => void;
  config: RestConfig;
  group: RestGroup | null;
  variables: readonly AvailableVariable[];
  sub: SubTab;
  onSub: (next: SubTab) => void;
  masks: Record<string, SecretMask>;
  secrets: SecretDraft;
  onSecretsChange: (next: SecretDraft) => void;
}) {
  const subTabs = [
    { id: "header" as const, label: "Header" },
    { id: "query" as const, label: "Query" },
    { id: "body" as const, label: "Body" },
    { id: "variables" as const, label: "Variables" },
    ...(group ? [] : [{ id: "auth" as const, label: "Authentication" }]),
    { id: "advanced" as const, label: "Advanced Settings" }
  ];
  const shown = subTabs.some((t) => t.id === sub) ? sub : "header";

  return (
    <VariableFields variables={variables} className="flex flex-col gap-6">
      <CallConnection call={draft} groups={config.groups} onChange={onChange} />
      <Tabs
        label="Call settings"
        variant="underline"
        tabs={subTabs}
        value={shown}
        onChange={onSub}
      />
      {shown === "header" ? (
        <KeyValueLines
          title="Headers to add"
          kind="header"
          items={draft.headers}
          onChange={(headers) => onChange({ ...draft, headers })}
          addPlaceholder="Add header as key:value"
          addLabel="Add Header"
        />
      ) : shown === "query" ? (
        <KeyValueLines
          title="Query parameters"
          description="Added to the URL for you (encoded). A query string typed in the URL works too; both are sent."
          kind="query"
          items={draft.query}
          onChange={(query) => onChange({ ...draft, query })}
          addPlaceholder="Add query parameter as key:value"
          addLabel="Add Query Parameter"
        />
      ) : shown === "body" ? (
        <BodyTab call={draft} variables={variables} onChange={onChange} />
      ) : shown === "variables" ? (
        <VariablesTab
          variables={draft.variables}
          onChange={(next) => onChange({ ...draft, variables: next })}
          description={`Values the call needs. Type [ in the URL, query, headers or body to use one.${group ? " The group's variables are available too; a variable here with the same name wins." : ""} jwt and user_ip are filled by the server.`}
        />
      ) : shown === "auth" ? (
        <div data-no-vars>
          <AuthBlock
            ownerId={draft.id}
            auth={draft.auth}
            onChange={(auth) => onChange({ ...draft, auth })}
            masks={masks}
            secrets={secrets}
            onSecretsChange={onSecretsChange}
          />
        </div>
      ) : (
        <SwitchRow
          label="Include credentials"
          tip="Sends cookies, authorization headers and TLS client certificates of the app's visitor with this call (built apps)."
          selected={draft.includeCredentials || Boolean(group?.includeCredentials)}
          disabled={Boolean(group?.includeCredentials)}
          onChange={(includeCredentials) => onChange({ ...draft, includeCredentials })}
        />
      )}
    </VariableFields>
  );
}
