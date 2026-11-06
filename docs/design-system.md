# Design System Spec

## 0. Two design systems (never mix)

1. **Builder UI design system:** the HeroUI-based tokens in `blueprint/tokens.json` and `blueprint/design-system/design-system-sheet.png`. Used only by the builder's own UI. See `ui-reference.md`.
2. **Built-site design system:** this document. Project variables, classes, themes, and the Nextomic CSS framework. Used only by generated sites and by the canvas iframe content.
   The canvas iframe never loads builder UI CSS, and builder UI never loads built-site CSS.

## 1. Layers of styling (lowest to highest priority)

1. CSS framework base (generated from variables + built-in element classes)
2. Base variables and the active theme's variables and element defaults (see `templates-and-themes.md`)
3. Theme custom CSS
4. Global/custom CSS files (ordered, per project)
5. Classes (in the order applied to the element)
6. Element-level styles and element custom CSS
7. Dynamic style values (inline CSS custom properties, see `elements.md`)

## 2. Style data model (single source of truth)

```ts
type StyleMap = {
  [breakpoint in BreakpointId]?: {
    // keys are project breakpoint ids ("base" plus user-defined)
    [state in PseudoState]?: Record<CssProperty, string | VariableRef>;
  };
} & { raw?: string }; // unparsed CSS that cannot be represented structurally

interface StyleClass {
  id: string;
  name: string; // CSS class name, unique per project
  styles: StyleMap;
  customCss?: string;
  locked?: boolean; // framework classes: editable only if user unlocks
  source: "user" | "framework" | "import";
  folderId?: string;
}
```

## 3. Classes and IDs (Bricks-style)

- An element can have many classes plus its own ID (`htmlId`).
- **Editing scope rule:** Design tab edits apply to the ELEMENT unless a class is selected as the active target. To edit a class, the class must be added to the element AND selected. Changes then save to that class only. Every element using the class updates.
- The active target is always visible in the Design tab header (element, or class name). Switching targets never loses data.
- Class manager: create, rename, duplicate, delete (with usage count and replace-with option), folders, search, filter by usage, convert element styles to class, import/export classes.
- ID-level and class-level styles both support all breakpoints and pseudo states.

## 4. Bidirectional CSS

- The Design tab edits the `StyleMap`. A CSS editor (per target: element, class) shows the serialized CSS.
- Editing the CSS text parses it back into the `StyleMap`. Declarations/selectors the parser cannot model go to `raw` and are preserved verbatim, never dropped.
- Use a real CSS parser (e.g. PostCSS or lightningcss). Round-trip tests are mandatory: visual edit → CSS → parse → same `StyleMap`; CSS edit → `StyleMap` → CSS → equal after normalization.
- Invalid CSS: show inline errors, do not overwrite the last valid state.
- Implementation: `styleMapToCss` / `parseStyleCss` in `packages/schema/src/css-text.ts`. A rule maps to the map only when its selector is exactly the target (`.class`, `#id`) plus an optional `:hover|:focus|:active|:disabled`, inside no at-rule or a `@media` that equals a project breakpoint. Everything else (other selectors, other at-rules, comments, vendor properties) goes to `raw` and is output verbatim after the structured rules (never able to close the `<style>` tag). Bare declarations count as base/default.

## 5. Design tab groups

Layout (display, flex, grid, position, z-index, overflow), Spacing, Size, Typography, Background, Border, Effects (shadow, filter, backdrop, opacity, transform, transition), Positioning, Scroll/Overflow, Pseudo states, Custom CSS. All CSS properties must be reachable, either through controls or the raw CSS editor.

### Panel behavior (see `ui-reference.md` 4.7)

- Header shows the ID field and class chips; the active edit target (element or a class) is always visible and highlighted.
- A yellow dot before a property label means it is set at the current breakpoint (and pseudo state). The Design tab and the breakpoint switcher show a dot when anything is set. Right click or a reset icon clears the property.
- Every value input has a variable picker (CSS variables) and a bolt (dynamic data, see `elements.md`).
- A responsive icon next to a label shows the property can differ per breakpoint; inherited values from a larger breakpoint are shown dimmed.
- "Search settings" at the bottom filters all controls across groups.
- Breakpoints are user-defined per project (manager in `ui-reference.md` 4.12). Defaults: desktop (base), tablet (and below 768px), mobile (and below 414px). Output CSS emits media queries in cascade order: base, then "and above" ascending, then "and below" descending.

## 6. Variables and tokens

