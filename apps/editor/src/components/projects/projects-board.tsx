"use client";

import type { Project } from "@nextomic/schema";
import {
  Button,
  ButtonGroup,
  Chip,
  Input,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow
} from "@heroui/react";
import { ActionButton } from "@/components/ui/controls";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  createProjectAction,
  deleteProjectAction,
  renameProjectAction
} from "@/app/(dashboard)/projects/actions";
import { formatOrdinalDate } from "@/lib/format";
import { Icon } from "@/lib/icons/Icon";
import { DeleteProjectModal } from "./delete-project-modal";
import { NewProjectModal } from "./new-project-modal";
import { ProjectCard } from "./project-card";
import { RenameProjectModal } from "./rename-project-modal";

const DATE_RANGES = [
  { key: "all", label: "All time" },
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" }
] as const;

export interface ProjectsBoardProps {
  workspaceName: string;
  initialProjects: Project[];
  openNewProjectOnLoad?: boolean;
}

export function ProjectsBoard({
  workspaceName,
  initialProjects,
  openNewProjectOnLoad = false
}: ProjectsBoardProps) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [query, setQuery] = useState("");
  const [dateRange, setDateRange] = useState<string>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(openNewProjectOnLoad);
  const [projectToRename, setProjectToRename] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const filtered = useMemo(() => {
    const now = Date.now();
    const rangeDays = dateRange === "all" ? null : Number(dateRange);
    return projects.filter((project) => {
      const matchesQuery = project.name.toLowerCase().includes(query.toLowerCase());
      const matchesRange =
        rangeDays === null ||
        now - project.lastModifiedAt.getTime() <= rangeDays * 24 * 60 * 60 * 1000;
      return matchesQuery && matchesRange;
    });
  }, [projects, query, dateRange]);

  async function handleCreate(name: string) {
    const result = await createProjectAction({ name });
    if (result.error || !result.data) throw new Error(result.error ?? "Could not create project.");
    setProjects((prev) => [result.data as Project, ...prev]);
    router.push(`/editor/${result.data.id}`);
  }

  async function handleRename(project: Project, name: string) {
    const result = await renameProjectAction(project.id, name);
    if (result.error) throw new Error(result.error);
    setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, name } : p)));
  }

  async function handleDelete(project: Project) {
    const result = await deleteProjectAction(project.id);
    if (result.error) throw new Error(result.error);
    setProjects((prev) => prev.filter((p) => p.id !== project.id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-semibold text-foreground">All Projects</h2>
        <Chip color="primary" variant="flat">
          {workspaceName}
        </Chip>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search Project"
          value={query}
          onValueChange={setQuery}
          startContent={<Icon name="ph:magnifying-glass" />}
          className="max-w-xs"
          aria-label="Search projects"
        />
        <Select
          aria-label="Date range"
          placeholder="Date Range"
          selectedKeys={[dateRange]}
          onSelectionChange={(keys) => setDateRange(String([...keys][0]))}
          startContent={<Icon name="ph:calendar-blank" />}
          className="w-44"
        >
          {DATE_RANGES.map((range) => (
            <SelectItem key={range.key}>{range.label}</SelectItem>
          ))}
        </Select>
        <ButtonGroup aria-label="View">
          <Button
            isIconOnly
            variant={view === "grid" ? "solid" : "flat"}
            color={view === "grid" ? "primary" : "default"}
            aria-pressed={view === "grid"}
            onPress={() => setView("grid")}
          >
            <Icon name="ph:squares-four" label="Grid view" />
          </Button>
          <Button
            isIconOnly
            variant={view === "list" ? "solid" : "flat"}
            color={view === "list" ? "primary" : "default"}
            aria-pressed={view === "list"}
            onPress={() => setView("list")}
          >
            <Icon name="ph:list" label="List view" />
          </Button>
        </ButtonGroup>
        <ActionButton
          endContent={<Icon name="ph:plus" />}
          onPress={() => setIsNewProjectOpen(true)}
          className="ml-auto"
        >
          New Project
        </ActionButton>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          hasAnyProjects={projects.length > 0}
          onNewProject={() => setIsNewProjectOpen(true)}
        />
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onRename={setProjectToRename}
              onDelete={setProjectToDelete}
            />
          ))}
        </div>
      ) : (
        <Table aria-label="Projects">
          <TableHeader>
            <TableColumn>NAME</TableColumn>
            <TableColumn>LAST MODIFIED</TableColumn>
            <TableColumn> </TableColumn>
          </TableHeader>
          <TableBody>
            {filtered.map((project) => (
              <TableRow key={project.id}>
                <TableCell>
                  <NextLink href={`/editor/${project.id}`} className="hover:underline">
                    {project.name}
                  </NextLink>
                </TableCell>
                <TableCell>{formatOrdinalDate(project.lastModifiedAt)}</TableCell>
                <TableCell>
                  <ActionButton size="sm" tone="ghost" onPress={() => setProjectToRename(project)}>
                    Rename
                  </ActionButton>
                  <ActionButton
                    size="sm"
                    tone="danger-ghost"
                    onPress={() => setProjectToDelete(project)}
                  >
                    Delete
                  </ActionButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
        onCreate={handleCreate}
      />
      <RenameProjectModal
        project={projectToRename}
        onClose={() => setProjectToRename(null)}
        onRename={handleRename}
      />
      <DeleteProjectModal
        project={projectToDelete}
        onClose={() => setProjectToDelete(null)}
        onDelete={handleDelete}
      />
    </div>
  );
}

function EmptyState({
  hasAnyProjects,
  onNewProject
}: {
  hasAnyProjects: boolean;
  onNewProject: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-large border border-dashed border-divider py-20 text-center">
      <p className="text-lg font-medium text-foreground">
        {hasAnyProjects ? "No projects match your filters" : "No projects yet"}
      </p>
      <p className="max-w-sm text-default-500">
        {hasAnyProjects
          ? "Try a different search term or date range."
          : "Create your first site to get started."}
      </p>
      {hasAnyProjects ? null : (
        <ActionButton endContent={<Icon name="ph:plus" />} onPress={onNewProject}>
          New Project
        </ActionButton>
      )}
    </div>
  );
}
