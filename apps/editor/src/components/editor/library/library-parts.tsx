"use client";

import { Chip } from "@heroui/react";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger
} from "@/components/ui/menu";
import { TEMPLATE_TYPE_LABELS } from "@nextomic/schema";
import { Icon } from "@/lib/icons/Icon";
import type { LibraryItem, LibraryStatus } from "@/server/library";
import { STATUS_LABEL } from "./library-filter";

const STATUS_COLOR: Record<LibraryStatus, "default" | "success" | "warning" | "accent"> = {
  draft: "default",
  published: "success",
  modified: "warning",
  scheduled: "accent"
};

const STATUS_TIP: Record<LibraryStatus, string> = {
  draft: "Draft: not going out when the project is published.",
  published: "Published: live, and unchanged since it was published.",
  modified: "Modified: live, but the draft has changed since it was published.",
  scheduled: "Scheduled: goes live at the time set in its settings."
};

/** The status as a colored HeroUI chip; hovering says what the status means. */
export function StatusChip({ status }: { status: LibraryStatus }) {
  return (
    <Chip size="sm" variant="soft" color={STATUS_COLOR[status]} data-tip={STATUS_TIP[status]}>
      <Chip.Label>{STATUS_LABEL[status]}</Chip.Label>
    </Chip>
  );
}

/** What the lock says: the page needs a signed-in visitor, and whether that is enforced yet. */
export const authTip = (authOn: boolean): string =>
  authOn
    ? "Sign-in required: visitors who are not signed in are sent to the sign-in page."
    : "Sign-in required is turned on for this page, but it has no effect until app sign-in is turned on in App Settings.";

/** A round lock badge for a page that requires sign-in; null for any other item. */
export function AuthBadge({ item, authOn }: { item: LibraryItem; authOn: boolean }) {
  if (!item.requiresAuth) return null;
  return (
    <span
      role="img"
      aria-label={authTip(authOn)}
      data-tip={authTip(authOn)}
      className={
        "flex h-6 w-6 items-center justify-center rounded-full border backdrop-blur " +
        (authOn
          ? "border-accent/40 bg-accent/15 text-accent"
          : "border-border bg-surface/80 text-muted")
      }
    >
      <Icon name="ph:lock-simple" width={13} height={13} />
    </span>
  );
}

export const itemSubtitle = (item: LibraryItem): string =>
  item.kind === "page" ? (item.route ?? "/") : item.type ? TEMPLATE_TYPE_LABELS[item.type] : "";

export type RowAction =
  | "edit"
  | "rename"
  | "duplicate"
  | "preview"
  | "preview-tab"
  | "status"
  | "screenshot"
  | "delete";

/** The status action reads as the thing it will do. */
export const statusActionLabel = (item: LibraryItem): string => {
  if (!item.live) return "Publish";
  return item.status === "published" || item.status === "modified"
    ? "Unpublish (set to draft)"
    : "Set to draft";
};

const ICON_BUTTON =
  "flex h-8 w-8 items-center justify-center rounded-full text-body transition-colors duration-300 hover:bg-default-hover hover:text-foreground disabled:opacity-40";

const ICON_SIZE = { width: 16, height: 16 } as const;

/** The one menu of an item, used by the grid card and the list row alike. */
export function ItemMenu({
  item,
  disabled,
  onAction
}: {
  item: LibraryItem;
  disabled?: boolean;
  onAction: (action: RowAction) => void;
}) {
  return (
    <Dropdown>
      <DropdownTrigger>
        <button
          type="button"
          aria-label={`More actions for ${item.name}`}
          disabled={disabled}
          className={ICON_BUTTON}
        >
          <Icon name="ph:dots-three-vertical" width={18} height={18} />
        </button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label={`Actions for ${item.name}`}
        onAction={(k) => onAction(k as RowAction)}
      >
        <DropdownSection showDivider>
          <DropdownItem id="edit" startContent={<Icon name="ph:pencil-simple" {...ICON_SIZE} />}>
            Edit
          </DropdownItem>
          <DropdownItem id="rename" startContent={<Icon name="ph:text-aa" {...ICON_SIZE} />}>
            Rename
          </DropdownItem>
          <DropdownItem id="duplicate" startContent={<Icon name="ph:copy" {...ICON_SIZE} />}>
            Duplicate
          </DropdownItem>
        </DropdownSection>
        <DropdownSection showDivider>
          <DropdownItem id="preview" startContent={<Icon name="ph:eye" {...ICON_SIZE} />}>
            Preview
          </DropdownItem>
          <DropdownItem
            id="preview-tab"
            startContent={<Icon name="ph:arrow-square-out" {...ICON_SIZE} />}
          >
            Open preview in new tab
          </DropdownItem>
        </DropdownSection>
        <DropdownSection showDivider>
          <DropdownItem
            id="status"
            startContent={
              item.live ? (
                <Icon name="ph:eye-slash" {...ICON_SIZE} />
              ) : (
                <Icon name="ph:export" {...ICON_SIZE} />
              )
            }
          >
            {statusActionLabel(item)}
          </DropdownItem>
          <DropdownItem id="screenshot" startContent={<Icon name="ph:image" {...ICON_SIZE} />}>
            Regenerate screenshot
          </DropdownItem>
        </DropdownSection>
        <DropdownSection>
          <DropdownItem
            id="delete"
            color="danger"
            startContent={<Icon name="ph:trash" {...ICON_SIZE} />}
          >
            Delete
          </DropdownItem>
        </DropdownSection>
      </DropdownMenu>
    </Dropdown>
  );
}

/** Edit and delete as icons with the menu on the right, for the selected item. */
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
        <Icon name="ph:pencil-simple" {...ICON_SIZE} />
      </button>
      <button
        type="button"
        aria-label={`Delete ${item.name}`}
        title="Delete"
        disabled={disabled}
        onClick={() => onAction("delete")}
        className={`${ICON_BUTTON} hover:!bg-danger/10 hover:!text-danger`}
      >
        <Icon name="ph:trash" {...ICON_SIZE} />
      </button>
      <span className="ml-auto">
        <ItemMenu item={item} disabled={disabled} onAction={onAction} />
      </span>
    </div>
  );
}

/** The menu of a row in the list view. */
export function RowMenu({
  item,
  onAction
}: {
  item: LibraryItem;
  onAction: (action: RowAction) => void;
}) {
  return <ItemMenu item={item} onAction={onAction} />;
}
