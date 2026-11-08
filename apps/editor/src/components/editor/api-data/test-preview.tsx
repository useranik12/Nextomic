"use client";

import { Checkbox, Spinner } from "@heroui/react";
import type { RestCall, RestConfig } from "@nextomic/schema";
import { useState } from "react";
import { Tabs } from "./tabs";
import type { CallTestModel } from "./use-call-test";

/** Read-only text with line numbers. */
function CodeView({ text, label }: { text: string; label: string }) {
  const lines = text.split("\n");
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="flex max-h-[420px] min-h-[200px] overflow-auto rounded-medium border border-default-200 bg-default-50 font-mono text-tiny leading-5"
    >
      <div
        aria-hidden
        className="sticky left-0 select-none bg-default-100 px-2 py-2.5 text-right text-default-500"
      >
        {lines.map((_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <pre className="m-0 flex-1 whitespace-pre px-3 py-2.5 text-foreground">{text}</pre>
    </div>
  );
}

const headerText = (headers: Record<string, string>) =>
  Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

const PREVIEW_TABS = [
  { id: "url", label: "API URL" },
  { id: "headers", label: "Headers" },
  { id: "response", label: "Test Response" }
] as const;
const RESPONSE_TABS = [
  { id: "json", label: "Body JSON" },
  { id: "raw", label: "Raw Body" },
  { id: "headers", label: "Headers" }
] as const;

/** "Preview and Test": sample values on the left, the request and response on the right. */
export function TestPreview({
  test,
  call,
  config
}: {
  test: CallTestModel;
  call: RestCall;
  config: RestConfig;
}) {
  const [tab, setTab] = useState<(typeof PREVIEW_TABS)[number]["id"]>("response");
  const [view, setView] = useState<(typeof RESPONSE_TABS)[number]["id"]>("json");
  const { result } = test;
  const rows = test.rows(call, config);

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
          Test values are not saved. Unticked variables use their default value. {"{{tags}}"} use
          what they show in the editor.
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
        {test.running ? (
          <Spinner size="sm" label="Calling the API" className="self-start" />
        ) : test.error ? (
          <p role="alert" className="text-small text-danger">
            {test.error}
          </p>
        ) : !result ? (
          <p className="text-small text-default-500">Press Test API Call to run it.</p>
        ) : tab === "url" ? (
          <CodeView label="Called URL" text={`${result.method} ${result.url}`} />
        ) : tab === "headers" ? (
          <CodeView
            label="Request headers"
            text={headerText(result.requestHeaders) || "No headers."}
          />
        ) : (
          <>
            <div className="self-end">
              <Tabs
                label="Response view"
                variant="pill"
                tabs={RESPONSE_TABS}
                value={view}
                onChange={setView}
              />
            </div>
            {view === "json" ? (
              <CodeView
                label="Response JSON"
                text={
                  result.json === null
                    ? "The response is not JSON. See Raw Body."
                    : JSON.stringify(result.json, null, 2)
                }
              />
            ) : view === "raw" ? (
              <CodeView label="Raw response body" text={result.body || "Empty body."} />
            ) : (
              <CodeView label="Response headers" text={headerText(result.responseHeaders)} />
            )}
          </>
        )}
        {result && !test.running && !test.error ? (
          <p role="status" className={`text-small ${result.ok ? "text-success" : "text-danger"}`}>
            Status: {result.status} ({result.ok ? "Success" : "Failure"}) · {result.latencyMs} ms
            {result.truncated ? " · body cut at 1 MB" : ""}
          </p>
        ) : null}
      </div>
    </section>
  );
}
