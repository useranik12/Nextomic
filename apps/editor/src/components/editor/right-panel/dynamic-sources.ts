import type { AppStateVariable, Constant, PageSettings } from "@nextomic/schema";

export interface DynamicTag {
  token: string;
  label: string;
  hint: string;
  /** How to use the tag; shown on hover. */
  help?: string;
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
    id: "page-properties",
    label: "Page properties",
    tags: [
      { token: "page.id", label: "Page ID", hint: "text" },
      {
        token: "page.status",
        label: "Page status",
        hint: "draft, published or modified",
        help: "draft: not going out. published: live and unchanged. modified: live, but the saved draft has changed since."
      },
      { token: "page.createdBy", label: "Created by", hint: "text" },
      { token: "page.createdAt", label: "Created on", hint: "date and time" },
      { token: "page.updatedAt", label: "Last updated", hint: "date and time" },
      { token: "page.publishedAt", label: "Published on", hint: "date and time" }
    ]
  },
  {
    id: "page-marking",
    label: "Page categories and tags",
    tags: [
      { token: "page.categories", label: "Categories", hint: "names, comma separated" },
      { token: "page.tags", label: "Tags", hint: "names, comma separated" }
    ]
  },
  {
    id: "template-properties",
    label: "Template properties",
    tags: [
      { token: "template.name", label: "Template name", hint: "text" },
      { token: "template.type", label: "Template type", hint: "header, footer or error-404" },
      { token: "template.id", label: "Template ID", hint: "text" },
      {
        token: "template.status",
        label: "Template status",
        hint: "draft, published or modified",
        help: "Empty on a page. On a template: draft, published, or modified (live, but changed since)."
      },
      { token: "template.createdBy", label: "Created by", hint: "text" },
      { token: "template.createdAt", label: "Created on", hint: "date and time" },
      { token: "template.updatedAt", label: "Last updated", hint: "date and time" },
      { token: "template.publishedAt", label: "Published on", hint: "date and time" }
    ]
  },
  {
    id: "template-marking",
    label: "Template categories and tags",
    tags: [
      { token: "template.categories", label: "Categories", hint: "names, comma separated" },
      { token: "template.tags", label: "Tags", hint: "names, comma separated" }
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
    id: "elements",
    label: "Elements",
    tags: [
      {
        token: "attr @ cssID:attribute-name",
        label: "Target element's attribute",
        hint: "attribute",
        help: "Reads an attribute of another element. Write the tag, a space, @, a space, the element's CSS ID, a colon and the attribute name. Example: {{attr @ nxtomc-ab12cd34:aria-label}}. Replace cssID and attribute-name after inserting."
      }
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
  exclude: ("params" | "state")[] = [],
  globals?: { appState: readonly AppStateVariable[]; constants: readonly Constant[] }
): DynamicGroup[] {
  const groups: DynamicGroup[] = [];
  const typeHint = (v: { type: string; isList: boolean }) => (v.isList ? `${v.type} list` : v.type);
  if (globals && globals.appState.length > 0)
    groups.push({
      id: "app",
      label: "App state",
      tags: globals.appState.map((v) => ({
        token: `app.${v.name}`,
        label: v.name,
        hint: typeHint(v),
        help: v.description || undefined
      }))
    });
  if (globals && globals.constants.length > 0)
    groups.push({
      id: "const",
      label: "Constants",
      tags: globals.constants.map((c) => ({
        token: `const.${c.name}`,
        label: c.name,
        hint: typeHint(c),
        help: c.description || undefined
      }))
    });
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
