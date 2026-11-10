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
- **Tags need spaces (n8n style, owner decision 2026-11-09):** a tag is `{{ expression }}` with a space after `{{` and before `}}`; `{{x}}` is plain text, so braces can be written as text. The bolt picker and `{{` auto-close always insert the spaced form (`tagText`). When an edit adds a `{{x}}` to a field with the bolt, a small prompt asks "Fix tag" (adds the spaces) or "Keep as text" (`TagFixPrompt`, `unspacedTags`). Migration `0009_spaced_tags` rewrote tags stored in the old form once.
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
- Query loops (owner decision 2026-11-08) are available on **Container and Section only**, set in the Element tab's "Query Loop" group: "Enable Query Loop" toggle (everything below is disabled while off), Loop name, Query Type (Supabase Query, REST API or Other Loops; Supabase and REST are disabled until that source is set up).
  - Supabase: table or view (searchable, A to Z, tables and views listed separately), Single Row or List of Rows (List shows Limit, default 20, up to 1000), Filters repeater (column, then only the operators PostgREST accepts for that column's type (`operatorsFor`), then a value control matching the type; values accept dynamic data), Order by repeater (column, Increasing or Decreasing), "Enable realtime query" (off by default) and "Infinite scroll" (loads more rows when 90% of the loaded rows have been viewed).
  - REST API: a saved API Data call, a value for each of its variables (dynamic data allowed; unset uses the variable's default), the list to loop over (the whole response or one of the call's saved JSON paths by Name), Single or List with Limit. No infinite scroll for REST yet (owner decision 2026-11-09: it comes back with support for paged APIs).
  - Other Loops (owner decision 2026-11-09, `localLoopQuerySchema`, rows from `localLoopRows` in `query-local.ts`): a Source select, then:
    - Page Parameters, Page State, App State, Constants: a Variable select (only lists, JSON and text variables can be picked; any page parameter). A JSON array written as text is parsed; page parameters may also be comma-separated text (`?tags=a,b`).
    - Parent Item: an enclosing loop (`%name`) and the List field in its row, a JSON path after `$.` (`tags`, `images[0].sizes`).
    - Static JSON: a JSON array typed in the panel (checked as you type).
    - Expression: one `{{ tag }}` that gives a list (`{{ app.cart.filter(i => i.qty > 0) }}`); it covers every other dynamic source.
    - Then Single or List with Limit, and Offset (rows skipped from the start). No infinite scroll or realtime: every row is already there.
    - Rows are read from the scope the loop runs in (server render, loop endpoint, canvas), with no request and nothing taken from a visitor. A value that is not a list gives no rows; at most 10,000 items. Default names: `parameterLoop`, `pageStateLoop`, `appStateLoop`, `constantLoop`, `parentLoop`, `jsonLoop`, `expressionLoop`.
    - Known limit until Phase 5: app state persisted in the browser (localStorage) renders with its default value; the client state store then re-renders affected loops.
  - Model: `ElementNode.query` (`elementQuerySchema` in `packages/schema/src/query.ts`): `enabled`, `source`, and the settings of both sources (switching type keeps the other's settings). `queryProblems` lists what stops it from running.
  - On the live site the first render runs queries on the server (REST secrets stay there; Supabase uses the anon key); the client runtime then re-fetches, scrolls for more and streams realtime changes through the site query endpoint. The editor canvas fetches live through the builder proxy and keeps results in memory only.
  - Running (built, 4e step 2): `packages/schema/src/query-run.ts` turns a query into a connector request and the answer into rows (`supabaseQueryRequest`, `restQueryValues`, `supabaseRows`, `restRows`), pure and shared by canvas and site. Filled values are typed by column (numbers, booleans, comma-separated lists for `in` and array columns, JSON for JSON containment, `is` takes null/true/false); a filter whose filled value is empty is left out, so an empty search shows everything. Single Row asks for one row. REST loops read the chosen JSON path (or the whole response; an empty body is an empty list) and page through that list for infinite scroll; Supabase pages with `offset`, and a full page means more may follow. `apps/editor/src/server/queries/run-query.ts` loads the project's connector and saved structure and runs it: the editor canvas (`runQueryAction`) goes through the connector proxy as the member, sending templates it already filled with preview values (`queryTemplates`, `fillFrom`; the server never evaluates expressions sent by a browser); the site's server render fills templates itself (`fillWith`) and runs the connector directly (`siteExecutor`).
  - Panel (built, 4e step 3): `apps/editor/src/components/editor/query/`. The group loads the saved Supabase structure and API Data config each time it opens (`getQuerySourcesAction`; definitions only, auth values stay on the server). Turning the toggle off keeps the settings; the settings below stay visible but inert. Choosing another table keeps only the filters and order rows whose column still exists. A filter's value is a select where the column has fixed values (boolean and enum for Equal/Not equal, `is` = null/true/false), otherwise a text field with a placeholder for its type; both take dynamic data through the bolt, and a value holding a tag becomes a text field. Changing the column resets the value and keeps the condition only when it still fits. A REST loop offers the call's variables and its group's shared variables (`callVariables`; the call's own wins); an inactive call is listed but disabled. `queryProblems` show as warnings under the settings.
  - Rendering (built, 4e step 4): a loop element renders once and repeats its children once per row; each copy reads `%name.item` and `%name.index` of its loop and of every loop around it (`createTokenResolver(context, frames)`). A loop run is keyed by its place, the outer loops' element ids and row positions, then its own id (`loopKey`: `posts#2/comments`), so a nested loop runs once per outer row. `collectLoopRows` (`packages/schema/src/query-loop-rows.ts`) runs the loops level by level, in parallel per level, outer first; a failing run gets no rows, so a broken query shows nothing instead of breaking the page. The renderer takes the finished rows as `loopRows` and stays synchronous.
    - Published site and preview: `pageLoopRows` (`server/queries/run-query.ts`) collects the rows on the server before rendering (up to 100 runs per page) and fills templates from the page's own dynamic context. The site runs connectors directly in the project's workspace; the preview goes through the connector proxy as the signed-in member. Pages without loops make no extra queries.
    - REST loops on the canvas run only after **Fetch preview** (a button at the end of the Query Loop group, `RestPreview`), and run again only when it is pressed after the query changed ("Fetch preview again"); until then the canvas shows the placeholder copy. REST requests can cost money (owner decision 2026-11-09). Supabase loops still fetch live. Approval is per element and query, in memory only (`useLoopPreview.approve`).
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

- Query loops are on Container and Section only (section 3, Query Loop group). Loops over page parameters, page or app state, constants, a parent item's list, static JSON or an expression are the "Other Loops" query type.
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

**Built (2026-11-09, owner decision: UI option A, bolt modal):**

- A chain is not stored on its own. It compiles to the expression methods the evaluator already runs and is written into the field as a normal tag, so page, server and canvas evaluate it unchanged and it stays editable by hand. Example: `{{ $ifEmpty(app.price?.round(2)?.format("en-US", { style: "currency", currency: "USD" }), "-") }}`. Every step uses `?.`, so an empty value passes through to the fallback instead of failing.
- Source of truth: `packages/schema/src/expression/transforms.ts` (`TRANSFORMS` catalog, `transformsFor`, `chainKinds`, `compileTransformChain`, `parseTransformChain`).
- Steps: Convert (To number, To whole number, To true / false, To text: lists and objects become JSON text, Parse JSON, To date with an optional read format); Text (Uppercase, Lowercase, Capitalize every word or first letter, Trim spaces, Truncate with ending, Replace first or every match); List (Length, Join items, First item, Last item); Number (Round with decimals, Round down, Round up, Format number: number, currency or percent, fixed decimals, language); Date (Format date).
- Format date presets: Date, Time, Date and time, Relative, ISO, Custom pattern (Luxon tokens), plus time zone (IANA name; an unknown zone shows an error) and language. Text input (ISO or SQL timestamps) is read as a date first; text that is no date gives empty, which shows the fallback.
- "Fallback when empty" wraps the chain in `$ifEmpty(…, "text")`. It covers empty values, missing values and dates that cannot be read.
- Typing: the starting kind comes from the tag's preview value (empty or unknown = any value, which offers every step). Each step's output kind decides what the Add list offers next; a step whose input no longer fits after reordering shows a warning.
- Engine additions for transforms: `toInteger()` on text and numbers, `toTimeString(locale?)` on dates, an optional `locale` on `toFormat`, and `setZone` refusing unknown zones.
- Limit: a tag reopens in the Transform view only when it is a plain path followed by known steps; anything hand-written is edited in the field.

## 7. Conditional visibility (Element tab, every element)

- Condition groups with AND/OR, nesting allowed.
- Operands are bindings (state, query data, user, route param, form value, date, theme, color mode). Operators: equals, not equals, greater, less, contains, starts/ends with, is empty, is not empty, is true, is false, in list, matches regex.
- Evaluated reactively on the client; for SSR/SSG-safe conditions, evaluated at render time when inputs are server-known.
- Hiding by user or role is cosmetic only. Protect data and pages on the server (see `app-auth.md`).
- Editor can preview with condition forced on/off.

**Built (2026-11-09, owner decisions):**

- Element tab group "Conditions" (after the element's own settings, before Attributes). Empty state: a short explanation and "Add condition". With conditions: "Enable conditions" switch (off keeps them but always shows the element), "Canvas preview" Auto / Show / Hide, the top group's match (All = AND, Any = OR), condition cards and "Add condition" / "Add group". Groups nest up to 4 levels; at most 50 conditions per element.
- A condition is Value, Operator, Compare with. Both values are text with `{{ tags }}`. A value that is one lone tag keeps its type (a list stays a list, a number a number); mixed text becomes text. Operators: equals, does not equal, is greater than, is less than (numbers and dates), contains, does not contain (text, or an item of a list), starts with, ends with, is empty, is not empty, is true, is false, is in list, is not in list (comma separated or a list tag), matches pattern. Text compares ignore case.
- Condition type (added 2026-11-09, owner decision): every condition first picks **Value comparison** (the Value / Operator / Compare with model above), **Class**, **ID** or **Attribute**. The last three check an element: **Element** is "This element" (default) or any other element on the page; the operator is **has** or **does not have**; then the class name, the ID, or the attribute name with an optional **Attribute value** (empty = only check the attribute is there; filled = the value must equal it, ignoring case). Class names and IDs match exactly, as in CSS; attribute names ignore case. All fields take `{{ tags }}`. The check reads what the element outputs (its classes, ID and allowed attributes with tags resolved), so it always agrees with the HTML. An element that is no longer on the page has nothing ("has" fails, "does not have" holds) and the editor says so. Changing the type starts the condition empty. Meant for the Phase 5 actions that add, remove or toggle classes, IDs and attributes; until the client runtime lands, the check uses what the element has when the page renders.
- "Is in list" / "is not in list": Compare with is a chip field. A comma (outside a tag) or Enter turns the typed text into a grey chip; Backspace in the empty field removes the last chip whole; double-click a chip (or Enter on a focused chip) to edit it, Enter saves, Escape cancels; each chip has a remove button; the bolt adds a tag as a chip. Saved as comma separated text (the format the condition reads), so older values keep working.
- Pattern safety: at most 200 characters, nested repeats like `(a+)+` are refused, the tested text is capped at 10,000 characters, an invalid pattern never matches.
- Rendering: an element whose conditions fail is not rendered at all. It is missing from the published HTML, the preview and the canvas DOM. Conditions are evaluated with the loop rows around the element (a loop element's own conditions see the outer loops only; its children are checked per row).
- Canvas: hidden elements are removed from the canvas. The Navigator row of an element that is hidden now shows in yellow with a yellow condition icon (an element with conditions that pass shows a gray icon). Inside a loop an element counts as hidden only when it fails in every row. The Auto / Show / Hide switch is editor state only and never saved.
- Elements that test `user.` show the note "Hiding by user or role only changes what shows. Protect data and pages on the server."
- Limit until Phase 5: values that change in the browser (page state, persisted app state) are checked with their starting values when the page renders; live re-checks come with the client state store.
- Source of truth: `packages/schema/src/condition.ts` (`visibilitySchema`, `conditionHolds`, `elementConditionHolds`, `groupHolds`, `isVisible`, `splitListText`, `operandValue`, `patternProblem`); renderer `passes()` in `packages/renderer/src/render.tsx`; editor `components/editor/conditions/*`.

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

Source of truth: `packages/schema/src/actions/triggers.ts` (built 2026-11-10, 5a step 1). The owner's list in `blueprint/action-flow-sytem.md` is the base; every listed trigger exists.

- **Common** (every element and the page/template root): On Click, Double Click, Click And Hold (hold time), Secondary Click / Double Click / Click And Hold, Pinch Zoom Start / Update / End, Hover Start / End, Focus, Blur, When Content Loaded (on roots "When Loaded"; also fires when a condition re-inserts the element and for new loop rows), When Comes To Viewport and When Leaves Viewport (visible amount, viewport margin, once or every time), When Position Updated (element edge, viewport line %, scroll direction), On Scroll Progress, When Resized.
- **Page and template roots only:** On Key Press (key with modifiers), Timer / Interval (every ms, repeat), On Page Leave, On Online, On Offline.
- **Element-specific**, keyed by element type in the schema (one list, so the renderer registry does not repeat it): Pull To Refresh (section, container), Image Loaded / Load Error (image). Triggers of elements that are not built yet (slider, accordion, video, audio, timer, table, switch, tabs, input, dropdown/radio/choice chips, checkbox, PIN/OTP, range slider, rating, counter) are listed with a `disabled` reason and turn on when the element lands.
- A trigger may have settings (`fields`); each owner has at most one flow per trigger.

### 8.3 Flow model

Source of truth: `packages/schema/src/actions/flow.ts`. Every step is a node; the editor lays nodes out top to bottom.

- `action`: catalog `type` (empty = "Not defined", an error), `params` (text with tags, or rows of such texts for list fields), optional `outputName`.
- `condition`: branches (if, else if...) each with a condition group from section 7, plus an optional else.
- `loop`: for each (list + item name) or while (condition), with a safety `maxIterations`; `break` and `continue` nodes work only inside a loop (not across a parallel lane).
- `parallel`: lanes that run at the same time; all finish before the next node.
- `tryCatch`: try and catch lists; catch nodes read the error by `errorName` (`{ code, message }`). This replaces per-action onSuccess/onError branches.
- `block`: calls an Action Block with values by parameter id and an optional `outputName`.
- Every node has `id`, optional `name` and `disabled` (skipped with everything inside it). Limits: 500 nodes, 10 levels.
- A flow (`TriggerFlow`) is `{ id, trigger, disabled?, settings, nodes }`. Flows are saved apart from the page tree, one record per owner (5a step 2).
- Output names, loop item names and error names are identifiers, unique in the flow. A node sees the outputs of nodes that surely ran before it (earlier nodes of its own list and of every list around it, all lanes of an earlier parallel), plus loop items and caught errors around it. Outputs inside an earlier condition, loop or try are not visible after it (`visibleNames`).
- Issues (`flowIssues`): Not defined, unknown or disabled action, required field empty (only fields on screen), incomplete rows, unknown select value, empty condition branch, loop without list or condition, break/continue outside a loop, duplicate or invalid names, missing Action Block or required block parameter, trigger not available to the owner. Errors block publishing; warnings (output name on an action that returns nothing, one parallel lane, empty try) do not. Disabled nodes and flows are not checked.
- **Action Blocks** (`blocks.ts`): name, description, typed parameters (every state type plus `element`), optional return value (type + value text), nodes. Editing a block changes every call; blocks that call themselves are found by `recursiveBlocks`.

### 8.4 Action catalog

Source of truth: `packages/schema/src/actions/catalog.ts` and `catalog-actions.ts`. Categories in picker order: Navigation, Backend/CMS, State Management, Element/UI Interactions, Alert/Notifications, Utilities, Share, Media/Animation, Integrations (disabled until a later phase), Action Blocks (the project's blocks), Accessibility. Each action has a sub-section, where it runs (browser or server), a description for the info hint, fields, an optional output type, the param keys of its one-line summary, and a `disabled` reason when it needs an unbuilt element or phase. Icons belong to the builder UI.

- **Navigation:** Navigate To (page, route parameters, query string, replace), Navigate Back.
- **Backend/CMS:** Supabase Authentication (Login with method email+password / OAuth / magic link / code by email or SMS, Verify One-Time Code, Register, Log Out, Send Password Reset Email, Update Password / Email / Phone, Update User Metadata, Resend Verification; see `app-auth.md`; the session refreshes by itself and the user is read through the User tags, so there are no refresh or get-user actions), Supabase (Query / Insert / Upsert / Update / Delete Row(s); update and delete require filters), Refresh Supabase Query, Supabase File (Upload, Download, Clear Uploaded File, Delete), Supabase RPC, API Data (Call API Endpoint). These run on the server, except Refresh Supabase Query and Clear Uploaded File.
- **State Management:** Update App State, Update Page State (rows of variable, operation, value), Rebuild Page, Form (Set / Reset / Clear / Validate: disabled until Phase 7), Rebuild Component/Element.
- **Element/UI Interactions:** HTML/CSS Properties (Add / Remove / Toggle Class, Set / Remove ID, Set / Remove Attribute, Set Text; an empty element field means this element), Bottom Sheet (disabled until popups, Phase 9), Date/Time Picker, Color Picker, Scroll To, Launch Map, Control Table / Slider / Accordion / Tab / Timer / Switch / Swipeable Stack (disabled until the elements exist), Start / Stop GSAP Timeline, Set Theme, Set UI Mode. No show/hide actions: classes drive class conditions.
- **Alert/Notifications:** Off Canvas, Modal, Tooltip (disabled until their elements or popups exist), Play / Stop Sound, Show Toast, Confirm Dialog (returns true or false).
- **Utilities:** Wait, Copy To Clipboard, Pick File(s) (single, or multiple with a maximum; store locally or upload to Supabase; the output feeds Upload File and Put Data To Presigned S3 Storage), Put Data To Presigned S3 Storage, Execute Custom Code (disabled until Phase 10), Debug Log (preview and Test only).
- **Share:** Share (Web Share API), Launch URL, Send Email (mailto), Call Number (tel), Send SMS (sms).
- **Media/Animation:** Gallery, Video Player, Audio Player and Lottie actions, all disabled until those elements exist.
- **Accessibility:** Semantic Announce (polite or assertive live region).
- Dynamic data: every field takes tags except fields that pick a structure item (element, page, variable, query loop, Supabase table, API Data call, GSAP timeline); their written reasons are in `UNBINDABLE_FIELD_REASONS`.

### 8.5 Execution model

- Client actions run in a small generated runtime (`packages/runtime`) shipped with the built app. Keep it tree-shakable; include only actions used.
- Server actions (send email, webhook with secrets, bucket upload, privileged DB calls, auth session cookies) compile to generated server handlers (Next route handlers / Astro endpoints). Secrets live in env vars of the app, never in client code.
- Preview in the editor executes actions through the builder proxy in a sandbox with the dry-run toggle.
- Custom functions come from the project's custom code, type-checked and executed only in the generated app or sandboxed preview, never in the builder process.

## 9. Tests

Token parsing and scope validation, universal bindability, loop duplication, transform chains and datetime formats, condition evaluation, action flow execution (success/error paths, parallel, disabled steps), flow editor error badge, schema save without row data, preview values never persisted, server action generation with no secret leakage.
