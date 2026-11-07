# Builder UI Reference

How the Nextomic builder itself (dashboard, editor, panels) must look and behave. This doc covers the BUILDER UI only. Elements of generated sites are in `elements.md` and `design-system.md`.

Source images live in `blueprint/`. Use this doc as the index and the images as the visual truth.

## 1. Rules for following the designs

1. `blueprint/pages/*` define structure: layout, navigation, grouping, labels, and flow. Follow them. Do not move, rename, merge, or remove navigation items, panels, or controls without asking.
2. You may upgrade the design only where a modern SaaS tool (FlutterFlow, Linear, Vercel) would clearly do better, and only in these ways: spacing and alignment polish, hover/focus/active/disabled states, loading skeletons, empty states, error states, tooltips, keyboard shortcuts, responsive behavior of the builder shell, accessibility. Any change to information architecture needs approval first.
3. `blueprint/inspiration/*` show behavior to replicate from other products. Copy their logic and structure, but render them with the Nextomic design system (`blueprint/tokens.json`, HeroUI components). Never copy their colors, icons, or branding.
4. `blueprint/components/*` are the builder's own UI components (not elements for generated sites). Build the builder UI from these. Where a component has no design, use the matching HeroUI component with Nextomic tokens.
5. The designs are dark-first. Light mode must also work using the light tokens. The builder UI's own color mode is a user preference (Settings > Appearance in the dashboard, also in the avatar menu). The moon/sun switch in the editor top bar is a different control: it previews the built site in light or dark (see 4.3).
6. Never read the huge sheets in one go; they are downscaled and unreadable. Use `blueprint/tools/crop.py` to crop a region (examples in the script header). For colors, spacing, radius, and typography use `blueprint/tokens.json`.
7. If a screen, state, or behavior is not covered here or in the images, ask. Do not invent.

## 2. Design coverage

| Area                                                              | Status                                                                                                                                                                                                                                                                                | Source                                                        |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Dashboard shell                                                   | Designed. The body is generated in-house and built last (see 4.1)                                                                                                                                                                                                                     | `pages/dashboard.png`                                         |
| All Projects                                                      | Designed                                                                                                                                                                                                                                                                              | `pages/projects.png`                                          |
| Editor shell (top bar, left rail, panels), Elements panel         | Designed; the owner's clarifications in 4.3 win where the mock differs                                                                                                                                                                                                                | `pages/editor-navigator.png`, `components/elements-panel.png` |
| Page Settings dialog, Breakpoint manager                          | NOT designed. Behavior specified in 4.11 and 4.12                                                                                                                                                                                                                                     | none                                                          |
| Supabase page                                                     | Designed                                                                                                                                                                                                                                                                              | `pages/editor-supabase.png`                                   |
| API Data page (header, body, variables tabs)                      | Designed                                                                                                                                                                                                                                                                              | `pages/editor-api-data-*.png`                                 |
| Element settings panel (Element / Design / Action)                | NOT designed. Follow Bricks structure, Nextomic styling                                                                                                                                                                                                                               | `inspiration/bricks-editing-panel.png`                        |
| Action flow editor                                                | NOT designed. Replicate FlutterFlow, Nextomic styling                                                                                                                                                                                                                                 | `inspiration/flutterflow-action-flow-editor.png`              |
| App Settings                                                      | NOT designed. Replicate FlutterFlow structure                                                                                                                                                                                                                                         | `inspiration/flutterflow-app-settings.png`                    |
| Media                                                             | NOT designed. Replicate Instatic structure                                                                                                                                                                                                                                            | `inspiration/instatic-media-asset-manager.png`                |
| State Management page (App State and Constants tabs)              | NOT designed visually. Behavior specified in 4.10; reuse the table pattern of the API Data Variables tab                                                                                                                                                                              | `pages/editor-api-data-variables.png`                         |
| Data Types page (Custom Data Types and ENUM tabs)                 | NOT designed visually. Behavior specified in 4.14; list on the left like the Pages and Templates manager, editor on the right                                                                                                                                                         | none                                                          |
| Expression suggestions (n8n-style)                                | NOT designed visually. Behavior specified in 4.15                                                                                                                                                                                                                                     | none                                                          |
| Design System page, Custom Codes, Git Connection, Version History | Nav items only. Ask before building each                                                                                                                                                                                                                                              | none                                                          |
| Builder UI components                                             | Designed (HeroUI kit)                                                                                                                                                                                                                                                                 | `components/*.png`                                            |
| Template and Theme management screens                             | Themes tab BUILT in the Design System modal following the Variables and Classes tab patterns (no design exists). Pages & Templates manager and template options BUILT from the written spec (`templates-and-themes.md` 4.7); other template screens NOT designed, ask before building | none                                                          |
| Design System > Fonts & Icons tab                                 | Fonts sub-tab BUILT (font list left, add panel or details right, following the Media pattern in Nextomic styling); Icons sub-tab is a placeholder until Phase 6                                                                                                                       | `inspiration/instatic-media-asset-manager.png`                |

## 3. Design system (builder UI)

**Forms with drafts:** State Management tabs, each enum and data type, Page Parameters and Page State Variables are edited as drafts with small Discard and Save buttons. While a draft has changes, a click elsewhere in the editor is held back and an "Unsaved changes" dialog offers Keep editing, Discard or Save (`components/editor/draft-scope.tsx`); the canvas does not take clicks meanwhile, and leaving the page asks the browser to confirm.

**Type pickers** show every type; a type with nothing to choose yet (ENUM without enums, Data Type without data types, Supabase Row until Supabase is connected) is disabled, and resting on it says what to add first. ENUM and Data Type show the second select beside the type.

