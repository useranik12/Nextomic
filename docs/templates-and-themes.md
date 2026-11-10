# Themes and Templates

Two systems that decide how a page looks and what surrounds it. Both pick what applies to a page using conditions.

## 1. Vocabulary (use these words exactly)

- **Color mode:** light or dark inside a theme (dark only when the theme turns dark mode on). Custom color modes were removed; old ones are dropped when read. Visitors can switch it at runtime. Letting visitors switch between whitelisted themes is planned as an action later.
- **Theme:** a named style set for the whole site, like Bricks "Theme Styles". A site can have many themes. Exactly one theme is active on any page render, chosen by conditions.
- **Template:** a page-level structure such as header, footer, 404, popup, archive, or single. Templates apply to pages by conditions.
- **Page:** a routed document.
- **Reusable component:** NOT part of this scope. It comes later (see `phases.md`). Reserve a `componentInstance` node type in the schema, but do not implement it.

## 2. Rules (conditions shared by templates, and later themes, popups and elements)

> BUILT for templates and themes (`packages/schema/src/rules.ts`, editor `components/editor/rules/rule-builder.tsx`). Theme conditions are rule sets now; older page and route conditions are read as rules (a page list becomes "Page ID is in", `/blog/*` becomes "Page route starts with /blog/"). On the live site and preview, theme rules get the full request facts.

A **rule** compares one **field** with a **value** using an **operator**. Rules join in **groups**: **all** (AND) or **any** (OR). A group can hold other groups (4 levels, 100 rules). An empty set applies everywhere.

- **Whole site** (group Site) is a field that is always true. **Excluding** turns a rule, or a nested group, into "must NOT match"; a browser-only fact is never matched and never counts as excluded.
- **Fields:** Page (name, id, created by, published date, route, parameter, state, element attribute by ID, element with class, element with attribute), User (name, email, role, username, id, joined on, workspace, project name, project id, image, email verified, verification status, logged in), Date and time (date, time, ISO, day of week, day of month, month, year, hour, minute, is weekend), Browser (name, version, language, mobile), Operating system (name, device type), URL (full, host, path, query, referrer), Document (is a page, is a template, template type), Dynamic data.
- **Dynamic data field:** the key holds a dynamic tag such as `{{param.id}}`. The rule compares what the tag resolves to with the value. The value field also accepts dynamic tags (bolt).
- **Operators by kind:** text (equals, does not equal, contains, does not contain, starts with, ends with, is in, is not in, is empty, is not empty), number (equals, does not equal, more than, less than, is in, is not in), date and time (equals, does not equal, before, after, is in, is not in), true or false (is true, is false). Text compares ignore case. "is in" takes a comma separated list.
- **Where rules run:** on the server for every request of the live site and the owner preview (`server/site-layout.ts`). Date and time use UTC for now. Fields that only exist in the visitor browser (page state, element rules) never match on the server and the editor says so; they start working with the browser runtime (Phase 5). User fields stay empty until built-app authentication exists (`app-auth.md`).
- Specificity (higher wins when priority ties): page id or name, then route or path, then anything else, then everywhere. Priority (an integer the user sets) is checked first, then specificity, then name order, so the result is deterministic.
- The editor shows "Why is this applied?" in the editing chip popover for a page: which header and footer apply and the reason (chosen in page settings, rules match, applies everywhere, or none).

## 3. Themes

### 3.1 Model

> Built so far (see the decisions log in `spec.md`): id, name, slug, isDefault, priority, rule-set conditions (same builder as templates; not used by the default theme), light and dark modes, defaultMode, respectSystemPreference, allowModeSwitch (off locks visitors to the default mode: saved choice and system preference are ignored), per-mode variable overrides. The first theme created is the default. `elementDefaults`, `fonts` and `customCss` below are still open.

```ts
interface Theme {
  id: string;
  name: string;
  slug: string; // used in CSS: [data-nxt-theme="slug"]
  isDefault: boolean; // exactly one default per project
  priority: number;
  conditions: ConditionSet; // ignored for the default theme
  modes: ColorMode[]; // e.g. [{ id: "light" }, { id: "dark" }]
  defaultMode: string;
  respectSystemPreference: boolean;
  allowModeSwitch: boolean;
  variables: Record<VariableId, Partial<Record<ModeId, string>>>; // overrides of base variables per mode
  elementDefaults: Partial<Record<ElementType, StyleMap>>; // default styles by element type (all headings, buttons, ...)
  fonts: FontConfig[];
  customCss?: string; // scoped to the theme
}
```

