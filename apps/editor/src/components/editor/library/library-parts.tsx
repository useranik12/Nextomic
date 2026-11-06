"use client";

import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import { TEMPLATE_TYPE_LABELS } from "@nextomic/schema";
import { Icon } from "@/lib/icons/Icon";
import type { LibraryItem, LibraryStatus } from "@/server/library";
import { STATUS_LABEL } from "./library-filter";

const STATUS_STYLE: Record<LibraryStatus, { chip: string; dot: string }> = {
  draft: { chip: "bg-default-200 text-default-700", dot: "bg-default-500" },
  published: { chip: "bg-success/15 text-success-600", dot: "bg-success" },
  modified: { chip: "bg-warning/20 text-warning-700 dark:text-warning", dot: "bg-warning" }
};

export function StatusChip({ status }: { status: LibraryStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-tiny font-medium ${style.chip}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export const itemSubtitle = (item: LibraryItem): string =>
  item.kind === "page" ? (item.route ?? "/") : item.type ? TEMPLATE_TYPE_LABELS[item.type] : "";

export type RowAction = "edit" | "duplicate" | "status" | "screenshot" | "delete";

/** The status action reads as the thing it will do. */
export const statusActionLabel = (item: LibraryItem): string =>
  item.kind === "page"
    ? item.live
      ? "Leave out of publishing"
      : "Include in publishing"
    : item.live
      ? "Change to draft"
      : "Publish template";

const ICON_BUTTON =
  "flex h-8 w-8 items-center justify-center rounded-full text-default-600 transition-colors duration-300 hover:bg-default-200 hover:text-foreground disabled:opacity-40";

/** Edit, status change and delete as icons, for the selected item. */
export function ActionIcons({
  item,
  disabled,
  onAction
}: {
  item: LibraryItem;
  disabled?: boolean;
  onAction: (action: RowAction) => void;
}) {
  return (
    <div role="toolbar" aria-label={`Actions for ${item.name}`} className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`Edit ${item.name}`}
        title="Edit"
        disabled={disabled}
        onClick={() => onAction("edit")}
        className={ICON_BUTTON}
      >
        <Icon name="ph:pencil-simple" width={16} height={16} />
      </button>
      <button
        type="button"
        aria-label={`${statusActionLabel(item)}: ${item.name}`}
        title={statusActionLabel(item)}
        disabled={disabled}
        onClick={() => onAction("status")}
        className={ICON_BUTTON}
      >
        {item.live ? (
          <Icon name="ph:eye-slash" width={16} height={16} />
        ) : (
          <Icon name="ph:eye" width={16} height={16} />
        )}
      </button>
      <button
        type="button"
        aria-label={`Delete ${item.name}`}
        title="Delete"
        disabled={disabled}
        onClick={() => onAction("delete")}
        className={`${ICON_BUTTON} hover:!bg-danger/10 hover:!text-danger`}
      >
        <Icon name="ph:trash" width={16} height={16} />
      </button>
    </div>
  );
}

/** The three-dot menu of a row in the column view. */
export function RowMenu({
  item,
  onAction
}: {
  item: LibraryItem;
  onAction: (action: RowAction) => void;
}) {
  return (
    <Dropdown>
      <DropdownTrigger>
        <button type="button" aria-label={`More actions for ${item.name}`} className={ICON_BUTTON}>
          <Icon name="ph:dots-three-vertical" width={18} height={18} />
        </button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label={`Actions for ${item.name}`}
        onAction={(k) => onAction(k as RowAction)}
      >
        <DropdownItem key="edit">Edit</DropdownItem>
        <DropdownItem key="duplicate">Duplicate</DropdownItem>
        <DropdownItem key="status">{statusActionLabel(item)}</DropdownItem>
        <DropdownItem key="screenshot">Regenerate screenshot</DropdownItem>
        <DropdownItem key="delete" className="text-danger" color="danger">
          Delete
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
