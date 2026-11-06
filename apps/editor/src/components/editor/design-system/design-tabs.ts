export const DESIGN_TABS = [
  { id: "themes", label: "Themes", hint: "Style sets and color modes" },
  { id: "framework", label: "Framework", hint: "CSS framework per theme" },
  { id: "colors", label: "Colors", hint: "Palettes, shades, utilities" },
  { id: "typography", label: "Typography", hint: "Fluid type scale" },
  { id: "spacing", label: "Spacing", hint: "Fluid spacing scale" },
  { id: "variables", label: "Variables", hint: "All design tokens" },
  { id: "classes", label: "Classes", hint: "Global class manager" },
  { id: "fonts", label: "Fonts & Icons", hint: "Google, uploaded, self-hosted" },
  { id: "css", label: "Custom CSS", hint: "Ordered CSS files, global or per page" }
] as const;
export type DesignTabId = (typeof DESIGN_TABS)[number]["id"];

export const isDesignTab = (id: string | undefined): id is DesignTabId =>
  DESIGN_TABS.some((t) => t.id === id);
