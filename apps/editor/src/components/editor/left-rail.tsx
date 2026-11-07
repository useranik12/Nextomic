"use client";

import { Icon } from "@/lib/icons/Icon";

export type RailItemId =
  | "navigator"
  | "pages-templates"
  | "data-types"
  | "state"
  | "media"
  | "supabase"
  | "api"
  | "design-system"
  | "animations"
  | "custom-codes"
  | "git"
  | "history"
  | "app-settings";

function RailIcon({ id }: { id: RailItemId }) {
  const props = { width: 20, height: 20 };
  switch (id) {
    case "navigator":
      return <Icon name="ph:tree-structure" {...props} />;
    case "pages-templates":
      return <Icon name="ph:files" {...props} />;
    case "data-types":
      return <Icon name="ph:brackets-curly" {...props} />;
    case "state":
      return <Icon name="ph:cube" {...props} />;
    case "media":
      return <Icon name="ph:image-square" {...props} />;
    case "supabase":
      return <Icon name="ph:lightning" {...props} />;
    case "api":
      return <Icon name="ph:plugs-connected" {...props} />;
    case "design-system":
      return <Icon name="ph:palette" {...props} />;
    case "animations":
      return <Icon name="ph:film-strip" {...props} />;
    case "custom-codes":
      return <Icon name="ph:code" {...props} />;
    case "git":
      return <Icon name="ph:git-branch" {...props} />;
    case "history":
      return <Icon name="ph:clock-counter-clockwise" {...props} />;
    default:
      return <Icon name="ph:gear-six" {...props} />;
  }
}

export const RAIL_ITEMS: { id: RailItemId; label: string; ready: boolean }[] = [
  { id: "navigator", label: "Navigator", ready: true },
  { id: "pages-templates", label: "Pages & Templates", ready: true },
  { id: "data-types", label: "Data Types", ready: true },
  { id: "state", label: "State Management", ready: true },
  { id: "media", label: "Media", ready: false },
  { id: "supabase", label: "Supabase", ready: false },
  { id: "api", label: "API Data", ready: false },
  { id: "design-system", label: "Design System", ready: true },
  { id: "animations", label: "Animations", ready: true },
  { id: "custom-codes", label: "Custom Codes", ready: false },
  { id: "git", label: "Git Connection", ready: false },
  { id: "history", label: "Version History", ready: true }
];

export function LeftRail({
  active,
  collapsed,
  onSelect,
  onToggleCollapse
}: {
  active: RailItemId;
  collapsed: boolean;
  onSelect: (id: RailItemId) => void;
  onToggleCollapse: () => void;
}) {
  function item(id: RailItemId, label: string, ready: boolean) {
    const isActive = active === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => onSelect(id)}
        aria-current={isActive ? "page" : undefined}
        title={ready ? label : `${label} (coming in a later phase)`}
        className={
          "flex h-9 w-full items-center gap-3 rounded-medium px-3 text-small transition-colors duration-300 " +
          (isActive
            ? "bg-default-200 text-foreground"
            : "text-default-600 hover:bg-default-100 hover:text-foreground") +
          (ready ? "" : " opacity-60")
        }
      >
        <RailIcon id={id} />
        {collapsed ? (
          <span className="sr-only">{label}</span>
        ) : (
          <span className="truncate">{label}</span>
        )}
      </button>
    );
  }

  return (
    <nav aria-label="Editor sections" className="flex h-full flex-col justify-between p-2">
      <div className="flex flex-col gap-1">
        {RAIL_ITEMS.map((i) => item(i.id, i.label, i.ready))}
      </div>
      <div className="flex flex-col gap-1">
        {item("app-settings", "App Settings", true)}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-9 w-full items-center rounded-medium px-3 text-default-600 hover:bg-default-100 hover:text-foreground"
        >
          <Icon name="ph:sidebar-simple" width={20} height={20} />
        </button>
      </div>
    </nav>
  );
}
