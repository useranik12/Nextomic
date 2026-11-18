"use client";

import {
  LOCAL_LOOP_KIND_LABELS,
  LOCAL_LOOP_KINDS,
  STATE_TYPE_LABELS,
  activeQuery,
  loopAncestors,
  type ElementNode,
  type LocalLoopKind,
  type LocalLoopQuery,
  type StateType,
  listFieldsOf,
  parentFieldProblem,
  rowFields
} from "@nextomic/schema";
import { useId, useMemo } from "react";
import { FormInput, SelectField, type SelectOption } from "@/components/ui/controls";
import { SearchSelect } from "@/components/ui/search-select";
import { InfoTip } from "@/components/ui/info-tip";
import { AutoTextarea } from "../right-panel/auto-textarea";
import { BoltInput } from "../right-panel/bolt-input";
import { useKeptResults } from "../right-panel/use-kept-results";
import { useRowShape } from "../right-panel/use-row-shape";
import { useEditorStore } from "../store/editor-store";
import { useQueryFormMode } from "./query-form-mode";
import { RowSettings } from "./row-settings";

// "Other Loops" settings of a query loop (owner decision 2026-11-09): the Source (page parameters,
// page state, app state, constants, an enclosing loop's list field, static JSON or an expression),
// what to read from it, Single or List with Limit, and Offset. Values come from the page itself.

const KIND_OPTIONS: SelectOption[] = LOCAL_LOOP_KINDS.map((kind) => ({
  value: kind,
  label: LOCAL_LOOP_KIND_LABELS[kind]
}));

interface Variable {
  name: string;
  type: StateType;
  isList?: boolean;
}

/** Variables that can hold a list: lists, JSON, and text (a JSON array written as text). */
const loopable = (v: Variable) => v.isList === true || v.type === "json" || v.type === "string";

function variableOptions(variables: readonly Variable[], kind: LocalLoopKind): SelectOption[] {
  return variables.map((v) => {
    const ok = kind === "param" || loopable(v);
    return {
      value: v.name,
      label: `${v.name} (${STATE_TYPE_LABELS[v.type]}${v.isList ? " list" : ""})`,
      disabled: !ok,
      hint: ok ? undefined : "Not a list: choose a list, JSON or text variable."
    };
  });
}

const RESULT_AS_LIST: Pick<Variable, "type" | "isList"> = { type: "json", isList: true };

function useVariables(kind: LocalLoopKind): readonly Variable[] {
  const kept = useKeptResults();
  const settings = useEditorStore((s) => s.doc?.settings);
  const appState = useEditorStore((s) => s.project.appState);
  const constants = useEditorStore((s) => s.project.constants);
  if (kind === "param") return settings?.params ?? [];
  if (kind === "state") return settings?.state ?? [];
  if (kind === "app") return appState;
  if (kind === "const") return constants;
  if (kind === "result") return kept.map((r) => ({ name: r.name, ...RESULT_AS_LIST }));
  return [];
}

const EMPTY_HINT: Partial<Record<LocalLoopKind, string>> = {
  param: "This page has no parameters. Add them in Page Settings.",
  state: "This page has no state variables. Add them in Page Settings.",
  app: "No app state variables yet. Add them in State Management.",
  const: "No constants yet. Add them in State Management.",
  result: "No action results yet. In an action flow, name an output and keep it on the page."
};