- Variable types: color, size, fluid size, font family, font weight, shadow, radius, number, string.
- Reference syntax in styles: `var(--nxt-<name>)`; stored as `VariableRef`.
- Variable manager: groups, search, rename with reference update, usage count, import/export.
- Font family variables (`--nxt-font-heading`, `--nxt-font-body`, `--nxt-font-mono`, or custom) point to fonts imported in Design System > Fonts & Icons (see `fonts-and-icons.md`). The Design tab font control lists only project fonts and system stacks.

- Implementation: `packages/schema/src/variables.ts` (schema, `fluidClamp`, `typeScale`, `spaceScale`, `colorShades`, `variablesCss`) and `variable-refs.ts` (usage counts and renames). Variables live in `ProjectSettings.variables`, are written as `:root{--nxt-name:value}` before the class and element CSS, and a published site uses the variables saved with the publish.

### Fluid typography and spacing

- Generate scales from min/max viewport and min/max size using `clamp()`. Settings: base size, ratio, steps, min/max viewport.
- Spacing scale generated the same way (3xs ... 3xl). Preview in the manager.

### Color palettes

- Palettes with shades generated from a base color (and manual overrides).

### Themes and color modes

Superseded by `templates-and-themes.md` (themes are built; see the decisions log in `spec.md`). In short: a site can have many themes (Bricks-style style sets) that are activated per page or template by conditions, and each theme has color modes (light, dark, custom) that visitors can switch. Base variables defined here are the defaults that themes override. The scoping attribute is `data-nxt-theme` plus `data-nxt-mode`.

### Design System modal: draft and Save (built)

- Every Design System tab edits a draft. Changes show in the canvas at once but are written only when **Save** (top right, left of the close icon) is pressed. Closing with unsaved changes asks Save and close, Discard (restores the snapshot taken on open) or Keep editing. Cross-page work (class and variable renames or deletes on other saved pages) is queued and runs on Save.
- **Colors** manager (Bricks palette manager): palettes are groups of colors, a default prefix input per theme preset, color picker with Hex, RGB, HSL, CSS formats and an alpha slider (`apps/editor/src/components/ui/color-picker.tsx`, math in `packages/schema/src/color.ts`). Shades (`color-mix`) and color utility classes are derived at output, never stored (`framework-colors.ts`).
- **Typography** and **Spacing** tabs edit the framework scales (Core Framework style: min/max viewport, base, ratios, steps, live preview). Scale `kind` is text, space or radius.
- **Variables** manager: project and framework variables in user categories, search, usage, rename with reference update.
- **Classes** manager (Bricks class manager): categories, lock, usage, CSS editing, delete with replacement, filter by name or by a list sent from another tab (for example "Classes that use Inter").
- **Theme dark mode:** each theme has "Dark mode for the whole site" (`Theme.darkMode`). Off: the theme has only its light mode, the mode options (first mode, visitor switch, follow device) and every "Enable dark mode" color option are hidden, and no dark CSS is written. New themes start off; themes saved before keep dark mode on (`themeModes`, `themeDefaultMode` in `theme.ts`).
- **Theme active:** each theme has a "Theme is active" switch (`Theme.active`). An inactive theme is kept but never applies: not by conditions, not as the default, not when a page forces it, and it is left out of the page theme select.
- **Dark colors:** turning on "Enable dark mode" for a color generates its dark value in OKLCH (`darkVariant` in `color-math.ts`): same hue, 10% less chroma, lower lightness (mid and dark colors keep their order but sit lower, light colors are turned over), so the result is always darker than the light value and mapped into the sRGB gamut by reducing chroma. "Generate again" recomputes it. Colors no longer start with a dark value.
- **Color shades:** each color has light and dark shades (1 to 10 each, `lightCount`/`darkCount`) and 1 to 10 transparent shades, all off by default, as is every utility class. Each group has its own row of 50px boxes under its option, each with a chip showing the value in the color's format (click the chip to copy); a click opens the picker and stores a hand-set value in `overrides`, which replaces the mix until reset.
- **Color prefix:** the prefix input renames every color of the theme (old prefix removed, new one added) on Apply. Shades, framework variables and CSS that reference them, the open page, classes, project variables and the other saved pages (queued, runs on Save) follow, so nothing breaks (`applyColorPrefix`, `renameCssVars`). A single color rename does the same.
- **Export** names the file `nextomic-framework-<site id>-<version>.css`; the version (`Framework.version`) goes up with each export.
- Clicking a variable or class name in the Framework tab opens it in the Variables or Classes manager.
- Settings carry an (i) tooltip (`InfoTip`) that says in plain words what they change.
- **Fonts** manager: a font is a group of faces that share a name. List with categories (Favorites, Custom, Google, Standard), search, cards with sample text; the editor lists variations (weight, style, delete, add), favorite, load/preload, and "Use as a font variable" chips that toggle on and off (undo) until saved.