**Field text color:** typed text in inputs and text areas is `default-700`, a step below the full white of headings. Only dynamic tags are full white.

- The Figma kit is the HeroUI kit (the sheet links to heroui.org). Token names follow it: layout (`background`, `foreground`, `divider`, `focus`), content (`content1` to `content4`), colors (`default`, `primary`, `secondary`, `success`, `warning`, `danger`, each 50 to 900), radius (small 8px, medium 12px, large 14px, full), typography (tiny, small, medium, large), Inter font.
- Colors: primary blue `#006FEE`, secondary purple `#7828C8` (`#9353D3` in dark), success `#17C964`, warning `#F5A524`, danger `#F31260`.
- Use HeroUI components for the builder UI (see `spec.md` decisions). Components designed so far: Accordion, Alert, Button Group, Buttons, Calendar, Carousel, Chips, PIN (OTP input), Progress, Range Slider, Switch, Table, Toast, Tooltip. Each shows the six semantic colors and multiple variants and sizes. Match the designed variants.
- The dynamic data bolt icon is amber (`warning`). Use it consistently wherever a value can be dynamic.
- The bolt opens a large modal (about 80% of the screen) with source groups on the left and a searchable tag list on the right, in the Bricks dynamic tag selector layout with our design system. Page parameters and page state are also bindable inside the page parameter and page state editors.
- HTTP method badges: GET green, POST purple, PUT orange, PATCH amber, DELETE pink/red. An inactive call shows a muted badge with a red x.

### Icons (builder UI)