- Project base variables (see `design-system.md`) are the defaults. A theme overrides values per mode and may add its own element default styles.
- Layer order: framework base, base variables, active theme variables and element defaults, theme custom CSS, custom CSS files, classes, element styles.
- A page can force a theme (page setting: Theme = Auto or a specific theme). Forcing overrides conditions.

### 3.2 Resolution and output

1. Collect themes whose conditions match the page render context. If none match, use the default theme.
2. Choose by priority, then specificity, then name.
3. Output `<html data-nxt-theme="slug" data-nxt-mode="light|dark">`.
4. CSS output: `base.css` (framework and base variables) plus one `themes/<slug>.css` per theme, every rule scoped under `[data-nxt-theme="slug"]`.
5. If every condition that can select a theme is static, ship only that page's theme CSS. If any runtime condition is involved, ship all candidate theme CSS files for that page and apply the attribute with a tiny blocking inline script before first paint (no flash). Unused theme CSS is pruned when no page can resolve to that theme.
6. Color mode: resolved from the visitor's saved choice (cookie, so SSR can render correctly), else the system preference if enabled, else the theme default. Actions "Set color mode" and "Toggle color mode" exist (see `dynamic-data-and-actions.md`).
7. Multiple themes publish with the same site. Themes can be exported and imported as `.nextomic-theme.json`. A workspace-level theme library (share across projects) comes later.

### 3.3 Editor

Design System page, Themes tab: list (name, condition summary, priority, default badge), create/duplicate/delete, theme editor with sections Variables, Element defaults, Fonts, Custom CSS, Conditions, and Preview. Previewing: the moon/sun switch in the editor top bar previews the active theme's color modes in the canvas (it never changes the builder UI), and the Page Settings dialog lets you force a theme for the page. Fonts for each theme come from the project's fonts (see `fonts-and-icons.md`).

## 4. Templates

### 4.1 Types

| Type           | Purpose                                                                                                                                                                                                                                                                                      | Applied by                                                                                                | Phase |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----- |
| header         | Top of page                                                                                                                                                                                                                                                                                  | conditions                                                                                                | 3     |
| footer         | Bottom of page                                                                                                                                                                                                                                                                               | conditions                                                                                                | 3     |
| error-404      | Not found page                                                                                                                                                                                                                                                                               | one default, optional per-route override                                                                  | 3     |
| modal          | A centered box over the page and its own overlay. A new modal template is a blank canvas. Template parameters (`{{ param.<name> }}`) carry the values Show Modal passes. Settings: Overlay (Disable overlay, Background color default black 10%, Background opacity default 1.0), Show above | Show Modal / Toggle Modal pick it by id; it shows only if live and its conditions hold (`resolveOverlay`) | 5     |
| bottom-sheet   | A sheet that slides up from the bottom, anchored there (a 60px container is a 60px strip), draggable down to dismiss. Settings: Overlay (as modal), Show above, Entrance (an "up" entrance animation, duration 300ms, delay 100ms)                                                           | Show Bottom Sheet picks it by id; same rule as modal                                                      | 5     |
| popup          | Overlay (drawer, banner; modal and bottom sheet exist as their own types)                                                                                                                                                                                                                    | triggers + conditions                                                                                     | 9     |
| archive        | List page for a collection (loop, filter, search, pagination)                                                                                                                                                                                                                                | route                                                                                                     | 9     |
| single         | Detail page for one record, route param driven                                                                                                                                                                                                                                               | route                                                                                                     | 9     |
| search-results | Results for `/search?q=`                                                                                                                                                                                                                                                                     | route                                                                                                     | 9     |
| error-500      | Server error page                                                                                                                                                                                                                                                                            | one default                                                                                               | 9     |

Header, footer, and 404 are required in v1. Others follow the same model; do not build them before their phase.

### 4.2 Model

```ts
interface Template {
  id: string;
  type: TemplateType;
  name: string;
  slug: string;
  tree: ElementNode[]; // same element tree as pages
  conditions: ConditionSet; // where it applies (not used by 404/500 defaults)
  priority: number;
  themeId?: string; // optional forced theme
  status: "draft" | "published";
  // archive, single, search-results:
  routePattern?: string; // e.g. "blog" or "blog/[slug]"
  query?: QueryRef; // data source; see dynamic-data-and-actions.md
  // popup only:
  popup?: PopupSettings;
}
```

