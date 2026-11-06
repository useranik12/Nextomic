# Dynamic Data, State, and Actions Spec

## 1. Dynamic data

- Dynamic data works EVERYWHERE (see "Universal dynamic data" in `elements.md`): content, attributes, style values, conditions, action params, query params, route and SEO fields.
- Any input accepts a mix of static text and dynamic tokens, e.g. `Hello {{user.name}}, you have {{query.orders.count}} orders`. Token syntax is `{{ path }}` everywhere except inside API call definitions (see `integrations.md`).
- The bolt icon (amber) opens the dynamic data modal: searchable, grouped, type-aware, with live preview values.
- Groups: **Site**, **Page**, **Template**, **User** (see `app-auth.md`), **App state**, **Constants**, **Page state**, **Route params**, **Component/Item (loop)**, **Supabase Query (<element/query name>)**, **API Query (<name>)**, **Form** (values of named form fields), **Action outputs**, **Date/Time**, **Theme** (active theme name and color mode).
- Dot notation reaches into nested JSON (`item.address.city`, `response.data[0].id`). Parent query data can be parsed by children with dot notation.
- Dynamic data renders on the editor canvas.

### Preview values (rule)

- The builder stores STRUCTURE only. Preview values come from (a) a live fetch through the builder proxy that is held in memory only, or (b) sample values the user wrote by hand (stored; they are user-authored, not fetched rows).
- The modal and the canvas show which kind of value is used and a refresh button for live fetches.
- Fetch results are never persisted in the database, backups, or exports.

### Token resolution (built)

