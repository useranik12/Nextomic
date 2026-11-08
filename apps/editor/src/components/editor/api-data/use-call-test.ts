"use client";

import type { RestCallResult } from "@nextomic/integrations";
import {
  callPlaceholders,
  callVariables,
  jsonShape,
  type JsonShape,
  type RestCall,
  type RestConfig
} from "@nextomic/schema";
import { useMemo, useState } from "react";
import type { ApiDataModel, SecretDraft } from "./use-api-data";
import { toggleIn } from "./json-path-parts";

export interface SampleValue {
  value: string;
  include: boolean;
}

/**
 * The Test API tab's state: sample values, the last result, the response shape it gives (until it
 * is saved), and which JSON paths the response viewer shows (the eyes).
 */
export function useCallTest(model: ApiDataModel) {
  const [samples, setSamples] = useState<Record<string, SampleValue>>({});
  const [result, setResult] = useState<RestCallResult | null>(null);
  const [savedResult, setSavedResult] = useState<RestCallResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [shown, setShown] = useState<Set<string>>(new Set());

  /** Sample rows: the call's and its group's variables, then jwt and user_ip when used. */
  function rows(call: RestCall, config: RestConfig): { name: string; sample: SampleValue }[] {
    const group = config.groups.find((g) => g.id === call.groupId) ?? null;
    const used = callPlaceholders(call, group);
    const variables = callVariables(call, group);
    const names = [
      ...variables.map((v) => v.name),
      ...(["jwt", "user_ip"] as const).filter((n) => used.includes(n))
    ];
    return names.map((name) => ({
      name,
      sample: samples[name] ?? {
        value: variables.find((v) => v.name === name)?.defaultValue ?? "",
        include: true
      }
    }));
  }

  /** The sample values to send: ticked rows only (unticked ones use their default). */
  function inputs(call: RestCall, config: RestConfig) {
    const values: Record<string, string> = {};
    const builtIns = { jwt: "", user_ip: "" };
    for (const { name, sample } of rows(call, config)) {
      if (!sample.include) continue;
      if (name === "jwt" || name === "user_ip") builtIns[name] = sample.value;
      else values[name] = sample.value;
    }
    return { values, builtIns };
  }

  async function run(call: RestCall, config: RestConfig, secrets: SecretDraft) {
    setRunning(true);
    setError(null);
    const { values, builtIns } = inputs(call, config);
    const typed = Object.fromEntries(
      Object.entries(secrets).filter(
        (e): e is [string, string] => typeof e[1] === "string" && e[1] !== ""
      )
    );
    try {
      const response = await model.test({
        call,
        values,
        builtIns,
        secrets: typed
      });
      setResult(response.data);
      setError(response.error);
    } catch {
      setResult(null);
      setError("The test could not reach the builder. Check your connection and try again.");
    } finally {
      setRunning(false);
    }
  }

  // An empty response body reads as an empty list.
  const json = useMemo<unknown>(
    () => (!result ? null : result.body.trim() === "" ? [] : result.json),
    [result]
  );
  const shape = useMemo<JsonShape | null>(
    () => (result?.ok && json !== null ? jsonShape(json) : null),
    [result, json]
  );

  return {
    rows,
    inputs,
    setSample: (name: string, sample: SampleValue) => setSamples((s) => ({ ...s, [name]: sample })),
    run,
    running,
    result,
    /** The response as JSON (an empty body is []), or null when there is none or it is not JSON. */
    json,
    error,
    /** The shape of a successful test that has not been saved yet; saving the call stores it. */
    unsavedShape: result !== savedResult ? shape : null,
    markSaved: () => setSavedResult(result),
    /** JSON path keys (path ids, or `rec:<path>` for recommended ones) the viewer shows. */
    shown,
    toggleShown: (key: string) => setShown((s) => toggleIn(s, key)),
    showAll: () => setShown(new Set())
  };
}

export type CallTestModel = ReturnType<typeof useCallTest>;
