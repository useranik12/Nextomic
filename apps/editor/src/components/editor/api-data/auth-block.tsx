"use client";

import type { SecretMask } from "@nextomic/integrations";
import { REST_AUTH_TYPES, type RestAuth, type RestAuthType } from "@nextomic/schema";
import { FormInput, PasswordInput, SelectField } from "@/components/ui/controls";
import type { SecretDraft } from "./use-api-data";

const AUTH_LABELS: Record<RestAuthType, string> = {
  none: "No authentication",
  bearer: "Bearer token",
  basic: "Basic auth (user name and password)",
  apiKey: "API key"
};

/**
 * Shared authentication, like Postman's: for a group it applies to every call in it; an ungrouped
 * call has its own. Secret values are sealed on the server and only shown as "Saved (…tail)".
 */
export function AuthBlock({
  ownerId,
  auth,
  onChange,
  masks,
  secrets,
  onSecretsChange
}: {
  ownerId: string;
  auth: RestAuth;
  onChange: (next: RestAuth) => void;
  masks: Record<string, SecretMask>;
  secrets: SecretDraft;
  onSecretsChange: (next: SecretDraft) => void;
}) {
  const secretField = (field: string, label: string) => {
    const key = `${ownerId}.${field}`;
    const mask = masks[key];
    return (
      <PasswordInput
        compact
        label={label}
        autoComplete="off"
        placeholder={mask ? `Saved${mask.tail ? ` (…${mask.tail})` : ""}. Type to replace.` : " "}
        value={secrets[key] ?? ""}
        onValueChange={(v) => onSecretsChange({ ...secrets, [key]: v })}
      />
    );
  };

  return (
    <section
      aria-label="Authentication"
      className="flex flex-col gap-4 rounded-2xl border border-border p-5"
    >
      <div>
        <h3 className="text-sm font-medium text-foreground">Authentication</h3>
        <p className="text-sm text-muted">
          Values are encrypted on the server and never sent to the browser or the built site.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          compact
          label="Type"
          value={auth.type}
          options={REST_AUTH_TYPES.map((t) => ({ value: t, label: AUTH_LABELS[t] }))}
          onValueChange={(v) => onChange({ ...auth, type: v as RestAuthType })}
        />
        {auth.type === "bearer" ? secretField("token", "Token") : null}
        {auth.type === "basic" ? (
          <>
            <FormInput
              compact
              label="User name"
              autoComplete="off"
              value={auth.username}
              onValueChange={(username) => onChange({ ...auth, username })}
            />
            {secretField("password", "Password")}
          </>
        ) : null}
        {auth.type === "apiKey" ? (
          <>
            <FormInput
              compact
              label="Key name"
              placeholder="x-api-key"
              autoComplete="off"
              value={auth.apiKeyName}
              onValueChange={(apiKeyName) => onChange({ ...auth, apiKeyName })}
            />
            <SelectField
              compact
              label="Send in"
              value={auth.apiKeyIn}
              options={[
                { value: "header", label: "Header" },
                { value: "query", label: "Query parameter" }
              ]}
              onValueChange={(v) =>
                onChange({ ...auth, apiKeyIn: v === "query" ? "query" : "header" })
              }
            />
            {secretField("apiKey", "API key")}
          </>
        ) : null}
      </div>
    </section>
  );
}