## 7. Nextomic CSS framework

- Core framework package `packages/css-framework`: reset, variables, utility and component classes, built-in element default classes (shadcn-like look).
- Output is plain CSS with CSS variables only. No Tailwind dependency in built sites.
- Users can import another CSS framework as a project file (e.g. a custom framework). Imported classes appear read-only in the class manager (`source: "import"`) and can be cloned to edit.
- Generated CSS is split per project: framework, variables/themes, classes, per-page CSS.
- **Unused class pruning** (`packages/schema/src/css-prune.ts`, built): preview and the published site ship only the framework classes some element of the page uses. A rule stays when its selector has no class (`:root`, tags, `*`) or when every class one of its selectors needs is used (classes inside `:not()`, `:is()`, `:where()`, `:has()` and attribute values do not count; a selector list is trimmed to its used selectors; emptied `@media` blocks go). `@keyframes`, `@font-face` and all variables always stay, and CSS that cannot be parsed is returned unchanged. User classes (the author's own) always ship. Classes added by a script or action later go in the renderer's `keepClasses` safelist. The editor canvas never prunes, so a class added while editing shows at once. Pruning runs before the theme scope is added, and results are cached per used-class set.

### Frameworks per theme (built)

- Every theme owns one framework (`Theme.framework`, `packages/schema/src/framework.ts`): custom properties (`--primary`, `--space-m`, written exactly as named, never prefixed), each with a light value and an optional dark value; a stylesheet of classes; and the settings of its fluid scales. New projects start with the Main theme running the generated Main framework (colors with their shade options and the text and space scales only: no general variables such as shadows or radius, and no framework classes). A new theme starts with no framework, so it gets no variables or classes automatically. Variables and Classes managers: each project row has a checkbox; Select all and Deselect all sit at the top of the tab, and the bulk Delete button shows only while something is selected.
- Output: framework variables on `:root[data-nxt-theme="slug"]` (dark values on the dark mode attribute), then the framework classes scoped under `:where(:root[data-nxt-theme="slug"])`, so the classes have zero extra specificity and any class or element style set in the builder wins. Because only the resolved theme is emitted, each page gets one framework.
- Scales (like Core Framework): `prefix`, ordered step `names`, `baseIndex`, `baseMin`/`baseMax` (px), minor ratio at the min screen, major ratio at the max screen, `minScreen`/`maxScreen`. Step `k` away from the base is `base * ratio^k`, written as a `clamp()`. Presets from 1.067 to 1.618 or any custom ratio.
- Import (Design System > Framework > Import, file or paste, 2 MB): rules that only hold custom properties on `:root` become variables, a `.dark`/`.theme-dark` root rule becomes the dark values, every other rule stays in the stylesheet with `.theme-dark`/`.theme-light` rewritten to the mode attribute. `@import`, `@font-face`, `@charset` and unsafe declarations are removed. Scales are inferred from `--text-*`, `--space-*`, `--radius-*` clamp() variables (base `m`, screens from `--min-screen-width`/`--max-screen-width`, else 320/1400), so imported frameworks get the same ratio and base controls.
- Export writes variables, dark variables, a `nextomic:scales` comment (restores the exact scale settings on re-import) and the classes as one `.css` file. Import then export then import returns the same variables and classes.
- Pickers (variable button, color palette) list project variables and the variables of the framework of the current theme (`var(--primary)`).
- Open: grouping classes by the user's own groups, adding used classes automatically, per-class source badge in the Classes tab, context selectors such as `.theme-inverted` variable blocks (dropped with a warning), pruning unused classes on publish.

## 8. Custom CSS files

- Multiple files per project with order, enable/disable, scope (global or per page), minify on publish.
- Validated on save; syntax errors never break publishing (file is skipped with a warning).

## 9. Animations

- Pre-built animations (fade, slide, zoom, rotate, etc.) with trigger options (on load, on scroll into view, on hover, on click via action).
- GSAP visual timeline editor: tweens, stagger, easing, ScrollTrigger. Saved animations are named, reusable, and callable from the action flow ("start animation" on a target).
- Respect `prefers-reduced-motion` by default.

## 10. Element IDs

- `nxtomc-` + 8 chars from `a-z0-9`, cryptographically random, unique per page, generated when the project setting "Generate element ID automatically" is on. Never regenerate an ID once published unless the user asks.

## 11. Tests

CSS round-trip, class scope editing, variable rename propagation, fluid scale math, theme output and scoping, dynamic style values compile to safe custom properties (no CSS injection), unused class pruning, ID uniqueness, builder UI CSS never present in the canvas iframe.