Dynamic tokens in text are written `{{group.name}}` and resolved by `createTokenResolver` (`packages/schema/src/dynamic-context.ts`) from a `DynamicContext` the editor canvas, the owner preview and the published site each build with `buildDynamicContext`. Groups: `page.name|route`, `request.url|path|query`, `now.iso|date|time|year` (shown in the context's time zone), `user.id|email|name|role` (empty while signed out), `env.mode` (editor, preview, live), `param.<name>` (the address value, else the default) and `state.<name>[.path]` (the starting value; JSON values can be followed with dots). `attr @ <cssID>:<attribute-name>` (for example `{{attr @ nxtomc-ab12cd34:aria-label}}`) reads an attribute of another element on the page by its CSS ID (plain text; tokens inside it are not expanded again). It is the only element tag; the dynamic data picker lists it once as "Target element's attribute" and shows how to write it on hover. Style values take tokens too: they are filled in when the CSS is built, and a value that still has an unresolved token is dropped. Unknown tokens give empty text, never raw braces. The renderer takes the context as `dynamic` on `PageRenderer`. Style values, queries, loops and conditions arrive with the Data layer phase.

## 2. Scoping rules

- Query data is available only to the element that owns the query and its descendants. Parents and siblings cannot see it.
- Loop item data is available inside the looped element and its descendants as `item` (and `index`, `count`, `isFirst`, `isLast`).
- Nested loops expose parent scopes by name (`item`, `parent.item`).
- App state and constants are global. Page state is page-wide. Template queries are available inside that template.
- The picker only shows tokens valid for the selected element. An out-of-scope token is a validation error at save time.

## 3. Queries

- Sources: Supabase (table select, filters, order, pagination, rpc), REST endpoint (API Data call), App state, Static JSON.
- A query can be attached to: any div-based element (as a loop), a page or template (runs on load), or fired by an action ("query data", "refresh query with new parameters").
- Query parameters accept bindings (variables, form values, route params, filter elements).
- Each query defines: name (unique in scope), source, params, loading/empty/error UI behavior, caching, run-on-load flag, and result shape.
- **Schema saving:** On connect, "Fetch Schema", or "Test API", the builder stores the STRUCTURE only (tables, columns, types; JSON response shape inferred from a test call). No row data is stored. The stored structure powers query field pickers and dynamic data tokens everywhere. Re-fetch on demand and show diffs; deprecate removed fields with warnings.

## 4. Loops

- Add a loop to any div-based element (Element tab, "Query loop" toggle at the top): source = query, app state list, or parent item array.
- Children are the template; the renderer duplicates them per item automatically.
- Settings: limit, offset, empty state element, loading state element, key field, pagination link (Pagination/Filter/Search elements).
- Editor shows the template plus a preview of N items (configurable).

## 5. State: app state, constants, page state

UI: State Management page (tabs App State and Constants, `ui-reference.md` 4.10) and the Page State Variables list in the right panel when nothing is selected (4.3).

- **App state variables** (global): typed, optionally a list. Types: String, Integer, Float, Boolean, DateTime, Date, Time, Color, URL (image, video, audio), JSON (object), Enum. Each has a name, default value, description, and a **Persist** switch.
- **Constants** (global, read-only at runtime): same types, a fixed value and description. Actions cannot change them.
- **Page state variables** (per page): same types, local to the page, reset when the page is left, never persisted.
- Actions can set, update (increment, toggle, append to list, remove from list, merge object), and reset state variables.
- Switch element value and form field values are bindable to state.

### Persistence of app state

- Persist ON means the value is stored in the visitor's browser and restored on the next visit, even after the tab or browser was closed. It lasts until the visitor logs out or clears site data. If the site has no authentication, it lasts until site data is cleared.
- Storage: **local storage** (default), or **cookie** for small values the server needs to read during SSR (for example a UI preference). Cookie values are sent with every request and are limited to about 4 KB each; show that warning.
- Logout clears every persisted variable unless the variable has "Keep after logout" on (for example a cookie consent flag or a language choice).
- Keys are namespaced (`nxt:<projectId>:state:<name>`). Values are stored with a schema version. If a later publish changes a variable's type or default, a stored value of the old version is converted when possible, otherwise reset to the default (never crash).
- Restore happens on the client after hydration. The server render uses the default value, so avoid flash: bind persisted state in places where a brief default is acceptable, or use cookie storage for values that change what the server renders.
- Persisted values are visitor-editable. Never use them for authorization or trust decisions, and never persist passwords, tokens, or other secrets. The State Management page warns about this, and the runtime refuses to persist a variable bound to a password field.
- Total persisted size is capped (about 1 MB); writes beyond the cap fail with a handled error and a console warning in dev.
- The editor preview uses an isolated storage namespace so preview data never mixes with the published site, and offers "Clear persisted state".
- Tests: restore after reload, logout clears, "Keep after logout", type change migration, cookie size limit, no persistence for page state and constants.

## 6. Type conversion and formatting

- When binding a value, an optional "transform" chain applies: string↔int, string↔float, int↔float, to/from boolean, to string, JSON parse/stringify, uppercase/lowercase/capitalize, trim, truncate, replace, default if empty, array length/join/first/last, math (round, floor, ceil), number format (decimals, thousands, currency, percent).
- **Date/time formatting:** any timestamp/timestamptz or static date can be formatted with built-in presets (e.g. date, time, date-time, relative "2 hours ago", ISO, custom pattern) plus timezone and locale options. Invalid dates fall back to a configurable placeholder.
- Transforms are typed: the UI only offers transforms valid for the input type. Failed conversions use the configured fallback, never crash the page.

## 7. Conditional visibility (Element tab, every element)

- Condition groups with AND/OR, nesting allowed.
- Operands are bindings (state, query data, user, route param, form value, date, theme, color mode). Operators: equals, not equals, greater, less, contains, starts/ends with, is empty, is not empty, is true, is false, in list, matches regex.
- Evaluated reactively on the client; for SSR/SSG-safe conditions, evaluated at render time when inputs are server-known.
- Hiding by user or role is cosmetic only. Protect data and pages on the server (see `app-auth.md`).
- Editor can preview with condition forced on/off.

## 8. Action flows

Interactions and logic are the core of the builder. Each element, page, and template has an Action tab with triggers; each trigger holds an action flow.

### 8.1 Action flow editor (replicate `blueprint/inspiration/flutterflow-action-flow-editor.png`)

Layout and behavior are in `ui-reference.md` (4.8). Rules:

- Three columns: trigger list, flow canvas, "Define Action" panel. Full-screen modal with Close.
- Triggers are listed with an action count and delete. Search and "+" add a trigger.
- Cards on the canvas show "Action N", the action name, and a one-line summary. "+" above and below the selected card inserts a step. Conditions render True and False branches. Parallel renders side-by-side lanes.
- A card with no action type shows "Not defined" and counts as an error. The error badge at the top right lists all invalid cards; clicking jumps to the first. Publishing is blocked while any action has a hard error (warnings allowed).
- Each action card can be renamed, disabled, duplicated, and deleted. Disabled actions are skipped.
- Every parameter has a bolt (dynamic data). Outputs are named and appear in the dynamic data modal under "Action outputs" for later steps.
- Dry run: run the flow in the editor with sample data. Destructive actions (delete, sign out, send email, webhook) are skipped unless dry run is off.
- "App Action Blocks" (reusable flows) is a later feature tied to reusable components; show the category disabled with a "Coming later" note.

### 8.2 Triggers

onClick, onDoubleClick, onHover, onChange, onInput, onFocus, onBlur, onSubmit, onKey, onScrollIntoView, onLoad (element), page load, template load, onQuerySuccess, onQueryError, timer/interval, popup opened/closed, custom event.

### 8.3 Flow model

```ts
type ActionStep =
  | {
      id: string;
      type: string;
      name?: string;
      disabled?: boolean;
      params: Record<string, Binding>;
      target?: TargetRef;
      outputName?: string;
      onSuccess?: ActionStep[];
      onError?: ActionStep[];
    }
  | { id: string; type: "condition"; if: ConditionGroup; then: ActionStep[]; else?: ActionStep[] }
  | { id: string; type: "parallel"; branches: ActionStep[][] };
```

### 8.4 Action catalog (categories mirror the FlutterFlow picker; Nextomic adds the marked ones)

- **Navigation:** navigate to page (route params, query string), open URL, go back, reload page, scroll to element, open/close popup (template)
- **Backend/Database:** query data, refresh query with new parameters, Supabase insert/update/delete/rpc, call REST endpoint (API Data), file upload to storage
- **Authentication (added):** sign up, sign in, sign in with OAuth, send magic link, send/verify OTP, sign out, request/update password, update user, refresh session, get current user, resend verification. Full list and rules in `app-auth.md`. Available on every element.
- **App Events:** page load, template load, timer, custom event emit/listen, set loading state
- **State Management:** set/update/reset app state and page state, set variable from query or output, clear persisted state
- **Widget/UI Interactions:** show/hide/toggle, set text/attribute/value, add/remove/toggle class, add/remove ID, enable/disable, focus, open/close off-canvas/accordion/tab/dropdown, expand/collapse, copy to clipboard, set color mode, toggle color mode
- **Forms (added):** set/clear/reset field, validate (field or form), submit, set error, mask toggle, captcha validate
- **Media (added):** play, pause, stop, repeat/loop toggle, seek, mute (video/audio)
- **Alerts/Notifications:** toast, dialog, confirm
- **Utilities:** wait, condition, loop over list, pick date/time, download file, store locally, console/debug log (dev only)
- **Share:** Web Share API, copy link
- **Animation:** start/stop saved animation on target, GSAP timeline control
- **Device (added):** vibrate (preset rhythms and custom patterns)
- **Integrations:** send email (project SMTP), call webhook, captcha providers
- **Custom Actions:** project custom functions (see `dependencies.md`, Custom Codes)
- **App Action Blocks:** later

### 8.5 Execution model

- Client actions run in a small generated runtime (`packages/runtime`) shipped with the built app. Keep it tree-shakable; include only actions used.
- Server actions (send email, webhook with secrets, bucket upload, privileged DB calls, auth session cookies) compile to generated server handlers (Next route handlers / Astro endpoints). Secrets live in env vars of the app, never in client code.
- Preview in the editor executes actions through the builder proxy in a sandbox with the dry-run toggle.
- Custom functions come from the project's custom code, type-checked and executed only in the generated app or sandboxed preview, never in the builder process.

## 9. Tests

Token parsing and scope validation, universal bindability, loop duplication, transform chains and datetime formats, condition evaluation, action flow execution (success/error paths, parallel, disabled steps), flow editor error badge, schema save without row data, preview values never persisted, server action generation with no secret leakage.
