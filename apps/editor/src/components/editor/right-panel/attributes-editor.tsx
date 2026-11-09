"use client";

import {
  ATTRIBUTE_NAME_PATTERN,
  dynamicTextOf,
  isAllowedAttribute,
  parseDynamicText,
  type ElementNode,
  tagText
} from "@nextomic/schema";
import { useId, useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../store/editor-store";
import { DynamicBolt } from "./dynamic-bolt";
import { compactFieldClass } from "./setting-row";

function nameProblem(name: string, existing: string[]): string | null {
  if (name === "") return null;
  if (!ATTRIBUTE_NAME_PATTERN.test(name)) return "Use lowercase letters, numbers and dashes.";
  if (existing.includes(name)) return "This attribute is already set.";
  if (!isAllowedAttribute(name)) {
    return "This attribute is not allowed. Use aria-*, data-* or a standard HTML attribute.";
  }
  return null;
}

/**
 * HTML attributes of the element. Values take dynamic tags. Other elements and flows read them with
 * {{attr.NAME@ELEMENT_ID}}; setting any attribute gives the element an ID if it has none.
 */
export function AttributesEditor({ node }: { node: ElementNode }) {
  const set = useEditorStore((s) => s.setElementAttribute);
  const remove = useEditorStore((s) => s.removeElementAttribute);
  const rename = useEditorStore((s) => s.renameElementAttribute);
  const names = Object.keys(node.attributes ?? {});
  const [draftName, setDraftName] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const nameId = useId();
  const problem = nameProblem(draftName.trim(), names);
  const canAdd = draftName.trim() !== "" && problem === null;

  function add() {
    if (!canAdd) return;
    set(node.id, draftName.trim(), parseDynamicText(draftValue));
    setDraftName("");
    setDraftValue("");
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-small text-default-600">
        {node.htmlId ? (
          <>
            Read an attribute elsewhere with{" "}
            <code className="font-mono">{`{{ attr @ ${node.htmlId}:name }}`}</code>.
          </>
        ) : (
          "Adding an attribute gives this element an ID, so other settings can read it."
        )}
      </p>
      {names.length === 0 ? (
        <p className="text-small text-default-500">No attributes yet.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {names.map((name) => (
            <AttributeRow
              key={name}
              node={node}
              name={name}
              names={names}
              onValue={(text) => set(node.id, name, parseDynamicText(text))}
              onRename={(to) => rename(node.id, name, to)}
              onRemove={() => remove(node.id, name)}
            />
          ))}
        </ul>
      )}
      <form
        className="flex flex-col gap-2 rounded-large bg-default-100 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label htmlFor={nameId} className="text-small font-semibold text-foreground">
          New attribute
        </label>
        <input
          id={nameId}
          value={draftName}
          placeholder="name, e.g. aria-label"
          aria-invalid={problem !== null}
          onChange={(e) => setDraftName(e.target.value)}
          className={compactFieldClass}
        />
        {problem ? (
          <p role="alert" className="text-tiny text-danger">
            {problem}
          </p>
        ) : null}
        <div className="relative">
          <input
            aria-label="New attribute value"
            value={draftValue}
            placeholder="value"
            onChange={(e) => setDraftValue(e.target.value)}
            className={compactFieldClass + " pr-9"}
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
            <DynamicBolt
              label="New attribute value"
              onInsert={(t) => setDraftValue(`${draftValue}${tagText(t)}`)}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={!canAdd}
          className="flex h-8 items-center justify-center gap-1.5 rounded-full bg-default-200 px-3 text-small font-medium text-foreground transition-colors hover:bg-default-300 disabled:opacity-50"
        >
          <Icon name="ph:plus" width={14} height={14} />
          Add attribute
        </button>
      </form>
    </div>
  );
}

function AttributeRow({
  node,
  name,
  names,
  onValue,
  onRename,
  onRemove
}: {
  node: ElementNode;
  name: string;
  names: string[];
  onValue: (text: string) => void;
  onRename: (to: string) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(name);
  const problem = draft === name ? null : nameProblem(draft, names);
  const value = dynamicTextOf(node.attributes?.[name]);
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <input
          aria-label={`Attribute name ${name}`}
          aria-invalid={problem !== null}
          value={draft}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft === name) return;
            if (draft.trim() !== "" && nameProblem(draft.trim(), names) === null) {
              onRename(draft.trim());
            } else setDraft(name);
          }}
          className="h-7 min-w-0 flex-1 bg-transparent font-mono text-small font-semibold text-foreground outline-none focus-visible:underline"
        />
        <button
          type="button"
          aria-label={`Remove attribute ${name}`}
          onClick={onRemove}
          className="rounded p-1 text-default-500 hover:text-danger"
        >
          <Icon name="ph:trash" width={14} height={14} />
        </button>
      </div>
      {problem ? (
        <p role="alert" className="text-tiny text-danger">
          {problem}
        </p>
      ) : null}
      <div className="relative">
        <input
          aria-label={`Value of ${name}`}
          value={value}
          onChange={(e) => onValue(e.target.value)}
          className={compactFieldClass + " pr-9"}
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
          <DynamicBolt
            label={`Value of ${name}`}
            onInsert={(t) => onValue(`${value}${tagText(t)}`)}
          />
        </div>
      </div>
    </li>
  );
}
