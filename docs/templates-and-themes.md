# Themes and Templates

Two systems that decide how a page looks and what surrounds it. Both pick what applies to a page using conditions.

## 1. Vocabulary (use these words exactly)
- **Color mode:** light, dark, or a custom mode inside a theme. Visitors can switch it at runtime.
- **Theme:** a named style set for the whole site, like Bricks "Theme Styles". A site can have many themes. Exactly one theme is active on any page render, chosen by conditions.
- **Template:** a page-level structure such as header, footer, 404, popup, archive, or single. Templates apply to pages by conditions.
- **Page:** a routed document.
- **Reusable component:** NOT part of this scope. It comes later (see `phases.md`). Reserve a `componentInstance` node type in the schema, but do not implement it.

## 2. Conditions (shared by themes and templates)

```ts
type ConditionScope = "static" | "runtime";

type Condition =
  | { type: "page"; op: "is" | "isNot"; pageIds: string[] }                 // static
  | { type: "route"; op: "matches" | "notMatches"; pattern: string }         // static, glob like /blog/*
  | { type: "template"; op: "is" | "isNot"; templateTypes: TemplateType[] }  // static
  | { type: "locale"; op: "is" | "isNot"; locales: string[] }                // static
  | { type: "auth"; op: "loggedIn" | "loggedOut" }                           // runtime
  | { type: "role"; op: "has" | "hasNot"; roles: string[] }                  // runtime
  | { type: "queryParam"; name: string; op: "equals" | "exists"; value?: string } // runtime
  | { type: "appState"; variableId: string; op: ConditionOp; value: Binding } // runtime
  | { type: "dateRange"; from?: string; to?: string };                       // runtime

interface ConditionSet {
  mode: "all" | "any";     // empty set means "applies everywhere"
  items: Condition[];
  exclude?: Condition[];   // if any matches, the set does not apply
}
```

- Static conditions are resolved at build/render time. Runtime conditions are resolved in the browser (or in server middleware for SSR).
- Specificity (higher wins): page > route pattern > template type > locale > runtime-only > everywhere. Priority (an integer the user sets) is checked first, then specificity, then name order, so the result is deterministic.
- The editor shows a "Why is this applied?" explanation for the current page: which theme, header, and footer apply and which rule matched.

## 3. Themes

### 3.1 Model
```ts
interface Theme {
  id: string;
  name: string;
  slug: string;                       // used in CSS: [data-nxt-theme="slug"]
  isDefault: boolean;                 // exactly one default per project
  priority: number;
  conditions: ConditionSet;           // ignored for the default theme
  modes: ColorMode[];                 // e.g. [{ id: "light" }, { id: "dark" }]
  defaultMode: string;
  respectSystemPreference: boolean;
  variables: Record<VariableId, Partial<Record<ModeId, string>>>; // overrides of base variables per mode
  elementDefaults: Partial<Record<ElementType, StyleMap>>;        // default styles by element type (all headings, buttons, ...)
  fonts: FontConfig[];
  customCss?: string;                 // scoped to the theme
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
| Type | Purpose | Applied by | Phase |
|---|---|---|---|
| header | Top of page | conditions | 3 |
| footer | Bottom of page | conditions | 3 |
| error-404 | Not found page | one default, optional per-route override | 3 |
| popup | Overlay (modal, drawer, banner) | triggers + conditions | 9 |
| archive | List page for a collection (loop, filter, search, pagination) | route | 9 |
| single | Detail page for one record, route param driven | route | 9 |
| search-results | Results for `/search?q=` | route | 9 |
| error-500 | Server error page | one default | 9 |

Header, footer, and 404 are required in v1. Others follow the same model; do not build them before their phase.

### 4.2 Model
```ts
interface Template {
  id: string;
  type: TemplateType;
  name: string;
  slug: string;
  tree: ElementNode[];          // same element tree as pages
  conditions: ConditionSet;     // where it applies (not used by 404/500 defaults)
  priority: number;
  themeId?: string;             // optional forced theme
  status: "draft" | "published";
  // archive, single, search-results:
  routePattern?: string;        // e.g. "blog" or "blog/[slug]"
  query?: QueryRef;             // data source; see dynamic-data-and-actions.md
  // popup only:
  popup?: PopupSettings;
}
```
- Templates are edited in the same editor canvas. The page select in the top bar lists Pages and Templates in separate groups, and its "+" offers New page and New template. The editing chip shows "Template" in the secondary color so a template is never mistaken for a page (see `ui-reference.md` 4.3). The Navigator panel only holds the elements of whatever is being edited.
- In template mode the editing chip's menu has "Preview as...": choose a page (or a sample record for archive/single) to see the template in context. Preview data is fetched live or comes from user-authored sample JSON; it is never stored from the connected source.

### 4.3 Header and footer
- At most one header and one footer apply to a page: highest priority, then specificity.
- A page can choose No header, No footer, or a specific template (page settings).
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
  triggers: PopupTrigger[];     // any can open it
  frequency: "always" | "session" | { days: number } | "once";
  closeOn: { button: boolean; overlay: boolean; escape: boolean; afterMs?: number };
  overlay: { enabled: boolean; dismissible: boolean };
  lockScroll: boolean;
  animation?: string;           // saved animation id
}
type PopupTrigger =
  | { type: "load"; delayMs: number }
  | { type: "scroll"; percent: number }
  | { type: "exitIntent" }                 // desktop only
  | { type: "inactivity"; ms: number }
  | { type: "elementVisible"; selector: string }
  | { type: "urlParam"; name: string; value?: string }
  | { type: "action" };                    // opened by the "Open popup" action
```
- Frequency is remembered in a cookie or local storage per popup id.
- Accessibility is mandatory: `role="dialog"` with `aria-modal`, focus trap, focus returns to the opener, Escape closes, and no content shifts.
- Actions "Open popup" and "Close popup" target a popup template.

### 4.6 Archive, single, search results
- **Archive:** a route (for example `blog`) with a root loop bound to a query, and Pagination, Filter, and Search elements. Page number and filters live in the URL query string so results are linkable and crawlable.
- **Single:** a route with a param (for example `blog/[slug]`). The route param feeds the query parameter. If the query returns nothing, show the 404 template (configurable).
- **Search results:** a route (for example `search`) reading `q` from the query string.
- **Rendering mode** (per template and per page): Static, Server (SSR), or Static with revalidate. For Static single/archive pages, a "list query for static params" generates all paths at build (Next.js static params, Astro static paths). Decide defaults when Phase 11 starts and record them in `spec.md`.

## 5. Pages
Two places hold page options (see `ui-reference.md` 4.3 and 4.11):
- **Right panel with nothing selected:**
  - Page Parameters: typed parameters (name, type, required, default) filled from route segments or query string; exposed as dynamic data "Route params".
  - Route Settings: segments with `[param]` syntax stored in the schema (UI shows the same). The route may use dynamic data only where it is build-time safe; otherwise validation error. Includes Requires Authentication (see `app-auth.md`).
  - Page State Variables (see `dynamic-data-and-actions.md` section 5).
- **Page Settings dialog (top bar):** Theme (Auto or forced), Header and Footer (Auto, None, or specific template), attached popups, SEO, Rendering mode, custom code, language.

## 6. Tests
Condition evaluation and specificity ordering, theme resolution (static and runtime), no-flash theme attribute, per-theme CSS scoping and pruning, header/footer resolution and opt-out, 404 generation for Next and Astro, popup triggers and frequency, popup accessibility (focus trap, escape), archive pagination URL state, single param to query binding.
