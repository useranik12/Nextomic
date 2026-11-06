"use client";

import {
  MAX_RULE_DEPTH,
  RULE_OP_LABELS,
  VALUELESS_OPS,
  dynamicTextOf,
  emptyRuleGroup,
  isRuleGroup,
  needsBrowser,
  opsForKind,
  parseDynamicText,
  ruleFieldById,
  type Rule,
  type RuleGroup,
  type RuleOp
} from "@nextomic/schema";
import { useState } from "react";
import { SelectField } from "@/components/ui/controls";
import { FieldPicker } from "./field-picker";
import { Icon } from "@/lib/icons/Icon";
import { DynamicBolt } from "../right-panel/dynamic-bolt";
import { compactFieldClass } from "../right-panel/setting-row";

function newRule(): Rule {
  return {
    id: crypto.randomUUID(),
    field: "page.route",
    key: "",
    op: "startsWith",
    exclude: false,
    value: ""
  };
}

/** A text field with the dynamic bolt inside: static text mixed with {{tags}}. */
function BoltText({
  label,
  placeholder,
  value,
  onChange
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <input
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={compactFieldClass + " pr-9"}
      />
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
        <DynamicBolt label={label} onInsert={(token) => onChange(`${value}{{${token}}}`)} />
      </div>
    </div>
  );
}

/** Switches a rule or group between "must match" and "must NOT match". */
function ExcludeToggle({
  label,
  on,
  onChange
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={on ? "Excluding: applies where this does NOT match" : "Exclude where this matches"}
      onClick={() => onChange(!on)}
      className={
        "flex h-7 shrink-0 items-center rounded-full px-2.5 text-tiny font-medium transition-colors duration-300 " +
        (on
          ? "bg-danger/15 text-danger"
          : "text-default-600 hover:bg-default-200 hover:text-foreground")
      }
    >
      Excluding
    </button>
  );
}

function RuleRow({
  rule,
  index,
  onChange,
  onRemove
}: {
  rule: Rule;
  index: number;
  onChange: (rule: Rule) => void;
  onRemove: () => void;
}) {
  const def = ruleFieldById(rule.field);
  const ops = def ? opsForKind(def.kind) : [];
  const valueless = VALUELESS_OPS.includes(rule.op);
  const n = index + 1;
  return (
    <li className="flex flex-col gap-2 rounded-large border border-divider p-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <FieldPicker
            label={`Rule ${n} field`}
            value={rule.field}
            onChange={(field) => {
              const next = ruleFieldById(field);
              const allowed = next ? opsForKind(next.kind) : [];
              onChange({
                ...rule,
                field,
                key: "",
                op: allowed.includes(rule.op) ? rule.op : (allowed[0] ?? "equals")
              } as Rule);
            }}
          />
        </div>
        <ExcludeToggle
          label={`Rule ${n} excluding`}
          on={rule.exclude}
          onChange={(exclude) => onChange({ ...rule, exclude })}
        />
        <button
          type="button"
          aria-label={`Remove rule ${n}`}
          onClick={onRemove}
          className="rounded-full p-1.5 text-default-500 hover:bg-danger/10 hover:text-danger"
        >
          <Icon name="ph:trash" width={14} height={14} />
        </button>
      </div>
      {def?.key ? (
        <BoltText
          label={`Rule ${n} ${def.key.label}`}
          placeholder={def.key.placeholder}
          value={rule.key}
          onChange={(key) => onChange({ ...rule, key })}
        />
      ) : null}
      <div className="flex flex-col gap-2">
        <SelectField
          compact
          label={`Rule ${n} operator`}
          hideLabel
          className="w-full"
          value={rule.op}
          options={ops.map((op) => ({ value: op, label: RULE_OP_LABELS[op] }))}
          onValueChange={(op) => onChange({ ...rule, op: op as RuleOp })}
        />
        {valueless ? null : (
          <BoltText
            label={`Rule ${n} value`}
            placeholder={rule.op === "isIn" || rule.op === "isNotIn" ? "a, b, c" : "Value"}
            value={dynamicTextOf(rule.value)}
            onChange={(text) => onChange({ ...rule, value: parseDynamicText(text) })}
          />
        )}
      </div>
      {def?.browserOnly ? (
        <p className="text-tiny text-default-500">
          This is only known in the visitor&apos;s browser, so it does not match until browser rules
          are available.
        </p>
      ) : null}
    </li>
  );
}

