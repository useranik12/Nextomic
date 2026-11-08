"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { getElementDefinition } from "@nextomic/renderer";
import {
  activeQuery,
  expressionScope,
  firstExpressionProblem,
  QUERY_SOURCE_LABELS,
  withLoopScope,
  type ElementNode,
  type LoopFrame
} from "@nextomic/schema";
import { memo, useMemo, useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { ROOT_END_ID, useDropTarget } from "./dnd";
import { ElementIcon } from "./icons";
import { RenameField } from "./rename-field";
import { useEditorStore } from "./store/editor-store";
import { useEditorDynamicContext } from "./use-editor-context";

const NOT_OWN = new Set(["children"]);
/** Loop values while checking tags (rows are fetched live; any field may be read). */
const LOOP_SAMPLE: LoopFrame = { item: {}, index: 0 };

interface Row {
  node: ElementNode;
  depth: number;
  hasChildren: boolean;
}

function flatten(
  node: ElementNode,
  collapsed: ReadonlySet<string>,
  depth: number,
  out: Row[]
): Row[] {
  for (const child of node.children) {
    out.push({ node: child, depth, hasChildren: child.children.length > 0 });
    if (!collapsed.has(child.id)) flatten(child, collapsed, depth + 1, out);
  }
  return out;
}

const NavigatorRow = memo(function NavigatorRow({
  row,
  selected,
  collapsed,
  problem,
  onToggle
}: {
  row: Row;
  selected: boolean;
  collapsed: boolean;
  /** Why a dynamic tag of this element does not work, if one does not. */
  problem: string | null;
  onToggle: (id: string) => void;
}) {
  const { node, depth, hasChildren } = row;
  const select = useEditorStore((s) => s.select);
  const duplicate = useEditorStore((s) => s.duplicateElement);
  const remove = useEditorStore((s) => s.removeElement);
  const openContextMenu = useEditorStore((s) => s.openContextMenu);
  const [renaming, setRenaming] = useState(false);
  const drop = useDropTarget();
  const draggable = useDraggable({ id: node.id });
  const droppable = useDroppable({ id: node.id });
  const dropZone = drop?.id === node.id ? drop.zone : null;
  const label = node.name ?? getElementDefinition(node.type)?.label ?? node.type;
  const query = activeQuery(node);

  return (
    <div
      ref={(el) => {
        draggable.setNodeRef(el);
        droppable.setNodeRef(el);
      }}
      role="treeitem"
      aria-selected={selected}
      aria-expanded={hasChildren ? !collapsed : undefined}
      aria-level={depth + 1}
      style={{ paddingLeft: depth * 14 + 4 }}
      onContextMenu={(event) => {
        event.preventDefault();
        openContextMenu(event.clientX, event.clientY, node.id);
      }}
      className={
        "group relative flex h-8 items-center gap-1 rounded-medium pr-1 text-small transition-colors duration-300 " +
        (selected ? "bg-default-200 text-foreground" : "text-default-600 hover:bg-default-100") +
        (draggable.isDragging ? " opacity-40" : node.hidden ? " opacity-50" : "") +
        (dropZone === "inside" ? " ring-1 ring-primary" : "")
      }
    >
      {dropZone === "before" || dropZone === "after" ? (
        <span
          className={`pointer-events-none absolute inset-x-1 h-0.5 rounded bg-primary ${dropZone === "before" ? "top-0" : "bottom-0"}`}
        />
      ) : null}
      <button
        type="button"
        aria-label={collapsed ? "Expand" : "Collapse"}
        tabIndex={hasChildren ? 0 : -1}
        onClick={() => onToggle(node.id)}
        className={`flex h-5 w-5 items-center justify-center rounded ${hasChildren ? "" : "invisible"}`}
      >
        <Icon
          name="ph:caret-right"
          width={12}
          height={12}
          className={collapsed ? "" : "rotate-90"}
        />
      </button>
      {renaming ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <ElementIcon type={node.type} size={16} />
          <RenameField
            node={node}
            fallback={label}
            autoFocus
            className="text-small text-foreground"
            onDone={() => setRenaming(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => select(node.id)}
          className="flex min-w-0 flex-1 cursor-grab items-center gap-2 text-left outline-none focus-visible:ring-1 focus-visible:ring-default-800"
          {...draggable.attributes}
          {...draggable.listeners}
        >
          <ElementIcon type={node.type} size={16} />
          <span className="truncate">{label}</span>
          {problem ? (
            <span
              role="img"
              aria-label={`Invalid dynamic data: ${problem}`}
              title={`Invalid dynamic data: ${problem}`}
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger"
            />
          ) : null}
          {node.hidden ? (
            <Icon name="ph:eye-slash" width={12} height={12} className="shrink-0" />
          ) : null}
          {query ? (
            <span
              role="img"
              aria-label={`Query loop: ${QUERY_SOURCE_LABELS[query.source]}`}
              title={`Query loop: ${QUERY_SOURCE_LABELS[query.source]}`}
              className="ml-auto shrink-0 text-orange-500 dark:text-orange-400"
            >
              <Icon name="ph:database" width={14} height={14} />
            </span>
          ) : null}
        </button>
      )}
      <span className="hidden items-center group-focus-within:flex group-hover:flex">
        <button
          type="button"
          aria-label={`Duplicate ${label}`}
          onClick={() => duplicate(node.id)}
          className="rounded p-1 text-default-500 hover:text-foreground"
        >
          <Icon name="ph:copy" width={14} height={14} />
        </button>
        <button
          type="button"
          aria-label={`Rename ${label}`}
          onClick={() => setRenaming(true)}
          className="rounded p-1 text-default-500 hover:text-foreground"
        >
          <Icon name="ph:pencil-simple" width={14} height={14} />
        </button>
        <button
          type="button"
          aria-label={`Delete ${label}`}
          onClick={() => remove(node.id)}
          className="rounded p-1 text-default-500 hover:text-danger"
        >
          <Icon name="ph:trash" width={14} height={14} />
        </button>
      </span>
    </div>
  );
});

export function Navigator({
  onOpenElements,
  onResetSizes
}: {
  onOpenElements: () => void;
  onResetSizes: () => void;
}) {
  const tree = useEditorStore((s) => s.doc?.tree ?? null);
  const selectedId = useEditorStore((s) => s.selectedId);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const select = useEditorStore((s) => s.select);
  const rootEnd = useDroppable({ id: ROOT_END_ID });
  const drop = useDropTarget();

  // Every element that has children can fold; the toggle folds all or opens all.
  const foldable = useMemo(() => {
    const ids: string[] = [];
    const visit = (n: ElementNode) =>
      n.children.forEach((c) => {
        if (c.children.length > 0) ids.push(c.id);
        visit(c);
      });
    if (tree) visit(tree);
    return ids;
  }, [tree]);
  const allCollapsed = foldable.length > 0 && foldable.every((id) => collapsed.has(id));

  const rows = useMemo(() => (tree ? flatten(tree, collapsed, 0, []) : []), [tree, collapsed]);

  // Elements whose {{tags}} would give nothing on the page: a red dot says so. Loop values (item,
  // index) exist only inside a query loop's descendants, so a tag outside one is marked too.
  const dynamic = useEditorDynamicContext();
  const problems = useMemo(() => {
    const found = new Map<string, string>();
    if (!tree || !dynamic) return found;
    const base = expressionScope(dynamic);
    const visit = (node: ElementNode, frames: LoopFrame[]) => {
      const problem = firstExpressionProblem(node, withLoopScope(base, frames), NOT_OWN);
      if (problem) found.set(node.id, problem);
      const inner = activeQuery(node) ? [LOOP_SAMPLE, ...frames] : frames;
      node.children.forEach((child) => visit(child, inner));
    };
    visit(tree, []);
    return found;
  }, [tree, dynamic]);

  function toggle(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="text-small font-medium text-foreground">Navigator</h2>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label={allCollapsed ? "Expand all elements" : "Collapse all elements"}
            title={allCollapsed ? "Expand all elements" : "Collapse all elements"}
            disabled={foldable.length === 0}
            onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(foldable))}
            className="rounded-medium p-1.5 text-default-600 hover:bg-default-100 hover:text-foreground disabled:opacity-40"
          >
            {allCollapsed ? (
              <Icon name="ph:arrows-out-line-vertical" width={16} height={16} />
            ) : (
              <Icon name="ph:arrows-in-line-vertical" width={16} height={16} />
            )}
          </button>
          <button
            type="button"
            aria-label="Reset side panel sizes"
            title="Reset the width of the side panels"
            onClick={onResetSizes}
            className="rounded-medium p-1.5 text-default-600 hover:bg-default-100 hover:text-foreground"
          >
            <Icon name="ph:arrows-in-line-horizontal" width={16} height={16} />
          </button>
          <button
            type="button"
            aria-label="Add element"
            onClick={onOpenElements}
            className="rounded-medium p-1.5 text-default-600 hover:bg-default-100 hover:text-foreground"
          >
            <Icon name="ph:plus" width={16} height={16} />
          </button>
        </div>
      </div>
      <div
        role="tree"
        aria-label="Page elements"
        // Blank space in the tree selects the page.
        onClick={(event) => {
          if (!(event.target as HTMLElement).closest("[role=treeitem]")) select(null);
        }}
        className="min-h-0 flex-1 overflow-y-auto px-2 pb-2"
      >
        {rows.map((row) => (
          <NavigatorRow
            key={row.node.id}
            row={row}
            selected={row.node.id === selectedId}
            collapsed={collapsed.has(row.node.id)}
            problem={problems.get(row.node.id) ?? null}
            onToggle={toggle}
          />
        ))}
        <div
          ref={rootEnd.setNodeRef}
          className={
            "mt-1 flex min-h-16 items-center justify-center rounded-medium border border-dashed text-tiny text-default-500 " +
            (drop?.id === ROOT_END_ID ? "border-primary text-primary" : "border-default-200")
          }
        >
          {rows.length === 0 ? "Click + or drag an element here" : "Drop here to add at the end"}
        </div>
      </div>
    </div>
  );
}
