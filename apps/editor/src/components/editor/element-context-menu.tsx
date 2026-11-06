"use client";

import { getElementDefinition } from "@nextomic/renderer";
import { findNode } from "@nextomic/schema";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "./store/editor-store";

const MENU_WIDTH = 240;
const EDGE = 8;

const itemClass =
  "flex h-8 w-full items-center gap-2 rounded-medium px-2.5 text-left text-small text-foreground outline-none transition-colors duration-300 hover:bg-default-100 focus-visible:bg-default-100 disabled:cursor-not-allowed disabled:text-default-400 disabled:hover:bg-transparent";

function Item({
  children,
  onPress,
  disabled,
  danger
}: {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onPress}
      className={itemClass + (danger ? " !text-danger" : "")}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div role="separator" className="my-1 h-px bg-divider" />;
}

function MoveButton({
  label,
  disabled,
  onPress,
  children
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onPress}
      className="flex h-7 w-7 items-center justify-center rounded-medium bg-default-100 text-foreground outline-none transition-colors duration-300 hover:bg-default-200 focus-visible:ring-2 focus-visible:ring-default-800 disabled:cursor-not-allowed disabled:text-default-300 disabled:hover:bg-default-100"
    >
      {children}
    </button>
  );
}

/**
 * Right-click menu for an element, opened from the canvas or the Navigator. It acts on the
 * element the click landed on, which the store has already selected.
 */
export function ElementContextMenu() {
  const menu = useEditorStore((s) => s.contextMenu);
  const close = useEditorStore((s) => s.closeContextMenu);
  const tree = useEditorStore((s) => s.doc?.tree ?? null);
  const hasClipboard = useEditorStore((s) => s.clipboard !== null);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  // Keep the menu inside the window.
  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const height = ref.current.offsetHeight;
    setPos({
      left: Math.max(EDGE, Math.min(menu.x, window.innerWidth - MENU_WIDTH - EDGE)),
      top: Math.max(EDGE, Math.min(menu.y, window.innerHeight - height - EDGE))
    });
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    ref.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) close();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
    };
  }, [menu, close]);

  const found = menu && tree ? findNode(tree, menu.id) : null;
  if (!menu || !found?.parent) return null;

  const { node, parent, index } = found;
  const store = useEditorStore.getState();
  const label = node.name ?? getElementDefinition(node.type)?.label ?? node.type;
  const previous = parent.children[index - 1];
  const canIndent = !!previous && (getElementDefinition(previous.type)?.canHaveChildren ?? false);
  const parentIsRoot = parent.id === tree?.id;

  function run(action: () => void) {
    action();
    close();
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`${label} actions`}
      style={{ left: pos.left, top: pos.top, width: MENU_WIDTH }}
      onContextMenu={(event) => event.preventDefault()}
      className="fixed z-[100] max-h-[calc(100vh-16px)] overflow-y-auto rounded-large border border-divider bg-content1 p-1.5 shadow-large"
    >
      <div className="flex items-center justify-between px-2.5 py-1">
        <span className="text-small font-medium text-foreground">Move</span>
        <span className="flex gap-1">
          <MoveButton
            label="Move out of parent"
            disabled={parentIsRoot}
            onPress={() => run(() => store.shiftElement(node.id, "out"))}
          >
            <Icon name="ph:arrow-left" width={14} height={14} />
          </MoveButton>
          <MoveButton
            label="Move into previous sibling"
            disabled={!canIndent}
            onPress={() => run(() => store.shiftElement(node.id, "in"))}
          >
            <Icon name="ph:arrow-right" width={14} height={14} />
          </MoveButton>
          <MoveButton
            label="Move up"
            disabled={index === 0}
            onPress={() => run(() => store.shiftElement(node.id, "up"))}
          >
            <Icon name="ph:arrow-up" width={14} height={14} />
          </MoveButton>
          <MoveButton
            label="Move down"
            disabled={index >= parent.children.length - 1}
            onPress={() => run(() => store.shiftElement(node.id, "down"))}
          >
            <Icon name="ph:arrow-down" width={14} height={14} />
          </MoveButton>
        </span>
      </div>
      <Divider />
      <Item onPress={() => run(() => store.select(parent.id === tree?.id ? null : parent.id))}>
        Select parent
      </Item>
      <Divider />
      <Item onPress={() => run(() => store.copyElement(node.id))}>
        <Icon name="ph:clipboard" width={14} height={14} />
        Copy
      </Item>
      <Item disabled={!hasClipboard} onPress={() => run(() => store.pasteElement())}>
        Paste
      </Item>
      <Item onPress={() => run(() => store.duplicateElement(node.id))}>
        <Icon name="ph:copy" width={14} height={14} />
        Duplicate
      </Item>
      <Item danger onPress={() => run(() => store.removeElement(node.id))}>
        <Icon name="ph:trash" width={14} height={14} />
        Delete
      </Item>
      <Divider />
      <Item onPress={() => run(() => store.toggleElementHidden(node.id))}>
        <Icon name={node.hidden ? "ph:eye" : "ph:eye-slash"} width={14} height={14} />
        {node.hidden ? "Show element" : "Hide element"}
      </Item>
      <Item onPress={() => run(() => store.wrapElement(node.id))}>
        <Icon name="ph:stack" width={14} height={14} />
        Wrap (Container)
      </Item>
      <Item
        disabled={node.children.length === 0}
        onPress={() => run(() => store.unwrapElement(node.id))}
      >
        Unwrap
      </Item>
    </div>
  );
}