const SMALL_BUTTON =
  "flex h-7 items-center gap-1 rounded-full px-2.5 text-tiny font-medium text-default-700 transition-colors duration-300 hover:bg-default-200 hover:text-foreground disabled:opacity-40";

function GroupView({
  group,
  depth,
  onChange,
  onRemove
}: {
  group: RuleGroup;
  depth: number;
  onChange: (group: RuleGroup) => void;
  onRemove?: () => void;
}) {
  const setItem = (index: number, item: Rule | RuleGroup | null) =>
    onChange({
      ...group,
      items: group.items.flatMap((existing, i) => (i === index ? (item ? [item] : []) : [existing]))
    });
  return (
    <div
      className={
        "flex flex-col gap-2 rounded-large p-2 " +
        (depth > 1 ? "border border-divider bg-default-50" : "")
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <SelectField
          compact
          label={depth > 1 ? "Group match" : "Match"}
          hideLabel
          className="w-52"
          value={group.match}
          options={[
            { value: "all", label: "All of these (AND)" },
            { value: "any", label: "Any of these (OR)" }
          ]}
          onValueChange={(match) => onChange({ ...group, match: match as "all" | "any" })}
        />
        {onRemove ? (
          <ExcludeToggle
            label="Group excluding"
            on={group.exclude === true}
            onChange={(exclude) => onChange({ ...group, exclude })}
          />
        ) : null}
        <button
          type="button"
          className={SMALL_BUTTON}
          onClick={() => onChange({ ...group, items: [...group.items, newRule()] })}
        >
          <Icon name="ph:plus" width={12} height={12} />
          Rule
        </button>
        <button
          type="button"
          className={SMALL_BUTTON}
          disabled={depth >= MAX_RULE_DEPTH}
          onClick={() =>
            onChange({
              ...group,
              items: [
                ...group.items,
                { ...emptyRuleGroup(crypto.randomUUID()), items: [newRule()] }
              ]
            })
          }
        >
          <Icon name="ph:plus" width={12} height={12} />
          Group
        </button>
        {onRemove ? (
          <button type="button" className={SMALL_BUTTON + " ml-auto"} onClick={onRemove}>
            <Icon name="ph:trash" width={12} height={12} />
            Remove group
          </button>
        ) : null}
      </div>
      {group.items.length === 0 ? (
        <p className="px-1 text-tiny text-default-500">No rules: this applies everywhere.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {group.items.map((item, index) =>
            isRuleGroup(item) ? (
              <li key={item.id}>
                <GroupView
                  group={item}
                  depth={depth + 1}
                  onChange={(next) => setItem(index, next)}
                  onRemove={() => setItem(index, null)}
                />
              </li>
            ) : (
              <RuleRow
                key={item.id}
                rule={item}
                index={index}
                onChange={(next) => setItem(index, next)}
                onRemove={() => setItem(index, null)}
              />
            )
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * Where something applies. Rules compare a piece of data with a value; groups join them with AND
 * (all) or OR (any) and can nest. An empty set applies everywhere.
 */
export function RuleBuilder({
  value,
  onChange
}: {
  value: RuleGroup;
  onChange: (value: RuleGroup) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section aria-label="Conditions" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-small text-default-600">Conditions</h3>
        <button
          type="button"
          aria-label={open ? "Collapse conditions" : "Expand conditions"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="rounded p-1 text-default-600 hover:text-foreground"
        >
          {open ? (
            <Icon name="ph:minus-circle" width={16} height={16} />
          ) : (
            <Icon name="ph:plus" width={16} height={16} />
          )}
        </button>
      </div>
      {open ? (
        <>
          <GroupView group={value} depth={1} onChange={onChange} />
          {needsBrowser(value) ? (
            <p className="text-tiny text-default-500">
              Some rules need the visitor&apos;s browser and are not applied on the server yet.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
