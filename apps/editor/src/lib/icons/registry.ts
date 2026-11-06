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
  { id: "ph:link" },
  { id: "ph:link-simple" },
  { id: "ph:link-simple-break" },
  { id: "ph:squares-four" },
  { id: "ph:gear-six" },
  { id: "ph:plus" },
  { id: "ph:upload-simple" },
  { id: "ph:folder-open" },
  { id: "ph:info" },
  { id: "ph:x" },
  { id: "ph:minus" },
  { id: "ph:corners-out" },
  { id: "ph:device-rotate" },
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
  { id: "ph:eye-slash" },
  { id: "ph:tree-structure" },
  { id: "ph:cube" },
  { id: "ph:image-square" },
  { id: "ph:lightning" },
  { id: "ph:plugs-connected" },
  { id: "ph:palette" },
  { id: "ph:code" },
  { id: "ph:git-branch" },
  { id: "ph:sidebar-simple" },
  { id: "ph:sliders-horizontal" },
  { id: "ph:moon" },
  { id: "ph:sun" },
  { id: "ph:caret-down" },
  { id: "ph:caret-right" },
  { id: "ph:desktop" },
  { id: "ph:laptop" },
  { id: "ph:device-tablet" },
  { id: "ph:device-mobile" },
  { id: "ph:arrow-square-out" },
  { id: "ph:check" },
  { id: "ph:rows" },
  { id: "ph:square" },
  { id: "ph:crosshair" },
  { id: "ph:brackets-curly" },
  { id: "ph:sparkle" },
  { id: "ph:text-h" },
  { id: "ph:text-align-left" },
  { id: "ph:cursor-click" },
  { id: "ph:image" },
  { id: "ph:copy" },
  { id: "ph:clipboard" },
  { id: "ph:arrow-counter-clockwise" },
  { id: "ph:arrow-clockwise" },
  { id: "ph:minus-circle" },
  { id: "ph:layout" },
  { id: "ph:arrows-out-cardinal" },
  { id: "ph:ruler" },
  { id: "ph:text-aa" },
  { id: "ph:heart" },
  { id: "ph:heart-fill" },
  { id: "ph:paint-bucket" },
  { id: "ph:arrow-right" },
  { id: "ph:arrow-down" },
  { id: "ph:arrow-left" },
  { id: "ph:arrow-up" },
  { id: "ph:align-left-simple" },
  { id: "ph:align-center-horizontal-simple" },
  { id: "ph:align-right-simple" },
  { id: "ph:arrows-horizontal" },
  { id: "ph:arrows-out-line-horizontal" },
  { id: "ph:align-top-simple" },
  { id: "ph:align-center-vertical-simple" },
  { id: "ph:align-bottom-simple" },
  { id: "ph:arrows-vertical" },
  { id: "ph:text-align-center" },
  { id: "ph:text-align-right" },
  { id: "ph:text-align-justify" }
] as const;

export const ICON_IDS: readonly string[] = ICON_REGISTRY.map((icon) => icon.id);
