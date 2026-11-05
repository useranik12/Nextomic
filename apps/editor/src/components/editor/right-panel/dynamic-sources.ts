import type { PageSettings } from "@nextomic/schema";

export interface DynamicTag {
  token: string;
  label: string;
  hint: string;
}

export interface DynamicGroup {
  id: string;
  label: string;
  tags: DynamicTag[];
}

/** Built-in tag groups. Parameters and state variables are added from the page. */
const BUILT_IN: DynamicGroup[] = [
  {
    id: "page",
    label: "Page",
    tags: [
      { token: "page.name", label: "Page name", hint: "text" },
      { token: "page.route", label: "Page route", hint: "text" }
    ]
  },
  {
    id: "request",
    label: "Request",
    tags: [
      { token: "request.url", label: "Full URL", hint: "text" },
      { token: "request.path", label: "Path", hint: "text" },
      { token: "request.query", label: "Query string", hint: "text" }
    ]
  },
  {
    id: "datetime",
    label: "Date and time",
    tags: [
      { token: "now.iso", label: "Now (ISO)", hint: "date" },
      { token: "now.date", label: "Today", hint: "date" },
      { token: "now.time", label: "Current time", hint: "text" },
      { token: "now.year", label: "Current year", hint: "number" }
    ]
  },
  {
    id: "user",
    label: "Signed-in user",
    tags: [
      { token: "user.id", label: "User ID", hint: "text" },
      { token: "user.email", label: "Email", hint: "text" },
      { token: "user.name", label: "Name", hint: "text" },
      { token: "user.role", label: "Role", hint: "text" }
    ]
  },
  {
    id: "environment",
    label: "Environment",
    tags: [{ token: "env.mode", label: "Mode (editor, preview, live)", hint: "text" }]
  }
];

/**
 * The groups a field can use. A field that holds a parameter or a state variable's own value
 * cannot reference those groups (they would refer to themselves), so callers can leave them out.
 */
export function dynamicGroups(
  settings: Pick<PageSettings, "params" | "state"> | undefined,
  exclude: ("params" | "state")[] = []
): DynamicGroup[] {
  const groups: DynamicGroup[] = [];
  if (settings && !exclude.includes("params") && settings.params.length > 0)
    groups.push({
      id: "params",
      label: "Page parameters",
      tags: settings.params.map((p) => ({
        token: `param.${p.name}`,
        label: p.name,
        hint: p.type
      }))
    });
  if (settings && !exclude.includes("state") && settings.state.length > 0)
    groups.push({
      id: "state",
      label: "Page state",
      tags: settings.state.map((v) => ({
        token: `state.${v.name}`,
        label: v.name,
        hint: v.isList ? `${v.type} list` : v.type
      }))
    });
  return [...groups, ...BUILT_IN];
}
