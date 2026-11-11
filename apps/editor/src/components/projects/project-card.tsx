"use client";

import type { Project } from "@nextomic/schema";
import { buttonVariants, Dropdown, Label } from "@heroui/react";
import { useRouter } from "next/navigation";
import { formatOrdinalDate } from "@/lib/format";
import { Icon } from "@/lib/icons/Icon";

// Shown per the design but built in later phases (docs/phases.md): visible, disabled, with a hint.
const LATER_ACTIONS = [
  { key: "duplicate", label: "Duplicate", icon: "ph:copy" },
  { key: "export", label: "Export", icon: "ph:export" },
  { key: "backup", label: "Backup now", icon: "ph:clock-counter-clockwise" },
  { key: "settings", label: "Settings", icon: "ph:gear-six" }
] as const;

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
    <div className="group/card flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-colors duration-150 hover:border-default-hover">
      <button
        type="button"
        className="flex aspect-video w-full items-center justify-center bg-surface-secondary text-subtle outline-none transition-colors duration-150 group-hover/card:text-muted focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
        onClick={() => router.push(`/editor/${project.id}`)}
        aria-label={`Open ${project.name}`}
      >
        <Icon name="ph:stack" />
      </button>
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{project.name}</p>
          <p className="text-xs text-muted">
            Last modified: {formatOrdinalDate(project.lastModifiedAt)}
          </p>
        </div>
        <Dropdown>
          <Dropdown.Trigger
            aria-label={`${project.name} actions`}
            className={
              buttonVariants({ variant: "ghost", size: "sm", isIconOnly: true }) + " h-8 w-8"
            }
          >
            <Icon name="ph:dots-three-vertical" label="Actions" />
          </Dropdown.Trigger>
          <Dropdown.Popover placement="bottom end" className="min-w-44">
            <Dropdown.Menu
              aria-label="Project actions"
              onAction={(key) => handleAction(String(key))}
            >
              <Dropdown.Item id="rename" textValue="Rename">
                <Icon name="ph:pencil-simple" className="text-muted" />
                <Label>Rename</Label>
              </Dropdown.Item>
              {LATER_ACTIONS.map((action) => (
                <Dropdown.Item
                  key={action.key}
                  id={action.key}
                  textValue={action.label}
                  isDisabled
                  className="data-[disabled=true]:pointer-events-auto"
                >
                  <Icon name={action.icon} className="text-muted" />
                  <Label data-tip="Available in a later phase">{action.label}</Label>
                </Dropdown.Item>
              ))}
              <Dropdown.Item id="delete" textValue="Delete" variant="danger">
                <Icon name="ph:trash" />
                <Label>Delete</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>
    </div>
  );
}
