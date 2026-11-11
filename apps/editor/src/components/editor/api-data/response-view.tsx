"use client";

import { Spinner } from "@heroui-v2/react";
import { jsonPathValues, type RestCall } from "@nextomic/schema";
import { useState } from "react";
import { Tabs } from "./tabs";
import type { CallTestModel } from "./use-call-test";

/** Read-only text with line numbers. */
export function CodeView({ text, label }: { text: string; label: string }) {
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

export const headerText = (headers: Record<string, string>) =>
  Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

/** The response, or only the JSON paths picked with the eyes (by name) when any are picked. */
function responseText(json: unknown, call: RestCall, shown: ReadonlySet<string>): string {
  if (json === null) return "The response is not JSON. See Raw Body.";
  if (shown.size === 0) return JSON.stringify(json, null, 2);
  const picked = [
    ...call.response.jsonPaths.filter((p) => shown.has(p.id)),
    ...[...shown]
      .filter((key) => key.startsWith("rec:"))
      .map((key) => ({ name: key.slice(4), path: key.slice(4) }))
  ];
  return JSON.stringify(jsonPathValues(picked, json), null, 2);
}

const RESPONSE_TABS = [
  { id: "json", label: "Body JSON" },
  { id: "raw", label: "Raw Body" },
  { id: "headers", label: "Headers" }
] as const;

/** The Test Response tab: filled after a test runs (an empty body shows as []). */
export function ResponseView({ test, call }: { test: CallTestModel; call: RestCall }) {
  const [view, setView] = useState<(typeof RESPONSE_TABS)[number]["id"]>("json");
  const { result, json } = test;
  if (test.running) return <Spinner size="sm" label="Calling the API" className="self-start" />;
  if (test.error)
    return (
      <p role="alert" className="text-small text-danger">
        {test.error}
      </p>
    );
  if (!result)
    return <p className="text-small text-default-500">Press Test API Call to see the response.</p>;
  return (
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
        <>
          {test.shown.size > 0 && json !== null ? (
            <p className="flex flex-wrap items-center gap-2 text-tiny text-default-500">
              Showing {test.shown.size} picked JSON path{test.shown.size === 1 ? "" : "s"}.
              <button
                type="button"
                onClick={test.showAll}
                className="text-primary-600 underline-offset-2 hover:underline dark:text-primary-400"
              >
                Show whole response
              </button>
            </p>
          ) : null}
          <CodeView label="Response JSON" text={responseText(json, call, test.shown)} />
        </>
      ) : view === "raw" ? (
        <CodeView label="Raw response body" text={result.body || "[]"} />
      ) : (
        <CodeView label="Response headers" text={headerText(result.responseHeaders)} />
      )}
      <p role="status" className={`text-small ${result.ok ? "text-success" : "text-danger"}`}>
        Status: {result.status} ({result.ok ? "Success" : "Failure"}) · {result.latencyMs} ms
        {result.truncated ? " · body cut at 1 MB" : ""}
      </p>
    </>
  );
}
