"use client";

import {
  ACTION_CATEGORIES,
  actionDisabledReason,
  actionsByCategory,
  type ActionBlock,
  type ActionDef
} from "@nextomic/schema";
import { useState } from "react";
import { InfoTip } from "@/components/ui/info-tip";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../../store/editor-store";

const ITEM =
  "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors duration-300 ";

function ActionItem({ action, onPick }: { action: ActionDef; onPick: () => void }) {
  const themes = useEditorStore((s) => s.project.themes);
  const reason = actionDisabledReason(action, { themes });
  if (reason) {
    return (
      <li className={`${ITEM} cursor-not-allowed text-subtle`} aria-disabled="true">
        <span className="truncate">{action.label}</span>
        <InfoTip text={reason} label={`Why ${action.label} is unavailable`} placement="left" />
      </li>
    );
  }
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className={`${ITEM} text-body hover:bg-default hover:text-foreground`}
        title={action.description}
      >
        <span className="truncate">{action.label}</span>
        <span className="text-xs text-subtle">{action.runs === "server" ? "Server" : ""}</span>
      </button>
    </li>
  );
}

/** Searchable, expandable list of every action; unavailable ones are greyed with the reason. */
export function ActionPicker({
  blocks,
  onPick,
  onPickBlock
}: {
  blocks: readonly ActionBlock[];
  onPick: (type: string) => void;
  onPickBlock: (blockId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const matches = (label: string) => !q || label.toLowerCase().includes(q);

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <input
        type="search"
        aria-label="Search actions"
        placeholder="Search actions"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-9 rounded-xl border border-border bg-transparent px-3 text-sm outline-none focus:border-default-400"
      />
      <ul className="flex flex-col gap-1">
        {ACTION_CATEGORIES.map((category) => {
          const disabled = "disabled" in category ? category.disabled : null;
          const groups =
            category.id === "blocks"
              ? []
              : actionsByCategory(category.id)
                  .map((g) => ({ ...g, actions: g.actions.filter((a) => matches(a.label)) }))
                  .filter((g) => g.actions.length > 0);
          const blockItems = category.id === "blocks" ? blocks.filter((b) => matches(b.name)) : [];
          const count = groups.reduce((n, g) => n + g.actions.length, 0) + blockItems.length;
          if (q && count === 0) return null;
          const expanded = Boolean(q) || open === category.id;
          return (
            <li key={category.id}>
              <button
                type="button"
                aria-expanded={expanded}
                disabled={Boolean(disabled)}
                onClick={() => setOpen(expanded ? null : category.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-foreground hover:bg-default disabled:cursor-not-allowed disabled:text-subtle"
              >
                {expanded ? <Icon name="ph:caret-down" /> : <Icon name="ph:caret-right" />}
                <span className="flex-1">{category.label}</span>
                {disabled ? <InfoTip text={disabled} placement="left" /> : null}
              </button>
              {expanded ? (
                <ul className="ml-4 flex flex-col gap-0.5 border-l border-border pl-2">
                  {category.id === "blocks" && blockItems.length === 0 ? (
                    <li className="px-2 py-1.5 text-xs text-muted">
                      No Action Blocks yet. Create one in the Action Blocks tab.
                    </li>
                  ) : null}
                  {blockItems.map((block) => (
                    <li key={block.id}>
                      <button
                        type="button"
                        onClick={() => onPickBlock(block.id)}
                        className={`${ITEM} text-body hover:bg-default`}
                      >
                        <span className="truncate">{block.name}</span>
                      </button>
                    </li>
                  ))}
                  {groups.map((g) => {
                    if (!g.subcategory) return null;
                    const key = `${category.id}:${g.subcategory}`;
                    const subOpen = Boolean(q) || openSub === key;
                    return (
                      <li key={g.subcategory}>
                        <button
                          type="button"
                          aria-expanded={subOpen}
                          onClick={() => setOpenSub(subOpen ? null : key)}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-body hover:bg-default"
                        >
                          {subOpen ? (
                            <Icon name="ph:caret-down" width={12} height={12} />
                          ) : (
                            <Icon name="ph:caret-right" width={12} height={12} />
                          )}
                          {g.subcategory}
                        </button>
                        {subOpen ? (
                          <ul className="ml-3 border-l border-border pl-2">
                            {g.actions.map((a) => (
                              <ActionItem key={a.type} action={a} onPick={() => onPick(a.type)} />
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                  {groups.map((g) =>
                    g.subcategory
                      ? null
                      : g.actions.map((a) => (
                          <ActionItem key={a.type} action={a} onPick={() => onPick(a.type)} />
                        ))
                  )}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