- Sources, in order of preference: Icônes / Iconify sets (the owner wrote "icons.js.com"; read as icones.js.org, the Iconify browser, confirm), Streamline, Lineicons, Phosphor, Fluent. Last resort: Google Material Symbols, only when no other set has the icon. Mark every fallback in the icon registry (`fallback: true`) so they can be reviewed.
- Match the icon style in the designs (a consistent outline style). Use one set per screen area (a toolbar, a list, a menu); never mix styles inside one group. When a design shows a specific icon, pick the closest match from the same set family.
- Implementation: Iconify as the single API for all these sets, with icon data bundled locally at build time (tree-shaken SVG). No runtime calls to external icon services and no whole icon-font files in the builder UI. Icon FONTS are only used where the Icon element has to output a font-based set (see `elements.md`).
- A typed `Icon` wrapper takes `set:name` (Iconify format) and reads from a registry of the icons actually used. Lint fails on an unregistered icon or one not used anywhere.
- Licenses differ per set and some need attribution (for example Streamline's free sets; Lineicons and Streamline have free and paid tiers). Verify each set before use, record set, license, source URL, and version in `assets/icons/LICENSES.md`, and show required attributions on an About page. Do not ship a set whose license is unclear.
- Accessibility: decorative icons are `aria-hidden`; icon-only buttons need an accessible name and a tooltip.

### Form controls and buttons (owner rule, applies to every screen added later)

Never use raw HeroUI `Input` or `Button` for form fields and actions. Use `components/ui/controls.tsx`:

- `FormInput` / `PasswordInput`: pill, 44px high, one 2px outline, label above. Only that outline reacts (hover brightens, focus adds a light ring, error turns it red). No second border, no filled background.
- `ActionButton`: 40px high (`size="sm"` 32px), 14px text (12px for sm), medium weight on EVERY button, hover changes colour only with a 300ms transition (no movement, no growth; a global rule in `globals.css` applies the weight and transition to all buttons). Colour carries meaning through `tone`: `primary` (white shades of the default scale, inverts in light mode) for the main safe action, `danger` (red) for delete/remove/destructive, `ghost` for cancel and quiet actions, `danger-ghost` for quiet destructive actions. Never render a destructive action in a neutral or white tone.
- The font is Inter, loaded with `next/font/google` (self-hosted at build). Without it, weight 500 falls back to a regular system face and nothing looks medium.
- The header logo is the mascot: `mascot-light` on dark mode, `mascot-dark` on light mode. The welcome text shows the first name only, `User` when there is none.
- Icon-only buttons, segmented toggles and the search field keep their own designed styles from the mocks.

## 4. Screens

### 4.1 Dashboard (`pages/dashboard.png`)

- Header: logo tile (white square with black N), title "Welcome {{user}}" (first name or display name), right side icons: search (global project search), grid (apps/workspaces switcher; exact behavior not designed, ask), settings, open-in-new (external link; ask what it opens), user avatar menu.
- Left nav (below header, aligned to the content container): Dashboard, All Projects, Settings. Active item has a filled icon and a highlighted pill.
- User avatar (everywhere in the builder, `components/ui/user-avatar.tsx`): the uploaded profile image, or the first letter of the name (upper-cased) when there is none or it fails to load. The avatar menu opens with a header showing the avatar, name and email, then Settings and Sign out.
- Settings page sections (not designed; owner-requested): Profile (avatar, name, Upload/Change image and Remove; PNG, JPG, WebP or GIF up to 2 MB, checked by file bytes, SVG refused; name and image save only with Save, Discard drops them; Change email with a 6-digit code sent to the new address), Security (Password change by emailed code with the strength meter, Two-factor authentication with QR code and backup codes, Passkeys list), Appearance, Dependencies.
- Auth pages (not designed; owner-requested): Sign in has Remember me, the primary Sign in button, then an "or" divider and two ghost buttons (Email me a link, Use a passkey). Sign up and Reset password show a four-step colored strength meter with the policy checklist; submit stays disabled until the policy is met. `/two-factor` asks for the authenticator code or a backup code. Signed-in users opening any auth page are redirected to `/dashboard` (server check in the `(auth)` layout).
- Builder error and not-found pages (`components/errors/error-view.tsx`): message, "Try again" when the error can be retried, and a "Go to dashboard" button. There is no SMTP screen: SMTP comes only from environment variables (`platform.md` section 4).
- Content is a centered container. The body is empty in the design. The owner has asked for a design of and generate a basic dashboard with charts and usage. It is NOT urgent and is built last (Phase 13). Before building, produce a short design proposal (sketch or static mock using the tokens) and get the owner's approval.
- Proposed content, top to bottom:
  1. Greeting row with quick actions: New Project, Import project, Open last project.
  2. KPI cards: Projects, Published sites, Pages, Storage used. Each with a change versus the previous period.
  3. Activity chart: edits and publishes over time, with a 7, 30, or 90 day range selector.
  4. Storage by project (bar chart) and media by type (donut).
  5. Recent projects (the 4 most recently modified, same card as All Projects).
  6. Activity feed: publishes, backups, imports, member changes, last 20.
  7. Integrations overview: active Supabase and API Data connections per project with last test status.
  8. Admin only: system health (last backup result, SMTP status, disk usage, builder version).
- Data comes from the builder's own Postgres, using a daily rollup table (project, date, edits, publishes, storage bytes). There is no visitor analytics, because built sites are hosted elsewhere; do not add it.
- Members see their own projects; admins see the workspace. Handle empty states for a new workspace (guide to create the first project), loading skeletons, and errors.
- Charts: use semantic tokens for colors, a text or table alternative for accessibility, tooltips, and dark/light support. Pick one charting library, verify its license, and register it in `builder-dependencies.json` through the manifest script.

### 4.2 All Projects (`pages/projects.png`)

- Title "All Projects" with a workspace badge (blue pill; shows the workspace name, default "Your Workspace").
- Toolbar: search input, Date Range dropdown (filter by modified date), grid/list view toggle, primary button "New Project +".
- Project cards in a 4-column grid: thumbnail (screenshot of the project's home page), name, "Last modified: 3rd Nov 2026" (ordinal day, short month, year), kebab menu. Kebab actions: rename, duplicate, export, backup now, settings, delete (with confirmation). Empty, loading, and error states required. List view is not designed; build it as a table row layout using the Table component.
- Clicking a card opens the editor for that project (Navigator view).

### 4.3 Editor shell (`pages/editor-navigator.png`, as clarified by the owner; where the mock differs, this section wins)

**Top bar** (black), left to right:

1. **Nextomic logo tile.** Click leaves the editor and returns to the project list (All Projects) with this project highlighted. If there are unsaved changes, confirm first.
2. **Page select.** Dropdown listing Pages and Templates (grouped, searchable, with type badges). Selecting one switches what is being edited. It always shows the item being edited.
3. **Add icon ("+").** Opens "New page". The menu also offers "New template" (header, footer, 404 first; other types later).
4. **Page Settings icon (sliders).** Opens the settings dialog for the page or template being edited: theme, templates, SEO, and more (see 4.11).
5. **Dark/light view switch (moon and sun).** Previews the BUILT SITE in light or dark inside the canvas. It never changes the editor's own UI. With only light and dark modes it is a toggle; if the active theme defines more modes it opens a menu. It is remembered for the editor session only (not saved to the project) and sets `data-nxt-mode` on the canvas document only. The builder UI's own color mode lives in user settings (see rule 5 in section 1).
6. **Editing indicator (smart context chip).** Shows what is being edited so nobody confuses a page with a template:
   - Type icon, type label (Page, Header, Footer, 404, Popup, Archive, Single), and name.
   - State dot (saved, saving, unsaved) and a status pill (Draft, Published, Unpublished changes).
   - Template mode must be unmistakable: the chip uses the secondary color, a thin secondary-colored line runs under the top bar, and a tag shows "Applies to N pages" (hover lists them).
   - In template mode, clicking the chip opens a menu with "Preview as..." (choose a page, or a sample record for archive and single templates) and "Edit conditions".
   - Page mode shows the route; hovering opens a popover listing what applies to this page right now (theme, header, footer, and the rule that matched, see `templates-and-themes.md`).
     This replaces the "Editing: Login" text in the mock.

**Center: breakpoints.** A segmented control with one button per breakpoint (defaults: desktop, tablet, mobile; each has a device icon) and a vertical three-dots menu to create and manage breakpoints, canvas zoom, and rotate (see 4.12). Selecting a breakpoint resizes the canvas and sets the active breakpoint for Design edits.

**Right side:** 7. **View published page icon.** Opens the live URL in a new tab. Disabled, with a tooltip, until the project has been published once. 8. **Publish button** labeled "Publish update" ("Publish" before the first publish; shows "Published" when there is nothing new). A dropdown opens on hover and also on click and keyboard focus (hover-only menus are not accessible). Menu: Save (stores a version snapshot of the draft; does not publish), Preview draft (new tab), Revert to published version (confirm), Unpublish (confirm), Version history, Publish settings (domain and options, Phase 11).

- Publishing applies to the whole project. All changed pages, templates, themes, and settings go live together so shared templates and themes never get out of sync.
- Before publishing, show a check dialog listing errors (block publish), warnings, and the changed items. A page can be marked Draft to exclude it from publishing.
- Autosave runs continuously. "Save" additionally creates a named snapshot in Version History.
- Publishing is wired in Phase 11. Before that, the menu offers Save and Preview only.
- **Schedule publish** (publish menu, below Save): a dialog with the builder date and time picker (`components/ui/date-time-field.tsx`: pill field, neutral calendar, the white-shade accent for the chosen day, future times only). At that moment the saved draft is published as if Publish was pressed then; edits saved before it are included. While a schedule is set, a chip "Publishes <date>" sits left of Publish and opens the dialog to change or remove it. Unpublish removes the schedule. A project has one publish state at a time (published, draft, scheduled or unpublished): pressing Publish while a schedule is set opens "A publish is scheduled" with Keep schedule or Publish now and remove schedule, and any publish clears the schedule on the server. The server runs a due schedule on the first read after its time (site request or editor publish state), claimed with a conditional update so it runs once, and dates the publish at the scheduled time.

**Left rail** (Navigator is open by default). Items in order, as in the Supabase and API Data screens:

1. Navigator (with a "+" button that opens the Elements flyout)
2. Data Types
3. State Management
4. Media
5. Supabase
6. API Data
7. Design System
8. Custom Codes
9. Git Connection
10. Version History
    Bottom: App Settings and a rail collapse toggle. Supabase and API Data are two separate items. There is no "Data Management" group; the Navigator mock is outdated on this.

**Navigator panel (left).** Holds all elements of the current page or template as a tree (structure behavior in 4.7). Pages and templates are not listed here; use the page select in the top bar.

**Elements flyout** (`components/elements-panel.png`): groups with a two-column tile grid (icon above label), exactly as designed: Layout (Section, Container), Basic (Heading, Simple Text, Rich Text, Button, Link, Image, Video, Audio, Icon, SVG), General Element (Accordion (Nestable), Code, Tabs (Nestable), Counter, Divider, Dropdown (Nestable), HTML, List (Nestable), Map, Chart, Off Canvas (Nestable), Progress, Rating, Switch, Icon List, Slider, Captcha). Forms and Query groups are in the spec but not in the demo panel; add them below General Element using the same tiles. Supports search, drag from tile to canvas or tree, and click to insert at the selection.

**Canvas:** dark surface; the page renders inside a sandboxed iframe sized by the active breakpoint.

**Right panel (editor panel):**

- **Nothing selected: page options.**
  1. Page Parameters (pencil to edit): typed parameters from route segments or query string.
  2. Route Settings (collapsible): `Route/` prefix plus an input with a bolt (the route can contain dynamic segments such as `blog/[slug]`), and the "Requires Authentication" checkbox (see `app-auth.md`).
  3. Page State Variables: variables local to this page. Same row pattern as the State Management table (name, type, is list, default value, delete, "Add Variable"). They reset when the page is left; no persistence option.
     For templates, the panel shows only the Categories and tags group. Template settings (name, description, status, priority, theme, conditions, sticky header, 404 header/footer) open in a Template settings modal from the same top-bar settings icon as Page settings. For pages the panel keeps Page Parameters, Route Settings, Categories and tags and Page State Variables.
- **Element selected:** three tabs, Element, Design, Action (see 4.7).

### 4.4 Supabase page (`pages/editor-supabase.png`)

Cards, top to bottom:

1. Connection: "Active" toggle, Supabase URL, Anon/Publishable key (masked, with reveal), buttons "Fetch Schema" (primary) and "Clear Schema" (danger outline).
2. Authentication: helper text "Works only if Supabase Authentication is selected in App Settings"; "Google Authentication" toggle with "Web Client ID" field (masked, reveal). More providers follow the same pattern.
3. Tables & Views: left list with search, right detail with columns: Field Name (with key icon for primary key and star icon for fields flagged as favorites/used), Data Type (Integer, DateTime, String, Boolean), PostgreSQL Type (int, timestamptz, text, bool).
4. Storage: bucket list with object count badge, selected bucket shows name, Public/Private badge, folder chips, object URL with "Copy URL".
   Behavior is in `integrations.md`.

### 4.5 API Data page (`pages/editor-api-data-*.png`)

- Left column "API Calls" with "+" button: API groups (collapsible, can contain calls) and ungrouped calls. Each call row shows a method badge.
- Right: "Define API Call" with tabs "Call Definition" and "Test API". Connection card: Active toggle, API Call Name, Method dropdown, Group Base URL (inherited from the group, read-only), Endpoint.
- Sub-tabs: Header, Body, Variables, Advanced Settings (not designed; ask). Header tab: list of `key: value` lines, input "Add header as key:value", "Add Header" button. Body tab: Body Type dropdown (JSON, None, Text, Multipart), "Available variables to add" chips (click to insert), code editor with line numbers and highlighted `<variable>` tokens. Variables tab: Name, Type, Is List, Default Value, bolt, delete, "Add Variable".
- Footer: "Delete API" (danger outline), "Cancel", "Save API" (primary).
  Behavior is in `integrations.md`.

### 4.6 Media (replicate `inspiration/instatic-media-asset-manager.png`)

- Left "Folders" panel: Library (All files, Missing alt text, Missing title, Untagged, Large files, Recently replaced; each with a count), Folders (+ to create; empty state "No folders yet. Click + to create your first folder."), System (Trash).
- Main: Upload button, search field, type tabs (All, Images, SVG, Videos, Other), sort dropdown (Newest, Oldest, Name, Size), list/grid toggle, item count, grid cards (thumbnail, file name, size).
- Required additions: drag-and-drop upload, multi-select with bulk move/tag/delete, details drawer (alt text, title, tags, dimensions, replace file, copy URL, usage list showing where the asset is used), links to Design System > Fonts & Icons for icon libraries and fonts (`fonts-and-icons.md`). Storage target (local or S3-compatible) is per project. See `elements.md` for Icon and SVG needs.

### 4.7 Element settings panel (replicate `inspiration/bricks-editing-panel.png`)

- Header: element name and a row of quick actions (visibility, duplicate, copy style, paste style, save as component later, delete).
- Under the header: ID field (`nxtomc-xxxxxxxx`) and class chips (add class, select class as active target; the active target is highlighted).
- Tabs: **Element**, **Design**, **Action**. A dot next to a tab name means something is changed in that tab at the current breakpoint. (Earlier docs called the first tab "Content"; the owner's name is "Element".)
- Rows: label, small responsive icon when the property is breakpoint-specific, a yellow dot before the label when the property is set at the current breakpoint, the control, and at the right a bolt button (dynamic data) or a CSS variable button for style values. Reset on right click or a small reset icon.
- Design groups are collapsible and headed by an icon. Enumerated properties (direction, justify, align) render as icon toggle buttons; pressing the active one resets it.
- Design rows follow `blueprint/inspiration/bricks-design_panel-layout-1.png`: bold label with a small device icon, the yellow changed dot in the left gutter, inputs on the right joined to a square tile (dynamic/variable), icon tile groups filling the row below the label for enumerated values, right-click on a changed row resets it.
- Right-click on an element (canvas or Navigator) opens the element menu (`blueprint/inspiration/bricks-right-click-*.png`): Move (out, in, up, down), Select parent, Rename, Copy CSS ID (only when the element has an ID), Copy selected class (only while a class is the active target), Copy, Paste, Duplicate, Delete, Hide/Show element, Wrap (Container), Unwrap. Save as component/template, Extend classes, Find & Replace styles and Class Converter are not built (reusable components are out of scope; the rest wait for the class phases).
- Saving is explicit (Save in the Publish menu, Ctrl+S, or Publish). Nothing autosaves; unsaved edits are lost on refresh and switching pages warns first. Preview and the public site only show saved or published content. Publish becomes a disabled "Published" button when the saved draft equals what is live.
- The Design System rail item opens the Design System page, a large modal (about 80% of the screen) with a tab list on the left: Framework (theme select, Variables grouped with light/dark values, Scales with minor/major ratio, base size, base index and screen range plus a step table, Classes grouped by prefix with rules and "Add to element", Import CSS, Export CSS), Themes (list on the left with name, Default badge and rule summary; editor on the right with General, per-mode Variables overrides and page/route Conditions; the first theme is the default), Variables (grouped list, search, create, edit, rename with reference update, usage count, delete), Typography and Spacing (fluid scale forms with a live preview that generate variables), Colors (a palette of shades from a base color) and Fonts & Icons (Fonts: Google Fonts search with weight/italic/subset choice and install, upload with rights checkbox, per-font Load on sites switch, preload, preview, set as Heading/Body/Mono variable, files list, removal blocked while used; Icons: placeholder) and Classes (the class manager: create, duplicate, rename, delete with a replacement, usage count, search, add to the selected element). The Font family value in Design has a font button listing project fonts and system stacks, with "Add font..." opening this tab. Each Design value input has a variable picker button that lists project variables fitting the property.
- A status dot on the Publish control: red = edits since the last save (or a failed save), orange = saved as a draft but not live, green = published and current.
- The top bar is a three-column grid so the breakpoint switcher stays centered. The breakpoint change dot shows the save state: yellow unsaved, green saved, grey saving, red failed or conflict.
- Element panel target field: it shows the active target (the ID, or a class) and is read-only until the pencil is pressed (Enter applies, Escape or blur cancels); the plus adds a class. A single click on a class chip does nothing; double-click (or double-tap, or Enter) edits that class and double-click again releases it. The active target is full strength and the rest (other chips, other pseudo states) is faded. Pseudo state chips are violet, the active one pink.
- Design value tools: the unit button (px, rem, em, %, vw, vh, vmin, vmax, ch, fr, plus auto and keywords, each row previewing the resulting value) shows on length properties; the color palette button (palette dropdown from the color variable groups, swatch grid, custom color, clear) shows on color properties; the variable button shows only where variables of a fitting type exist for that property; the dynamic bolt shows on every typed value and inserts a dynamic tag (resolved when the CSS is built); every text value has the variable button (string or number variables), and Aspect ratio lists 21/9, 16/9, 4/3, 3/2, 1/1, 2/3, 3/4, 9/16 and 9/21 under the field while it has focus. Text controls that hold content (Heading, Text) are textareas that grow to 20 lines and then scroll. Right-clicking a Navigator row selects it first, and copy, paste, duplicate and rename show a toast. Filter and Transform sliders show the colors or shades the control moves through. The CSS editor indents with Tab (Shift+Tab outdents, Escape then Tab leaves the field) and colors like VS Code Dark+ / Light+.
- **Field layout (owner rule):** every setting stacks. The label line comes first and may wrap: label, responsive icon, an (i) tip that opens to the left, extra controls, the yellow changed dot and reset on the right. The value field sits below it at full panel width, with room between settings.
- **Numeric fields take numbers only.** For every length or number property the user types the number and picks the unit (px, rem, em, %, vw, vh, dvh, svh, lvh, vmin, vmax, ch) or a word (auto, none, fit-content, normal) in the unit menu. Letters are rejected. The unit menu also has Custom, which takes any CSS text such as `calc(100% - 2rem)` or `min(1440px, 92%)`. Which units and words each property takes is `right-panel/length-units.ts`.
- **Four-value properties** (margin, padding, border width, border radius, position offsets) use a box editor with one field per side or corner, like Figma and Bricks. Three link buttons set how they move: all sides, top/bottom with left/right, or each side on its own. Four equal values are stored as the shorthand, otherwise as longhands, never both (`packages/schema/src/sides.ts`).
- **Typography** starts with Font family. Font weight lists only the weights the chosen font has installed (variable fonts: the steps inside the range); Font style hides when the font has no italic face. System fonts or no font set show everything. The font is found from the target, its classes and its ancestors (`font-support.ts`).
- **Accordions (owner rule):** the Design tab and the Element tab are accordions with one section open at a time; opening one closes the others, and the open one can be closed. Searching shows every match open. Because only one Design group is open, the editor knows what is being edited: with App Settings > "Hide edit border while editing" on, the blue outline of the selected element is hidden while the Border group is open (`hideSelection` in the canvas render message).
- **Memory per element:** the editor remembers the Design group and setting each element was last edited in. Selecting that element again and opening Design reopens the group and scrolls to the setting; the default is Layout.
- **Element tab sections:** General (content and properties) and Attributes (HTML attributes: name and value rows, values take dynamic tags; names limited to `aria-*`, `data-*` and a standard list, never `id`, `class`, `style`, `on*`). Adding an attribute gives the element an ID when it has none. Other settings read an attribute with `{{attr @ ELEMENT_ID:attribute-name}}`.
- **Rename:** an element's builder name (used to find it in flows and queries) can be edited from the panel header pencil, the Navigator row pencil (beside the duplicate icon) and the context menu. Names need not be unique. Copy actions show a small toast, "#nxtomc-abc copied to clipboard" or ".hero copied to clipboard".
- **Numeric fields step with the arrow keys:** Up/Down change the number by 1 (0.1 for em, rem, opacity and unitless values), Shift is 10 times, Alt is a tenth; values never go below 0 where negatives are not valid. In the box editors the link buttons act at once: "all" sets every side to the smallest value set, "pairs" sets top/bottom and left/right to the smaller of each pair. The box cells have no background of their own so they sit in the box.
- **Related settings sit together:** Width with Min width and Max width (half-width, side by side), Height with Min height and Max height, Column gap with Row gap, Flex grow with Flex shrink. Settings of one cluster have a small gap; clusters and single settings have a larger gap. Each setting label has a small icon (`PropertyIcon` in `design-icons.tsx`).
- **Transform and Filters are their own groups.** Transform: the icon button opens an editor with translate X/Y/Z, scale, rotate (Z, X, Y), skew X/Y and perspective; plus Transform origin, Transform style (flat, preserve-3d) and Transform box. Filters and transition: CSS filters (blur, brightness, contrast, hue, invert, opacity, saturation, sepia, each a range slider with a number box), Backdrop filter (same editor) and Transition. A function back at its neutral value is removed from the CSS; functions the editor does not know (matrix(), drop-shadow(), var()) stay in the text (`right-panel/css-calls.ts`).
- **Resizable panels:** the Navigator (only) and the right settings panel can be dragged wider, up to 35% of the window, from a handle on their inner edge with a centered grip; arrow keys work too. Widths are remembered in the browser.
- Hover preview: hovering (or keyboard-focusing) an option in the unit, color palette, variable or font picker draws it on the selected element (or the active class) on the canvas before it is picked; it is never saved or added to undo history. The color palette is a 296px popover: a palette dropdown (project color variable groups, plus a built-in Utility palette until the project makes one), a 7-column swatch grid with name and value of the hovered swatch below, a custom color circle, a hex field and Clear. Dynamic data previews arrive with the dynamic data phase.
- Containers (div, section, header, main, nav, aside, article, footer) start as `display:flex; flex-direction:column`, set with zero specificity in `BASE_CSS`, so any style or class wins. The Design tab shows "flex (default)" and "column" as the built-in values.
- Fit to screen frames the selected element (the canvas reports its bounds); with nothing selected it fits the page. Double-clicking an active class chip releases it. Clickable controls show the pointer cursor.
- The pseudo state being edited (default, :hover, :focus, :active, :disabled) is a row of green chips under the ID and class chips, in every tab; a dot on a chip means that state has styles at the current breakpoint. Click selects, click again returns to default. Code fields (CSS) use syntax colors: VS Code Dark+ on dark, GitHub Light on light (`components/ui/code-editor.tsx`, `lib/css-highlight.ts`).

- Element tab starts with: Query loop toggle (div-based elements only), HTML tag select, then the element's own content and properties (with data binding), conditional visibility, custom attributes.
- Bottom: "Search settings" input that filters all settings across tabs, plus a settings gear.
- Navigator panel (left rail): holds all elements of the page or template. Filter dropdown ("All", or by element type/class), search, tree with expand/collapse, drag to reorder, and per-row indicators for classes, loop, condition, and actions.

### 4.8 Action flow editor (replicate `inspiration/flutterflow-action-flow-editor.png`)

Large modal with three columns:

- Left: title "Action Flow Editor" and the name of the page, template, or element. Search triggers, "+" to add a trigger, list of triggers (for example "On Page Load") each with a count badge of actions and a delete icon.
- Center: flow canvas. Actions are cards ("Action 1", action name, short summary). A "+" appears above and below the selected card to insert before or after. Conditions create True and False branches that render side by side. An unconfigured card shows "Not defined" and counts as an error.
- Right: "Define Action". Editable action name, kebab menu (disable, duplicate, delete), action type selector with search and a categorized menu, then the selected action's parameters (each with a bolt), then output name.
- Top right: error count badge (clicking jumps to the first invalid action), and "Close".
  Action categories and behavior are in `dynamic-data-and-actions.md`.

### 4.9 App Settings (replicate `inspiration/flutterflow-app-settings.png`)

Full-screen view opened from the bottom of the left rail. Left: title, search field, grouped nav. Right: sections with a header, description, and form fields. Items and their mapping are in `platform.md`.

### 4.10 State Management page

Opens from the left rail as a full page (like the Supabase page) with two tabs: **App State** and **Constants**. No visual design was supplied; build both tabs with the table pattern of the API Data "Variables" tab (`pages/editor-api-data-variables.png`) in Nextomic styling, and show the result to the owner for approval.

**App State tab** (global variables that actions can change):

- Columns: Name, Type, Is List, Default Value, Persist (switch), delete. "Add Variable" button and a search field. Expanding a row shows Description, "Keep after logout" (only when Persist is on), Storage (Local storage or Cookie), and a "Where used" list with the usage count.
- Types (any of these, each also as a list): String, Number (whole and decimal), Boolean, JSON, Timestamptz (an ISO timestamp with or without a zone), Color, URL, ENUM (one of the enums made on the Data Types page), Data Type (one of the data types made on the Data Types page), Supabase Row (a row of a fetched Supabase table or view; selectable once Supabase is connected in step 4d). ENUM, Data Type and Supabase Row show a second select for which one. Older Integer and Float become Number; DateTime, Date and Time become Timestamptz. The Default Value control changes with the type: a select for Boolean and ENUM, a color field for Color, a text field with a calendar button for Timestamptz, and a vertically resizable box with the Format icon for JSON, Data Type values and lists.
- **Persist:** when on, the value is saved in the visitor's browser and restored the next time the site opens, even after the browser or tab is closed. It stays until the visitor logs out (default) or clears site data. Details and limits are in `dynamic-data-and-actions.md` section 5.

**Constants tab** (fixed values; read-only at runtime):

- Columns: Name, Type, Is List, Value, Description, delete. Same types as App State. No Persist, and actions cannot change them.

Built (Phase 4a): `components/editor/state/*`. Edits are a draft until **Save** (small Discard and Save buttons with an "Unsaved changes" dot at the top right of each tab); values that do not fit the type show the reason and are not saved. Renames of used variables are confirmed on Save and then update their references everywhere. The page header explains the `{{app.name}}` and `{{const.name}}` tags, each tab has a warning about secrets, and renaming a used variable asks and then updates its tags everywhere.

Rules for both tabs: names are unique and valid identifiers (`[A-Za-z_][A-Za-z0-9_]*`) and reserved words are blocked. Changing a type or deleting a variable shows the affected bindings and requires confirmation. The page must not allow storing secrets (show a warning that persisted values live in the visitor's browser).

### 4.11 Page Settings dialog (top bar, sliders icon)

For the page or template being edited. Route, Page Parameters, "Requires Authentication", and Page State Variables are NOT here; they live in the right panel when nothing is selected.

- **General:** name, internal description, "Include in publish" (Draft toggle), set as home page, duplicate, delete.
- **Appearance:** Theme (Auto, shown as "Auto (theme name)", or a specific theme). BUILT. The per-page default color mode (inherit, light, dark) and the "why" explanation are not built yet.
- **Templates:** Header (Auto, None, or a specific template), Footer (Auto, None, or specific), attached popups (Phase 9). See `templates-and-themes.md`.
- **SEO:** title, description, canonical URL, robots (index or noindex), Open Graph title, description, and image. Fields accept dynamic data.
- **Rendering** (Phase 11): static, server, or static with revalidate.
- **Custom code:** page-level CSS and head or body scripts (sandboxed in the editor).
- **Language:** locale.
- **Version history:** a switch "Enable version history for this page" and a history limit, 5 to 200 saved versions (empty follows the app-wide default of 200). Both are greyed out with a tip while Version control is off in App Settings; the limit is also greyed out while this page's switch is off.
  For a template, this dialog shows the template's name, type, conditions (with a link to edit them), priority, theme override, and type-specific settings (popup triggers, archive and single route and query).
  Sections appear as the features that back them are built; hide a section until its phase is done instead of showing disabled controls.

### 4.12a Panel sizes, clock

- Side panels are resizable up to 25% of the window. The Navigator header has a reset icon that restores both side panels to their default width.
- App Settings > "Show time in the editor" shows a running clock (hh:mm:ss, AM or PM) in the top bar, left of the open page link.

- The Design tab remembers, per element, the group last opened; an element never opened keeps the group open last. Margin, padding, border width and radius boxes carry a variable picker and a dynamic tag button that fill the side touched last.
- Choosing a pseudo state (hover, focus, active, disabled) makes the canvas draw that state's design on the element or class being edited.
- Element right-click menu: "Move element styles to class" opens a searchable class list and moves the element's own design (not its added classes) into the chosen class; the element's values win.
- Navigator header: collapse or expand all elements (the icon follows the action), and reset the side panels.
- The builder UI font is DM Sans (built sites use their own fonts). The editor clock is 12px in a dimmer white.

- Every icon-only button shows a tooltip after the pointer rests on it for 300 ms (`AutoTooltips`, from its title or accessible name); controls with their own tooltip (InfoTip) are left alone. HTML tag lists show plain tag names (no angle brackets); Button has a tag option (button, a, div, span). Naming a class on an element creates it in the project, so the Design System lists it.

### 4.14 Data Types page

Opens from the left rail ("Data Types", just before State Management) as a full page. Left aside: title with a "+" button, two tabs **Custom Data Types** and **ENUM**, a search field, and the list. Right: the selected item's name, description, delete, and its editor.

- **ENUM:** an ordered list of unique text values (add, move up or down, delete). An app state variable, constant, page state variable or data type field of type ENUM accepts only these values.
- **Custom Data Types:** a table of fields (Name, Type, Is List, Description, delete) and "Add Field". A field takes every type except Supabase Row. A value of a data type is a JSON object whose keys are the field names; unknown keys are refused.
- Names are valid identifiers and unique within their tab. Deleting an enum or a data type that a variable or another data type uses lists those users and asks first.

- Each enum or data type is edited as a draft with Discard and Save in its header. A field cannot use its own data type, or a data type that already contains it.

Built (Phase 4a fixes): `components/editor/data-types/*`; stored in project settings (`enums`, `dataTypes`).

### 4.15 Expression suggestions

Every field that has the dynamic bolt accepts n8n-style expressions inside `{{ }}`; text outside the braces stays text. While the caret is inside `{{ }}`, a panel opens beside the field, on the left or right, whichever side has more room; it is clamped to the screen and falls back to below the field only when neither side fits (`placeBeside` in `lib/place-floating.ts`):

- Left: the names, fields and methods that fit at the caret. After `.` it lists the fields of the value and the methods for its type (text, number, list, object, timestamp), using the declared type when the preview value is empty.
- Right: the active item's signature, what it does, and an example.
- Footer: the result of the expression with the current preview values, or the error.
- Arrow Up and Down move, Enter or Tab inserts (methods with arguments place the caret inside the parentheses), Escape closes, hovering an item shows its details. The panel never takes focus from the field.

- The list is grouped under headings: Fields, Page state, App state, Constants, Page parameters, Page and visitor, Date and time, then the methods for the value (Text, Number, List, Object, Date methods) and Functions. Variables are listed by name (`app.cart`), so typing part of a name finds it.
- A small search box sits at the top of the panel and narrows the list by name or description.
- The panel opens whenever the caret is inside `{{ }}` (typing, clicking or moving the caret), and shows nothing inside a quoted string.
- Typing `{{` adds ` }}` and puts the caret between the braces; typing `}` before the closing braces steps over them; deleting a brace of an opening `{{` also removes its closing `}}`. Inserting a suggestion keeps the field's own undo (Ctrl+Z, Ctrl+Y).
- In every field with the bolt, text is a step softer than headings (`default-600`, so tags stand apart); `{{ }}` tags are drawn white and heavier, and tags with a problem (syntax error, unknown name, undeclared variable, runtime error) are red with a wavy underline. Resting the pointer on a tag for 500 ms shows its value with the current preview data, or the problem.
- An element with such a problem shows a small red dot in the Navigator; its tooltip says what is wrong.

Built (Phase 4a fixes): `components/editor/expression/*`. The syntax and the method list are in `dynamic-data-and-actions.md`.

### 4.13 Animations editor (replicate `inspiration/bricksforge-gsap-animation-timeline.png`)

- Opened from the left rail item "Animations". A full-height layer over the editor body; the top bar stays. The real page canvas shows through the middle, so previews play on the actual elements. Esc or "Back to editor" closes it.
- Left: Timelines sidebar (New timeline, Folder; folders with rename and delete; per row on/off, duplicate, delete; Import and Export of JSON).
- Top of the middle: transport bar (play or pause, stop, `time / length`). Stop puts the page back as it was.
- Bottom of the middle: Animations track. Rows of animations (name, move up or down, duplicate, delete) beside a ruler with the playhead; bars drag to change the start and resize on the right edge to change the length; clicking the ruler seeks; zoom slider.
- Right (tabs): Animation (Animation, Timing, Properties, Text and stagger, Custom GSAP object), Timeline (Timeline, Scroll or Interaction, Where it runs), GSAP Code (read-only, Copy).
- Rules: every control has an (i) tip in plain words; selectors come with an element picker; invalid values are marked, never saved silently. See `design-system.md` section 9.

### 4.12 Breakpoints

The three-dots menu next to the breakpoint switcher opens a manager:

- List of breakpoints with icon, name, kind, and width; add, edit, delete, reorder, and "Reset to defaults". Also canvas zoom and rotate.
- Fields: name, icon, kind (Base, "and below" max-width, "and above" min-width), width in px, and canvas preview width (defaults to the width).
- Defaults: desktop (base, canvas 1440px), tablet (and below 768px, canvas 768px), mobile (and below 414px, canvas 414px). The icon is one of desktop, laptop, tablet, mobile.
- Rules: exactly one base breakpoint, which cannot be deleted. Maximum 8. Names unique. No two breakpoints of the same kind with the same width.
- Cascade: base styles apply everywhere; "and above" breakpoints override in ascending width order; "and below" breakpoints override in descending width order (larger first, so the smallest wins on small screens).
- Deleting a breakpoint that has styles asks to discard them or move them to another breakpoint.
- Styles are keyed by breakpoint id in the schema. Output CSS emits media queries in cascade order.
- The dot indicators (yellow dot on a property, dot on the Design tab, dot on the breakpoint button) work for every breakpoint.

## 5. Brand assets

- Files are in `assets/brandings/{svg,png,webp}`: `brand-name-{dark,light}`, `name-logo-{dark,light}`, `mascot-{dark,light}`, `favicon`.
- "Dark" means the artwork variant for dark backgrounds (light-colored artwork); "Light" means for light backgrounds. Select by the active builder color mode.
- Prefer SVG; use PNG/WebP only where SVG is not possible (emails, OG images). Register assets in the asset registry by slug; never hardcode paths.
- The top-left tile in the editor and dashboard is the white square N mark; the project's own favicon setting is separate from the builder's.

## 6. Open items the owner must confirm

1. "icons.js.com" is read as Icônes (icones.js.org, the Iconify browser). Confirm.
2. Logo click is read as "return to All Projects with this project highlighted". Confirm (it could mean a project overview page, which does not exist yet).
3. What the dashboard header's grid and open-in-new icons do.
4. Publishing applies to the whole project (see 4.3). Confirm, or say if per-page publishing is required.
5. The State Management, Data Types and Page Settings screens and the expression suggestions have no visual design; they follow the patterns named in 4.10 and 4.11 and need owner approval.
