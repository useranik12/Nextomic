/**
 * The single source of truth for which icons the builder UI uses. `scripts/build-icon-set.ts`
 * reads this to bundle only these icons (tree-shaken, no runtime calls to Iconify's API).
 * `scripts/lint-icons.ts` greps source for `<Icon icon="...">` usage and fails if an icon is
 * used but not registered here, or registered but not used anywhere (see ui-reference.md
 * section 3, "Icons (builder UI)").
 *
 * Format: "<iconify-set>:<icon-name>". `fallback: true` marks a Google Material Symbols
 * fallback used only because no preferred set (Streamline, Lineicons, Phosphor, Fluent) had a
 * matching icon — review these per the licensing rule before shipping more of them.
 */
export interface RegisteredIcon {
  id: string;
  fallback?: true;
}

export const ICON_REGISTRY: readonly RegisteredIcon[] = [
  { id: "ph:magnifying-glass" },
  { id: "ph:squares-four" },
  { id: "ph:gear-six" },
  { id: "ph:plus" },
  { id: "ph:dots-three-vertical" },
  { id: "ph:calendar-blank" },
  { id: "ph:list" },
  { id: "ph:stack" },
  { id: "ph:pencil-simple" },
  { id: "ph:trash" },
  { id: "ph:export" },
  { id: "ph:clock-counter-clockwise" },
  { id: "ph:sign-out" },
  { id: "ph:warning-circle" },
  { id: "ph:eye" },
  { id: "ph:eye-slash" }
] as const;

export const ICON_IDS: readonly string[] = ICON_REGISTRY.map((icon) => icon.id);