export function LocalQueryForm({
  node,
  value,
  onChange
}: {
  node: ElementNode;
  value: LocalLoopQuery;
  onChange: (next: LocalLoopQuery) => void;
}) {
  const mode = useQueryFormMode();
  const tree = useEditorStore((s) => s.doc?.tree);
  const variables = useVariables(value.kind);
  const jsonId = useId();
  const patch = (next: Partial<LocalLoopQuery>) => onChange({ ...value, ...next });
  const outerLoops = (tree ? loopAncestors(tree, node.id) : [])
    .map((n) => activeQuery(n)?.name ?? "")
    .filter(Boolean);
  const reads = value.kind in EMPTY_HINT;
  const shape = useRowShape();
  // The rows of the chosen parent loop: what its list field can be (null: shape not known).
  const parentFields = useMemo(() => {
    const parent = tree
      ? loopAncestors(tree, node.id).find((n) => activeQuery(n)?.name === value.parentLoop)
      : undefined;
    const query = parent ? activeQuery(parent) : null;
    return query ? rowFields(query, shape) : null;
  }, [tree, node.id, value.parentLoop, shape]);
  const parentLists = parentFields ? listFieldsOf(parentFields) : null;
  const fieldProblem = value.parentLoop
    ? parentFieldProblem(value.field, value.parentLoop, parentFields)
    : null;
  const options = variableOptions(variables, value.kind);

  return (
    <>
      <SelectField
        compact
        label="Source"
        tip={mode.tip("source")}
        options={KIND_OPTIONS}
        value={value.kind}
        onValueChange={(kind) => patch({ kind: kind as LocalLoopKind, variable: "" })}
      />
      {reads ? (
        variables.length === 0 ? (
          <p className="text-xs text-muted">{EMPTY_HINT[value.kind]}</p>
        ) : (
          <SelectField
            compact
            label="Variable"
            tip={mode.tip("variable")}
            options={
              value.variable ? options : [{ value: "", label: "Choose a variable" }, ...options]
            }
            value={value.variable}
            onValueChange={(variable) => patch({ variable })}
          />
        )
      ) : null}
      {reads && value.variable && !variables.some((v) => v.name === value.variable) ? (
        <p role="status" className="text-xs text-warning">
          The variable &quot;{value.variable}&quot; no longer exists.
        </p>
      ) : null}
      {value.kind === "param" ? (
        <p className="text-xs text-muted">
          A parameter loops over a JSON array or comma-separated text, like ?tags=a,b.
        </p>
      ) : null}
      {value.kind === "parent" ? (
        outerLoops.length === 0 ? (
          <p className="text-xs text-muted">
            Parent Item needs this element to be inside another query loop.
          </p>
        ) : (
          <>
            <SelectField
              compact
              label="Parent loop"
              tip={mode.tip("parentLoop")}
              options={[
                ...(value.parentLoop ? [] : [{ value: "", label: "Choose a loop" }]),
                ...outerLoops.map((name) => ({ value: name, label: `%${name}` }))
              ]}
              value={value.parentLoop}
              onValueChange={(parentLoop) => patch({ parentLoop })}
            />
            {value.parentLoop && !outerLoops.includes(value.parentLoop) ? (
              <p role="status" className="text-xs text-warning">
                The loop %{value.parentLoop} is not around this element any more.
              </p>
            ) : null}
            <SearchSelect
              allowCustom
              label="List field"
              tip={mode.tip("field")}
              placeholder="tags"
              sections={[
                {
                  title: `List fields of %${value.parentLoop || "loop"}`,
                  options: (parentLists ?? []).map((f) => ({
                    value: f.name,
                    label: f.name,
                    hint: f.isList ? `${f.type} list` : f.type
                  }))
                }
              ]}
              emptyText="Type the field path, like images[0].sizes."
              value={value.field}
              onValueChange={(field) => patch({ field })}
            />
            <p className="text-xs text-muted">
              {`The field of %${value.parentLoop || "loop"}.item that holds the list. Pick one or type a path like images[0].sizes.`}
            </p>
            {fieldProblem ? (
              <p role="alert" className="text-xs text-danger">
                {fieldProblem} It can be saved, but not published.
              </p>
            ) : null}
          </>
        )
      ) : null}
      {value.kind === "json" ? (
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5">
            <label htmlFor={jsonId} className="text-xs font-medium text-body">
              Static JSON
            </label>
            {mode.tip("json") ? (
              <InfoTip text={mode.tip("json") ?? ""} label="Static JSON" />
            ) : null}
          </span>
          <AutoTextarea
            id={jsonId}
            value={value.json}
            spellCheck={false}
            placeholder='[{ "title": "First" }, { "title": "Second" }]'
            onChange={(e) => patch({ json: e.target.value })}
            className="w-full resize-none rounded-2xl border border-border bg-transparent px-3 py-2 font-mono text-xs text-foreground outline-none transition-colors hover:border-default-400 focus:border-focus"
          />
        </div>
      ) : null}
      {value.kind === "expression" ? (
        <BoltInput
          label="Expression"
          tip={mode.tip("expression")}
          placeholder="{{ app.cart.filter(i => i.qty > 0) }}"
          description="One {{ tag }} that gives a list."
          value={value.expression}
          onValueChange={(expression) => patch({ expression })}
        />
      ) : null}
      <RowSettings value={value} onChange={patch} />
      <FormInput
        compact
        type="number"
        label="Offset"
        tip={mode.tip("offset")}
        description="Rows to skip from the start of the list."
        min={0}
        value={String(value.offset)}
        onValueChange={(text) => {
          const offset = Math.round(Number(text));
          if (Number.isFinite(offset)) patch({ offset: Math.min(100_000, Math.max(0, offset)) });
        }}
      />
    </>
  );
}
