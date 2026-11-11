"use client";

import { Checkbox } from "@heroui-v2/react";
import type { SecretMask } from "@nextomic/integrations";
import { previewRequest, type RestCall, type RestConfig } from "@nextomic/schema";
import { useState } from "react";
import { CodeView, headerText, ResponseView } from "./response-view";
import { Tabs } from "./tabs";
import type { SecretDraft } from "./use-api-data";
import type { CallTestModel } from "./use-call-test";

const PREVIEW_TABS = [
  { id: "url", label: "API URL" },
  { id: "headers", label: "Headers" },
  { id: "response", label: "Test Response" }
] as const;
/** "Preview and Test": sample values on the left, the request and response on the right. */
export function TestPreview({
  test,
  call,
  config,
  masks,
  secrets
}: {
  test: CallTestModel;
  call: RestCall;
  config: RestConfig;
  /** Saved auth values (masks only) and ones typed but not saved: preview shows •••• for both. */
  masks: Record<string, SecretMask>;
  secrets: SecretDraft;
}) {
  const [tab, setTab] = useState<(typeof PREVIEW_TABS)[number]["id"]>("url");
  // Running a test opens the Test Response tab.
  const [wasRunning, setWasRunning] = useState(test.running);
  if (test.running !== wasRunning) {
    setWasRunning(test.running);
    if (test.running) setTab("response");
  }
  const rows = test.rows(call, config);
  const group = config.groups.find((g) => g.id === call.groupId) ?? null;
  // What the current inputs will send, before any test is run.
  const request = previewRequest({
    call,
    group,
    ...test.inputs(call, config),
    hasSecret: (ownerId, field) => {
      const key = `${ownerId}.${field}`;
      const typed = ownerId === call.id ? secrets[key] : undefined;
      return typed === null ? false : Boolean(typed) || key in masks;
    }
  });

  return (
    <section
      aria-label="Preview and Test"
      className="grid gap-6 rounded-large border border-default-200 p-5 lg:grid-cols-2"
    >
      <div className="flex min-w-0 flex-col gap-3">
        <h3 className="text-small font-medium text-foreground">Variables</h3>
        {rows.length === 0 ? (
          <p className="text-small text-default-500">This call has no variables.</p>
        ) : (
          <div className="grid grid-cols-[minmax(6rem,1fr)_minmax(8rem,1.6fr)_4rem] items-center gap-x-3 gap-y-2">
            <span className="text-tiny text-default-500">Name</span>
            <span className="text-tiny text-default-500">Value</span>
            <span className="text-tiny text-default-500">Include</span>
            {rows.map(({ name, sample }) => (
              <div key={name} className="contents">
                <span className="truncate font-mono text-small text-foreground">{name}</span>
                <input
                  aria-label={`Test value of ${name}`}
                  value={sample.value}
                  placeholder={
                    name === "jwt" ? "A sample token" : name === "user_ip" ? "203.0.113.7" : ""
                  }
                  onChange={(e) => test.setSample(name, { ...sample, value: e.target.value })}
                  className="h-8 w-full rounded-full border border-default-200 bg-transparent px-3 font-mono text-small text-foreground outline-none hover:border-default-400 focus:border-default-800"
                />
                <Checkbox
                  size="sm"
                  aria-label={`Include ${name}`}
                  isSelected={sample.include}
                  onValueChange={(include) => test.setSample(name, { ...sample, include })}
                />
              </div>
            ))}
          </div>
        )}
        <p className="text-tiny text-default-500">
          Test values are not saved. Unticked variables use their default value.
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <h3 className="text-small font-medium text-foreground">Preview</h3>
        <Tabs
          label="Preview"
          variant="underline"
          tabs={PREVIEW_TABS}
          value={tab}
          onChange={setTab}
        />
        {tab === "url" ? (
          <CodeView label="Called URL" text={`${call.method} ${request.url || "No URL yet."}`} />
        ) : tab === "headers" ? (
          <CodeView label="Request headers" text={headerText(request.headers) || "No headers."} />
        ) : (
          <ResponseView test={test} call={call} />
        )}
      </div>
    </section>
  );
}