- Templates are edited in the same editor canvas. The page select in the top bar lists Pages and Templates in separate groups, and its "+" offers New page and New template. The editing chip shows "Template" in the secondary color so a template is never mistaken for a page (see `ui-reference.md` 4.3). The Navigator panel only holds the elements of whatever is being edited.
- In template mode the editing chip's menu has "Preview as...": choose a page (or a sample record for archive/single) to see the template in context. Preview data is fetched live or comes from user-authored sample JSON; it is never stored from the connected source.

### 4.2.1 Conditions are required

- A template shows only when it is live (published, or scheduled and due) AND has at least one condition AND its conditions hold (`templateApplies`). A template with no conditions never shows, even when something picks it by id (a Show Toast action, a page's header choice). To use a template on the whole site, give it the **Whole site** rule. Template settings warn: "No conditions: this template never shows. Add Whole site to use it everywhere."
- Exception: the default 404 picks the best live 404 template by priority, conditions or not.

### 4.2.2 Template parameters

- Every template has typed parameters (`TemplateSettings.params`, same shape as Page Parameters: name, type, Required, default value), edited in the right panel as "Template Parameters" when nothing is selected. Elements bind them with `{{ param.<name> }}`.
- **Required:** a required parameter must have a default value (save is blocked: "A required parameter needs a default value."), and every action that opens the template (Show Modal, Show Bottom Sheet) must pass a value; the flow checks report it as an error. The read view and the action's parameter input mark it with a red asterisk.
- Header, footer and 404 templates get their parameters' default values (nothing passes them); they sit beside the page's parameters and the page wins on a name clash. A modal or bottom sheet gets only its own parameters: the passed value, else the default.
- **Modal and bottom sheet editing:** the canvas and the preview show the template open: the root fills the window with the template's overlay behind its content (color-mix of Background color at Background opacity; none when disabled), content centered for a modal and anchored at the bottom, full width, for a sheet (`frameOverlayTemplate`). Only the root's look is changed, so elements keep their places. **Show above** lists other templates of the same type this one sits above; ranks come from `overlayRanks` (a cycle counts as rank 0). Toasts are native actions, not templates (owner decision 2026-11-11); existing toast templates were deleted by migration `0011_overlay_templates`.

### 4.3 Header and footer

- At most one header and one footer apply to a page: highest priority, then specificity.
- Templates render by their own conditions. Page Settings has no header or footer picker (the schema keeps the per-page `header` and `footer` choice for later use; the editor does not expose it).
- The editor canvas shows the header and footer that apply to the open page, above and below the page elements. They are shown, not editable (clicks pass through); edit them by opening the template. They are the saved templates, reloaded when another page or template opens.
- **Sticky header** (header templates only, `TemplateSettings.sticky`): a toggle; when on, _Sticky after_ (px, rem and other units: the header sticks once the page scrolled that far), _Slide up after_ (the header slides out after that distance; empty never), _Slide in and out animation_ (any built-in CSS animation, played forward to hide and in reverse to show), _duration_ (ms), and _Sticky on scroll_ (past the slide distance the header hides on scroll down and returns on scroll up). `composePage` puts the settings on the header wrapper as `data-nxt-sticky` and the runtime (`startStickyHeaders`) does the work; reduced motion removes the animation time and a hidden header is `inert`.
- Output: a layout component per resolved combination (Next.js layouts, Astro layouts) so header/footer markup is shared, not copied into every page.
- Landmarks: header renders `<header>`, footer renders `<footer>`; the page content renders inside `<main>`. Provide a skip-to-content link by default.

### 4.4 Error 404 (and 500)

- Exactly one default 404 template per project. If none exists, generate a clean default from the CSS framework.
- Output: Next.js `not-found` file, Astro `404.astro`. Header and footer apply as usual; the 404 template may opt out.
- Dynamic data available: Site, Route (requested path), User. A 404 template may contain a search element and links.
- 500 follows the same pattern (`error` boundary in Next.js, 500 page in Astro). Must not depend on queries that could fail.

### 4.5 Popup

```ts
interface PopupSettings {
  kind: "modal" | "drawer" | "banner";
  position: "center" | "top" | "bottom" | "left" | "right";
  triggers: PopupTrigger[]; // any can open it
  frequency: "always" | "session" | { days: number } | "once";
  closeOn: { button: boolean; overlay: boolean; escape: boolean; afterMs?: number };
  overlay: { enabled: boolean; dismissible: boolean };
  lockScroll: boolean;
  animation?: string; // saved animation id
}
type PopupTrigger =
  | { type: "load"; delayMs: number }
  | { type: "scroll"; percent: number }
  | { type: "exitIntent" } // desktop only
  | { type: "inactivity"; ms: number }
  | { type: "elementVisible"; selector: string }
  | { type: "urlParam"; name: string; value?: string }
  | { type: "action" }; // opened by the "Open popup" action
```

- Frequency is remembered in a cookie or local storage per popup id.
- Accessibility is mandatory: `role="dialog"` with `aria-modal`, focus trap, focus returns to the opener, Escape closes, and no content shifts.
- Actions "Open popup" and "Close popup" target a popup template.

### 4.6 Archive, single, search results

- **Archive:** a route (for example `blog`) with a root loop bound to a query, and Pagination, Filter, and Search elements. Page number and filters live in the URL query string so results are linkable and crawlable.
- **Single:** a route with a param (for example `blog/[slug]`). The route param feeds the query parameter. If the query returns nothing, show the 404 template (configurable).
- **Search results:** a route (for example `search`) reading `q` from the query string.
- **Rendering mode** (per template and per page): Static, Server (SSR), or Static with revalidate. For Static single/archive pages, a "list query for static params" generates all paths at build (Next.js static params, Astro static paths). Decide defaults when Phase 11 starts and record them in `spec.md`.

### 4.7 Pages & Templates manager

A left rail item "Pages & Templates" replaces the canvas with a manager (pages and templates tabs). Both tabs have search (name, route, creator, ID), filters (category, tag, status, template type, a date range on created, updated or published), sorting (name or a date, either way) and a grid or column layout (the choice is remembered). Grid cards show a screenshot, name, route or type, status, creator and last update. Selecting a card or row shows Edit, status change and Delete icons; column rows also have a three-dot menu (Edit, Duplicate, status change, Regenerate screenshot, Delete). Columns: ID, 60px screenshot, Name, Created by, Published on, Updated on, Status chip.

- **Status:** draft (not going out: a page left out of publishing, or a draft template), published (live and unchanged), modified (live, but the saved draft changed since).
- **Screenshots:** App Settings > Generate Screenshots. When on, the manager renders each outdated page or template in a hidden preview frame, shrinks it to a 480 by 300 WebP and uploads it to `screenshots/<projectId>/<kind>-<id>.webp`. A new one replaces the old file, so there is one per item. They are served only to people who can open the project (`/api/screenshots/...`).
- **Marking (categories and tags):** a "Marking" group in the right panel (collapsible like Route Settings) for pages and for templates. Pages and templates each have their own category and tag lists (four lists in `ProjectSettings.taxonomy`). The input searches by any part of a name; with no match a plus inside the input creates the term and applies it. Applied terms show as small chips (12px): lime green for categories, yellow for tags.
- **Dynamic data:** groups for page properties (id, status, created by, created on, last updated, published on), page categories and tags, template properties (name, type, id, status and the same dates) and template categories and tags.

## 5. Pages

Two places hold page options (see `ui-reference.md` 4.3 and 4.11):

- **Right panel with nothing selected:**
  - Page Parameters: typed parameters (name, type, required, default) filled from route segments or query string; exposed as dynamic data "Route params".
  - Route Settings: segments with `[param]` syntax stored in the schema (UI shows the same). The route may use dynamic data only where it is build-time safe; otherwise validation error. Includes Requires Authentication (see `app-auth.md`).
  - Page State Variables (see `dynamic-data-and-actions.md` section 5).
- **Page Settings dialog (top bar):** Theme (Auto or forced), Header and Footer (Auto, None, or specific template), attached popups, SEO, Rendering mode, custom code, language.

## 6. Tests

Condition evaluation and specificity ordering, theme resolution (static and runtime), no-flash theme attribute, per-theme CSS scoping and pruning, header/footer resolution and opt-out, 404 generation for Next and Astro, popup triggers and frequency, popup accessibility (focus trap, escape), archive pagination URL state, single param to query binding.
