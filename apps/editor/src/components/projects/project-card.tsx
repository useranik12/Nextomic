"use client";

import type { Project } from "@nextomic/schema";
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Tooltip
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { formatOrdinalDate } from "@/lib/format";
import { Icon } from "@/lib/icons/Icon";

const DISABLED_ACTIONS = new Set(["duplicate", "export", "backup", "settings"]);

export interface ProjectCardProps {
  project: Project;
  onRename: (project: Project) => void;
  onDelete: (project: Project) => void;
}

export function ProjectCard({ project, onRename, onDelete }: ProjectCardProps) {
  const router = useRouter();

  function handleAction(key: string) {
    if (key === "rename") return onRename(project);
    if (key === "delete") return onDelete(project);
    // duplicate/export/backup/settings are shown per the design but not built until their
    // own phase (see docs/phases.md) — the menu item is disabled, so this should not fire.
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-large border border-divider bg-content1">
      <button
        type="button"
        className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-content2 to-content3 text-default-400"
        onClick={() => router.push(`/editor/${project.id}`)}
        aria-label={`Open ${project.name}`}
      >
        <Icon name="ph:stack" />
      </button>
      <div className="flex items-center justify-between gap-2 bg-content2 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{project.name}</p>
          <p className="text-small text-default-500">
            Last modified: {formatOrdinalDate(project.lastModifiedAt)}
          </p>
        </div>
        <Dropdown>
          <DropdownTrigger>
            <Button isIconOnly variant="light" size="sm" aria-label={`${project.name} actions`}>
              <Icon name="ph:dots-three-vertical" label="Actions" />
            </Button>
          </DropdownTrigger>
          <DropdownMenu aria-label="Project actions" onAction={(key) => handleAction(String(key))}>
            <DropdownItem key="rename" startContent={<Icon name="ph:pencil-simple" />}>
              Rename
            </DropdownItem>
            <DropdownItem key="duplicate" isDisabled={DISABLED_ACTIONS.has("duplicate")}>
              <Tooltip content="Available in a later phase">
                <span>Duplicate</span>
              </Tooltip>
            </DropdownItem>
            <DropdownItem
              key="export"
              isDisabled={DISABLED_ACTIONS.has("export")}
              startContent={<Icon name="ph:export" />}
            >
              <Tooltip content="Available in a later phase">
                <span>Export</span>
              </Tooltip>
            </DropdownItem>
            <DropdownItem
              key="backup"
              isDisabled={DISABLED_ACTIONS.has("backup")}
              startContent={<Icon name="ph:clock-counter-clockwise" />}
            >
              <Tooltip content="Available in a later phase">
                <span>Backup now</span>
              </Tooltip>
            </DropdownItem>
            <DropdownItem
              key="settings"
              isDisabled={DISABLED_ACTIONS.has("settings")}
              startContent={<Icon name="ph:gear-six" />}
            >
              <Tooltip content="Available in a later phase">
                <span>Settings</span>
              </Tooltip>
            </DropdownItem>
            <DropdownItem
              key="delete"
              color="danger"
              className="text-danger"
              startContent={<Icon name="ph:trash" />}
            >
              Delete
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>
    </div>
  );
}
