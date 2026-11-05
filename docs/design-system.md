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

### Fluid typography and spacing

- Generate scales from min/max viewport and min/max size using `clamp()`. Settings: base size, ratio, steps, min/max viewport.
- Spacing scale generated the same way (3xs ... 3xl). Preview in the manager.

### Color palettes

- Palettes with shades generated from a base color (and manual overrides).

### Themes and color modes

Superseded by `templates-and-themes.md`. In short: a site can have many themes (Bricks-style style sets) that are activated per page or template by conditions, and each theme has color modes (light, dark, custom) that visitors can switch. Base variables defined here are the defaults that themes override. The scoping attribute is `data-nxt-theme` plus `data-nxt-mode`.

## 7. Nextomic CSS framework

- Core framework package `packages/css-framework`: reset, variables, utility and component classes, built-in element default classes (shadcn-like look).
- Output is plain CSS with CSS variables only. No Tailwind dependency in built sites.
- Users can import another CSS framework as a project file (e.g. a custom framework). Imported classes appear read-only in the class manager (`source: "import"`) and can be cloned to edit.
- Generated CSS is split per project: framework, variables/themes, classes, per-page CSS. Unused class pruning on publish.

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
