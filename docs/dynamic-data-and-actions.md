# Dynamic Data, State, and Actions Spec

## 1. Dynamic data

- Dynamic data works EVERYWHERE (see "Universal dynamic data" in `elements.md`): content, attributes, style values, conditions, action params, query params, route and SEO fields.
- Any input accepts a mix of static text and dynamic tokens, e.g. `Hello {{user.name}}, you have {{query.orders.count}} orders`. Token syntax is `{{ path }}` everywhere except inside API call definitions (see `integrations.md`).
- The bolt icon (yellow) opens the dynamic data modal: searchable, grouped, type-aware, with live preview values.
- Groups: **Site**, **Page**, **Template**, **User** (the built app's signed-in user, see `app-auth.md`), **Nextomic User** (the builder account viewing the editor or preview: `{{nextomic.user.id|name|email|image|role|emailVerified|twoFactorEnabled|passkeys|createdAt}}`; empty on live sites; no tokens), **App state**, **Constants**, **Page state**, **Route params**, **Component/Item (loop)**, **Supabase Query (<element/query name>)**, **API Query (<name>)**, **Form** (values of named form fields), **Action outputs**, **Date/Time**, **Theme** (active theme name and color mode).
- Dot notation reaches into nested JSON (`%posts.item.address.city`, `response.data[0].id`). Parent query data can be parsed by children with dot notation.
- Dynamic data renders on the editor canvas.

### Preview values (rule)

- The builder stores STRUCTURE only. Preview values come from (a) a live fetch through the builder proxy that is held in memory only, or (b) sample values the user wrote by hand (stored; they are user-authored, not fetched rows).
- The modal and the canvas show which kind of value is used and a refresh button for live fetches.
- Fetch results are never persisted in the database, backups, or exports.

### Token resolution (built)

Dynamic tokens in text are written `{{group.name}}` and resolved by `createTokenResolver` (`packages/schema/src/dynamic-context.ts`) from a `DynamicContext` the editor canvas, the owner preview and the published site each build with `buildDynamicContext`. Groups: `page.name|route`, `request.url|path|query`, `$now` and `$today` (timestamps in the context's time zone; the older `now.iso|date|time|year` still works but is not suggested), `user.id|email|name|role` (empty while signed out), `env.mode` (editor, preview, live), `param.<name>` (the address value, else the default) `state.<name>[.path]` (page state, the starting value; JSON values can be followed with dots), `app.<name>[.path]` (app state, its default value until actions change it) and `const.<name>[.path]` (constants). `attr @ <cssID>:<attribute-name>` (for example `{{attr @ nxtomc-ab12cd34:aria-label}}`) reads an attribute of another element on the page by its CSS ID (plain text; tokens inside it are not expanded again). It is the only element tag; the dynamic data picker lists it once as "Target element's attribute" and shows how to write it on hover. Style values take tokens too: they are filled in when the CSS is built, and a value that still has an unresolved token is dropped. Unknown tokens give empty text, never raw braces. The renderer takes the context as `dynamic` on `PageRenderer`. Style values, queries, loops and conditions arrive with the Data layer phase.

### Expressions (built)

Everything between `{{` and `}}` is an expression in a JavaScript-like syntax, n8n style; text outside the braces is plain text. Examples: `{{ user.name.toTitleCase() }}`, `{{ app.since.toFormat('yyyy-MM-dd') }}`, `{{ app.cart.map(i => i.price).sum().format('en-US') }}`, `{{ app.count > 1 ? 'items' : 'item' }}`, `{{ $ifEmpty(user.name, 'Guest') }}`.

- **Engine:** `packages/schema/src/expression/` parses and interprets expressions itself; it never uses `eval`, `Function` or the host's objects, so the same code runs safely in the builder, the preview and the published site.
- **Syntax:** names, `.field`, `?.field`, `[index]` and `.0`, calls, arrow functions (`x => …`, `(a, b) => …`), `! - +`, `* / % + -`, comparisons, `== != === !==`, `&& || ??`, `a ? b : c`, arrays, objects and template literals with `${}`. No assignment, `new`, statements or loops.
- **Roots:** `page`, `template`, `request`, `user`, `env`, `param`, `state`, `app`, `const`, `$now` and `$today` (timestamps), the namespaces `Math`, `JSON` and `DateTime`, and the functions `$if`, `$ifEmpty`, `$min`, `$max`, `Number`, `String`, `Boolean`, `parseInt`, `parseFloat`.
- **Typed values:** state, constants and params arrive with their declared type: Number as a number, Boolean as true or false, JSON and data types as objects, lists as arrays, and Timestamptz as a Luxon `DateTime` (so `.toFormat()`, `.plus()`, `.toRelative()` and the other date methods work). A text value can become a date with `.toDateTime()`.
- **Methods:** only the methods in the catalog (`methods.ts`) can be called: JavaScript's own string, number, array and object methods plus n8n-style helpers (for example `toTitleCase`, `extractEmail`, `round(2)`, `format(locale)`, `pluck`, `unique`, `sum`, `isEmpty`, `toFormat`). The same catalog feeds the evaluator and the suggestion panel (`ui-reference.md` 4.15), with a description and an example for each.
- **Stored as written:** the text between the braces is stored with its spaces, so `{{ app.x }}` stays as typed.
- **Where used and renames** find `app.x` and `const.x` anywhere inside an expression (for example in `$if(app.x, …)`), not only at its start.
- **Problems:** `expressionProblem` reports syntax errors, unknown names, undeclared `app`/`const`/`state`/`param` variables and runtime errors; the editor marks such tags red and the element gets a red dot in the Navigator.
- **Safety:** `__proto__`, `prototype` and `constructor` are never read; only own properties are visible; a run is capped at 50,000 steps, 100,000 characters of text and 10,000 list items. Any error makes the expression give empty text on the page; the editor's suggestion panel shows the error.

## 2. Scoping rules

- Query loop data is available only to the DESCENDANTS of the element that owns the query (owner decision 2026-11-08): not the element itself, its parents or its siblings. A tag used outside that scope is an unknown name: the Navigator marks the element with a red dot and save-time validation reports it.
- **Loop tags start with `%`** (owner decision 2026-11-09): plain names are dynamic data (`user.name`), `$` names are expression helpers (`$now`, `$ifEmpty`), and `%` names are query loops. Every loop has a **Loop name** (an identifier, unique on its page); inside the loop `%name.item` is the current row and `%name.index` its position, e.g. `{{ %posts.item.title }}`. Nested loops are told apart by name (`{{ %comments.item.body }} on {{ %posts.item.title }}`). `%` after a value is still modulo (`n % 2`, `n %2`). Built: `withLoopScope`, `loopFrame`, `loopAncestors` (`query-scope.ts`), names in `loop-names.ts`.
- Loop names: a new loop is named after its source (`supabaseLoop`, `restLoop`, numbered when taken: `supabaseLoop2`); a name still at its default follows the Query Type when it changes. Renaming in the Loop name field renames every `%old` tag inside the loop (`renameLoopTag`). A duplicated or pasted loop gets a free name and its own tags follow (`uniqueLoopNames`, run after every editor change). An invalid or taken name is refused with the reason.
- Pages saved before loop names (with `item`, `index`, `parent.item`) are upgraded when read (`pageTreeSchema` = `upgradeLoopTree`): their loops get default names and the old tags inside them are rewritten to `%name.…` (fields after a dot, arrow function parameters and quoted text are left alone). Editor, preview and live site all read the upgraded form; saving stores it.
- In the dynamic data picker the query's group is named after the element and the query type, e.g. "Post grid (Supabase Query)" (`queryLabel`).
- App state and constants are global. Page state is page-wide. Template queries are available inside that template.
- The picker only shows tokens valid for the selected element. An out-of-scope token is a validation error at save time.

## 3. Queries

- Sources: Supabase (table select, filters, order, pagination, rpc), REST endpoint (API Data call), App state, Static JSON.
- Query loops (owner decision 2026-11-08) are available on **Container and Section only**, set in the Element tab's "Query Loop" group: "Enable Query Loop" toggle (everything below is disabled while off), Loop name, Query Type (Supabase Query or REST API; a type is disabled until that source is set up).
  - Supabase: table or view (searchable, A to Z, tables and views listed separately), Single Row or List of Rows (List shows Limit, default 20, up to 1000), Filters repeater (column, then only the operators PostgREST accepts for that column's type (`operatorsFor`), then a value control matching the type; values accept dynamic data), Order by repeater (column, Increasing or Decreasing), "Enable realtime query" (off by default) and "Infinite scroll" (loads more rows when 90% of the loaded rows have been viewed).
  - REST API: a saved API Data call, a value for each of its variables (dynamic data allowed; unset uses the variable's default), the list to loop over (the whole response or one of the call's saved JSON paths by Name), Single or List with Limit, Infinite scroll.
  - Model: `ElementNode.query` (`elementQuerySchema` in `packages/schema/src/query.ts`): `enabled`, `source`, and the settings of both sources (switching type keeps the other's settings). `queryProblems` lists what stops it from running.
  - On the live site the first render runs queries on the server (REST secrets stay there; Supabase uses the anon key); the client runtime then re-fetches, scrolls for more and streams realtime changes through the site query endpoint. The editor canvas fetches live through the builder proxy and keeps results in memory only.
  - Running (built, 4e step 2): `packages/schema/src/query-run.ts` turns a query into a connector request and the answer into rows (`supabaseQueryRequest`, `restQueryValues`, `supabaseRows`, `restRows`), pure and shared by canvas and site. Filled values are typed by column (numbers, booleans, comma-separated lists for `in` and array columns, JSON for JSON containment, `is` takes null/true/false); a filter whose filled value is empty is left out, so an empty search shows everything. Single Row asks for one row. REST loops read the chosen JSON path (or the whole response; an empty body is an empty list) and page through that list for infinite scroll; Supabase pages with `offset`, and a full page means more may follow. `apps/editor/src/server/queries/run-query.ts` loads the project's connector and saved structure and runs it: the editor canvas (`runQueryAction`) goes through the connector proxy as the member, sending templates it already filled with preview values (`queryTemplates`, `fillFrom`; the server never evaluates expressions sent by a browser); the site's server render fills templates itself (`fillWith`) and runs the connector directly (`siteExecutor`).
  - Panel (built, 4e step 3): `apps/editor/src/components/editor/query/`. The group loads the saved Supabase structure and API Data config each time it opens (`getQuerySourcesAction`; definitions only, auth values stay on the server). Turning the toggle off keeps the settings; the settings below stay visible but inert. Choosing another table keeps only the filters and order rows whose column still exists. A filter's value is a select where the column has fixed values (boolean and enum for Equal/Not equal, `is` = null/true/false), otherwise a text field with a placeholder for its type; both take dynamic data through the bolt, and a value holding a tag becomes a text field. Changing the column resets the value and keeps the condition only when it still fits. A REST loop offers the call's variables and its group's shared variables (`callVariables`; the call's own wins); an inactive call is listed but disabled. `queryProblems` show as warnings under the settings.
  - Rendering (built, 4e step 4): a loop element renders once and repeats its children once per row; each copy reads `%name.item` and `%name.index` of its loop and of every loop around it (`createTokenResolver(context, frames)`). A loop run is keyed by its place, the outer loops' element ids and row positions, then its own id (`loopKey`: `posts#2/comments`), so a nested loop runs once per outer row. `collectLoopRows` (`packages/schema/src/query-loop-rows.ts`) runs the loops level by level, in parallel per level, outer first; a failing run gets no rows, so a broken query shows nothing instead of breaking the page. The renderer takes the finished rows as `loopRows` and stays synchronous.
    - Published site and preview: `pageLoopRows` (`server/queries/run-query.ts`) collects the rows on the server before rendering (up to 100 runs per page) and fills templates from the page's own dynamic context. The site runs connectors directly in the project's workspace; the preview goes through the connector proxy as the signed-in member. Pages without loops make no extra queries.
    - Editor canvas: `useCanvasLoopRows` fetches live through `runQueryAction` (up to 30 runs, 400 ms after the last edit) and sends the rows to the canvas iframe with the render message. Results stay in memory, cached by query and filled values, so edits that do not change a query do not refetch; a failed run is retried on the next change and its message shows in the Query Loop group ("Canvas preview: ..."). Until rows arrive the canvas shows the children once with an empty row so they stay selectable; with zero rows it shows none, like the live site.
    - Dynamic data picker: the bolt lists one group per enclosing loop, innermost first, named "%name · <element name> (<query type>)" (outer ones marked "outer loop"): `%name.item`, `%name.index` and, for Supabase, `%name.item.<column>` for each column of the table. The expression suggestion panel lists the loops around the selected element under "Query loops" when you type `%`, then `item`/`index` and the row's fields after the dot.
    - Client runtime (built, 4e step 5): published pages mark loop elements (`loopMarkers`: `data-nx-loop` key, `data-nx-count`, `data-nx-more`, `data-nx-scroll`, `data-nx-realtime` = `schema.table`) and the top elements of each copy (`data-nx-row` position). `LoopRuntime` (`components/runtime/loop-runtime.tsx`, rendered only on pages with loops) watches the row at 90% of the loaded rows of an infinite scroll loop; when it scrolls into view it asks `POST /api/site/<projectId>/loop` for the next page (offset = rows loaded) and appends the returned HTML. A realtime loop's table is watched with Supabase Realtime from the browser (anon key, see `integrations.md`); a change reloads the loop's first page (debounced 300 ms) and replaces its rows. The loop is `aria-busy` while loading; a failed load keeps what is shown and retries after 5 s.
    - Site loop endpoint (`pages/api/site/[id]/loop.ts`): public, rate limited (120 requests per minute per visitor IP and project, 1200 per project), body at most 16 KB, validated with Zod: `route`, `search`, `key`, `offset`. The server loads the published page, checks the key names a loop run of that page (`parseLoopKey`; its outer loops must be the element's real loop ancestors), runs the outer loops again from the key's row positions to get their rows, runs the loop from `offset` and its nested loops for the new rows only (`loopPage`, `collectLoopRows` with a start and a sparse seed), fills every template itself, and answers `{html, count, hasMore}` rendered by `renderLoopCopies`. A visitor cannot change what a query asks for; anything else gets 400, 404 or 429.
    - The preview renders the first page of each loop only (no client runtime: the endpoint serves published pages). A realtime reload shows the first page again, dropping rows loaded by scrolling.
    - Known limits: style values that use loop tags resolve without the row (the CSS is per element, not per copy); copies keep the element's CSS ID, so an ID repeats inside a loop; loops in the 404 template render no rows; the server-filled REST values `[jwt]` and `[user_ip]` are empty in loops until app sessions reach the site render.
  - Page and template level queries, and queries fired by actions ("query data", "refresh query with new parameters", Phase 5), come later.
- Query parameters accept bindings (variables, form values, route params, filter elements).
- Each query defines: name (unique in scope), source, params, loading/empty/error UI behavior, caching, run-on-load flag, and result shape.
- **Schema saving:** On connect, "Fetch Schema", or "Test API", the builder stores the STRUCTURE only (tables, columns, types; JSON response shape inferred from a test call). No row data is stored. The stored structure powers query field pickers and dynamic data tokens everywhere. Re-fetch on demand and show diffs; deprecate removed fields with warnings.

## 4. Loops

- Query loops are on Container and Section only (section 3, Query Loop group). Loops over an app state list or a parent item array come later and will use the same group.
- Children are the template; the renderer duplicates them per item automatically.
- Settings: limit, offset, empty state element, loading state element, key field, pagination link (Pagination/Filter/Search elements).
- Editor shows the template plus a preview of N items (configurable).

## 5. State: app state, constants, page state

UI: State Management page (tabs App State and Constants, `ui-reference.md` 4.10) and the Page State Variables list in the right panel when nothing is selected (4.3).

- **App state variables** (global): typed, optionally a list. Types: String, Int (whole numbers), Float (any number), Boolean, JSON, Timestamptz, Color, URL, ENUM (an enum from the Data Types page), Data Type (a custom data type from the Data Types page), Supabase Row (a row of a fetched Supabase table or view, from step 4d). Each has a name, default value, description, and a **Persist** switch.
- **Constants** (global, read-only at runtime): same types, a fixed value and description. Actions cannot change them.
- **Page state variables** (per page): same types, local to the page, reset when the page is left, never persisted.
- **Page parameters**: String, Number, Boolean or Timestamptz (they come from the address).
- **Enums and custom data types** (Data Types page, `ui-reference.md` 4.14): an enum is an ordered list of unique text values; a data type is a set of named, typed fields (every type except Supabase Row, each optionally a list). Values are checked against them when saved (`checkStateValue` with the project's enums and data types).
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
