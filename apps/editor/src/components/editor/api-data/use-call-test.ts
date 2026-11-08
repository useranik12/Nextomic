"use client";

import type { RestCallResult } from "@nextomic/integrations";
import {
  callPlaceholders,
  createTokenResolver,
  fillTokens,
  jsonShape,
  type JsonShape,
  type RestCall,
  type RestConfig
} from "@nextomic/schema";
import { useState } from "react";
import { useEditorDynamicContext } from "../use-editor-context";
import type { ApiDataModel, SecretDraft } from "./use-api-data";

export interface SampleValue {
  value: string;
  include: boolean;
}

/** `{{tags}}` in the definition, filled with what they show in the editor right now. */
function withTags(call: RestCall, resolve: (token: string) => string): RestCall {
  const fill = (text: string) => fillTokens(text, resolve);
  return {
    ...call,
    url: fill(call.url),
    body: fill(call.body),
    headers: call.headers.map((h) => ({ ...h, value: fill(h.value) })),
    fields: call.fields.map((f) => ({ ...f, value: fill(f.value) }))
  };
}

/** Sample values, the last result and the response shape it gives, for the Test API tab. */
export function useCallTest(model: ApiDataModel) {
  const context = useEditorDynamicContext();
  const [samples, setSamples] = useState<Record<string, SampleValue>>({});
  const [result, setResult] = useState<RestCallResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  /** Sample rows: the call's variables (default value first), then jwt and user_ip when used. */
  function rows(call: RestCall, config: RestConfig): { name: string; sample: SampleValue }[] {
    const group = config.groups.find((g) => g.id === call.groupId) ?? null;
    const used = callPlaceholders(call, group);
    const names = [
      ...call.variables.map((v) => v.name),
      ...(["jwt", "user_ip"] as const).filter((n) => used.includes(n))
    ];
    return names.map((name) => ({
      name,
      sample: samples[name] ?? {
        value: call.variables.find((v) => v.name === name)?.defaultValue ?? "",
        include: true
      }
    }));
  }

  async function run(call: RestCall, config: RestConfig, secrets: SecretDraft) {
    setRunning(true);
    setError(null);
    const resolve = context ? createTokenResolver(context) : () => "";
    const values: Record<string, string> = {};
    let jwt = "";
    let userIp = "";
    for (const { name, sample } of rows(call, config)) {
      if (!sample.include) continue;
      if (name === "jwt") jwt = sample.value;
      else if (name === "user_ip") userIp = sample.value;
      else values[name] = sample.value;
    }
    const typed = Object.fromEntries(
      Object.entries(secrets).filter(
        (e): e is [string, string] => typeof e[1] === "string" && e[1] !== ""
      )
    );
    const response = await model.test({
      call: withTags(call, resolve),
      values,
      builtIns: { jwt, user_ip: userIp },
      secrets: typed
    });
    setRunning(false);
    setResult(response.data);
    setError(response.error);
  }

  const shape: JsonShape | null =
    result?.json !== undefined && result?.json !== null ? jsonShape(result.json) : null;

  return {
    rows,
    setSample: (name: string, sample: SampleValue) => setSamples((s) => ({ ...s, [name]: sample })),
    run,
    running,
    result,
    error,
    shape
  };
}

export type CallTestModel = ReturnType<typeof useCallTest>;
