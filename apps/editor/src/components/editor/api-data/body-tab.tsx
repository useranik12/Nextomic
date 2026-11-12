"use client";

import {
  BODY_METHODS,
  REST_BODY_TYPES,
  type AvailableVariable,
  type RestBodyType,
  type RestCall
} from "@nextomic/schema";
import { useRef } from "react";
import { SelectField } from "@/components/ui/controls";
import { replaceInField } from "../expression/expression-field";
import { JsonBodyEditor } from "./json-body-editor";
import { KeyValueLines } from "./key-value-lines";

const BODY_LABELS: Record<RestBodyType, string> = {
  none: "None",
  json: "JSON",
  text: "Text",
  multipart: "Multipart",
  form: "Form URL-encoded"
};

/** Body Type, the variable chips and the body itself (JSON, text, or fields). */
export function BodyTab({
  call,
  variables,
  onChange
}: {
  call: RestCall;
  variables: readonly AvailableVariable[];
  onChange: (next: RestCall) => void;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  if (!BODY_METHODS.has(call.method))
    return (
      <p className="text-sm text-muted">
        {call.method} requests send no body. Choose POST, PUT, PATCH, DELETE or QUERY to add one.
      </p>
    );

  const insert = (name: string) => {
    const el = area.current;
    const token = `[${name}]`;
    if (!el) return onChange({ ...call, body: call.body + token });
    replaceInField(el, el.selectionStart, el.selectionEnd, token, el.selectionStart + token.length);
  };
  const textual = call.bodyType === "json" || call.bodyType === "text";

  return (
    <div className="flex flex-col gap-4">
      <div className="w-64">
        <SelectField
          compact
          label="Body Type"
          value={call.bodyType}
          options={REST_BODY_TYPES.map((t) => ({ value: t, label: BODY_LABELS[t] }))}
          onValueChange={(v) => onChange({ ...call, bodyType: v as RestBodyType })}
        />
      </div>
      {textual ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">Available variables to add (or type [ to pick one)</p>
          <div className="flex flex-wrap gap-1.5">
            {variables.map(({ name }) => (
              <button
                key={name}
                type="button"
                onClick={() => insert(name)}
                className="rounded-full bg-accent/10 px-2.5 py-0.5 font-mono text-xs text-accent transition-colors hover:bg-accent/20 dark:text-accent"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {call.bodyType === "json" ? (
        <JsonBodyEditor
          label="JSON body"
          value={call.body}
          textareaRef={area}
          onChange={(body) => onChange({ ...call, body })}
        />
      ) : call.bodyType === "text" ? (
        <textarea
          ref={area}
          aria-label="Text body"
          value={call.body}
          rows={10}
          spellCheck={false}
          onChange={(e) => onChange({ ...call, body: e.target.value })}
          className="rounded-xl bg-default px-3 py-2.5 font-mono text-xs leading-5 text-foreground outline-none focus:ring-1 focus:ring-focus/30"
        />
      ) : call.bodyType === "multipart" || call.bodyType === "form" ? (
        <KeyValueLines
          title="Fields to send"
          kind="field"
          items={call.fields}
          onChange={(fields) => onChange({ ...call, fields })}
          addPlaceholder="Add field as key:value (use [variable] for values)"
          addLabel="Add Field"
        />
      ) : (
        <p className="text-sm text-muted">This call sends no body.</p>
      )}
    </div>
  );
}
