# Elements Spec

This doc covers elements of GENERATED sites. The builder's own UI components are in `ui-reference.md` and `blueprint/components`.

## Element node (packages/schema)

```ts
type BreakpointId = string; // "base" always exists; others are user-defined per project (see ui-reference.md 4.12)
interface BreakpointDef {
  id: BreakpointId;
  name: string;
  icon: string;
  kind: "base" | "down" | "up"; // down = max-width (and below), up = min-width (and above)
  width: number | null; // px; null for base
  previewWidth?: number; // canvas width; defaults to width
}
type PseudoState = "default" | "hover" | "focus" | "active" | "disabled";

interface ElementNode {
  id: string; // internal stable UUID
  htmlId?: string; // public id attribute, e.g. "nxtomc-917gs818"
  type: string; // registry key, e.g. "section", "heading", or "componentInstance" (reserved, not implemented)
  name?: string; // layer name
  htmlTag?: string; // for div-based elements: div, section, header, main, nav, aside, article, footer, ...
  classIds: string[]; // ordered
  props: Record<string, Binding | StaticValue | MixedText>; // Element tab (text, src, options...)
  attributes?: Record<string, Binding | StaticValue | MixedText>; // custom HTML attributes (aria-*, data-*, ...)
  styles: StyleMap; // element-level styles (see design-system.md)
  customCss?: string; // element-level raw CSS
  visibility?: ConditionGroup; // conditional visibility
  loop?: LoopConfig; // only on div-based elements
  actions: Record<string, ActionFlow>; // by trigger id: onClick, onChange, onLoad, ...
  children: ElementNode[];
}
```

Rules:

- Every element has 3 tabs: **Element** (content, properties, data binding, conditional visibility, loop), **Design** (CSS), **Action** (event flows). Layout of the panel is in `ui-reference.md` (4.7). In code and schema the first tab may be called `content`; the user-facing label is "Element". The Action tab has two tabs: **Actions** (one card per trigger of the element, or of the page/template when its root is selected; kebab menu disable, copy, cut, delete; paste) and **Action Blocks** (the project's reusable flows). Flows are stored apart from the element node (`action_flows`, one row per element), so they are not element props; element-specific triggers are keyed by element type in `packages/schema/src/actions/triggers.ts`. In the Navigator, an element with a query loop shows an orange database icon (opens its Query Loop settings) and an element with actions shows a sky-blue lightning icon (opens the flow editor).
- A dot indicator shows on any property changed at the current breakpoint, on the tab, and on the breakpoint switcher if any breakpoint has changes.
- All elements register in the component registry: type, category, default node, Zod props schema, content controls, design groups, supported events, `bindable` map, supported actions-as-target, editor render, output render (Next/Astro).
- Elements must render in the editor with dynamic data (live fetch or user-authored sample values, never stored rows).
- Do not build all elements at once. Phase 1 ships section, container, heading, text, button, image to validate architecture; the rest land in Phase 7 in the order below.

## Universal dynamic data (mandatory)

Dynamic data works everywhere, with no exceptions unless justified:

- Every content prop (text, URLs, `src`, `alt`, labels, placeholders, options, values) accepts static text mixed with dynamic tokens, shown with the bolt icon.
- Custom attributes, `htmlId`, class names added or removed by actions, `href`, `target`, `title`, `aria-*`, and `data-*` accept dynamic tokens.
- Design values accept dynamic tokens. A dynamic style value compiles to an inline CSS custom property on the element (for example `style="--nxt-dyn-3: <value>"`) that the class CSS references with `var()`, so classes stay static and cacheable. Dynamic values are validated and escaped per property type to prevent CSS injection.
- Conditional visibility operands, loop sources, query parameters, action parameters, route fields, SEO fields, and theme/template conditions accept bindings.
  - Exception (owner decision 2026-11-09): the page **route pattern** itself (`/blog/:slug`) takes no tokens. It must be known when the site is built so pages can be matched and generated; the dynamic part of an address is its `:param` segments, read anywhere as `{{ param.<name> }}`.
- Each registry entry declares `bindable: { [prop]: true | { reason: string } }`. A prop set to `false` needs a written reason (for example a prop that must be known at build time such as a loop `key` field). A test fails if a prop is not marked.
- The bolt opens the dynamic data modal (see `dynamic-data-and-actions.md`). The modal only shows tokens valid in scope and offers type conversion and formatting.

## Elements panel (builder UI)

Groups and tile labels follow `blueprint/components/elements-panel.png`:

- **Layout:** Section, Container
- **Basic:** Heading, Simple Text, Rich Text, Button, Link, Image, Video, Audio, Icon, SVG
- **General Element:** Accordion (Nestable), Code, Tabs (Nestable), Counter, Divider, Dropdown (Nestable), HTML, List (Nestable), Map, Chart, Off Canvas (Nestable), Progress, Rating, Switch, Icon List, Slider, Captcha
- **Forms** and **Query:** not in the demo panel; add below General Element using the same tiles.

## Catalog

### Layout

- **Section** (`div`), **Container** (`div`). Both can take a query loop and a custom HTML tag.

### Basic

- Heading (h1-h6), Simple text
- **Rich text:** single component, WordPress-like editor: bold, italic, underline, strikethrough, ordered/unordered list, link, basic table, image insert with alignment and size. Stored as a safe structured JSON (e.g. Tiptap/ProseMirror doc), rendered to sanitized HTML. Supports dynamic tokens.
- Button, Link, Image, Video, Audio (assets from the Media manager)
- Icon: picks from the project's icon libraries (popular free sets, icon fonts such as IcoMoon exports, uploaded SVGs) through one picker; stored as `{ library, name }`; output as inline SVG (default) or icon font per library. See `fonts-and-icons.md`.
- SVG (inline, sanitized): one prop `svg` (code) plus an optional accessible name; the markup runs through the SVG sanitizer (scripts, handlers and external references removed, simple SMIL kept).
- Icon implementation (7a): props `source` (`library` or `svg`), `library`, `name`, `svg`, `keepColors`, `size`, `label`. Only `name`, `svg`, `size` and `label` take dynamic data; `library` is a fixed key (opt-out reason in the registry) so a page knows which icon sets to load. A library icon draws as inline SVG (`<span>`) or, for uploaded icon fonts, `<i class="nxt-<key>-<name>">` with the font CSS added for the libraries in use. `source: svg` turns pasted SVG code into an icon (recolored to `currentColor` unless `keepColors`). Decorative by default (`aria-hidden`); a name makes it `role="img"`. An unknown name draws an empty box. Disabled libraries keep drawing icons already placed. The renderer reads icons through `RenderOptions.icons` (`IconLookup`); the server loads only the libraries a page uses (`server/icon-lookup.ts`, every render entry: page, preview, 404, loop and fragment endpoints, overlays) and the editor canvas asks the server for exactly the icons it renders (`use-canvas-icons.ts`). A library whose icons are used cannot be removed.

### General

- Accordion (nestable), Tabs (nestable), Dropdown (nestable), Off-canvas (nestable), List (nestable, ready-made content lists), Icon list (horizontal/vertical, highly customizable)
- Code block: syntax highlighted (GitHub/VS Code-style themes), read-only, copy button; text editable on the canvas for content only; never executed
- Counter (up/down), Divider, Progress bar, Rating, Switch (customizable, exposes a boolean usable as a variable/binding anywhere)
- HTML (custom HTML/CSS/JS, WordPress-style; JS runs only in published output and in the sandboxed canvas iframe)
- Map, Chart (bar, pie, line, area, radar, scatter, etc.), Slider (Splide/Swiper-like: linear continuous, infinite, autoplay, start-after delay, breakpoints, and more)
- Captcha (Cloudflare Turnstile and Google reCAPTCHA); usable in forms and as an action step (validate on click or interaction, also before auth actions)

### Forms

- Form wrapper (nestable), Input (text, email, number, password, etc.), Select (multi-value, icon/SVG-only options), Checkbox, Checkbox group (check, text, subtext, chip styles; horizontal/vertical), Radio, Pin/OTP input, Choice chips (multi-value, icons on both sides), Dropdown (icon support, multi-value), Date/time picker, Range slider
- Common to all form elements where practical: clear-field button, password mask + show/hide toggle (eye icon chosen from icon library), regex validation, built-in validators (required, min/max, length, email, URL, number, password policy, match another field), custom error messages, disabled/readonly states, value exposed as a binding.
- Form wrapper (owner decision 2026-11-16): NO action flow of its own. Props: `name` (unique identifier per page, letters, digits, `_`), `status` (Active or Inactive; an inactive form turns every form action off and hides its Form tags), and `validateOn` (When validated by action, On change, On blur, On blur then on change). Rendered as `<form novalidate>` with no `action`; the runtime prevents the browser submit, so Enter in a field never sends values in the URL. A Button (or any element) runs form work through Form actions in the Action flow editor (Set, Reset, Clear, Validate). Forms cannot nest and cannot sit inside a query loop. **Auth form presets** are described in `app-auth.md` and stay in Phase 8.
- Runtime (7b-1): a page with an active form ships the action runtime even without flows (`packages/runtime/src/form/form-runtime.ts`). It shows errors in each field's `data-nxt-error` paragraph (`aria-invalid` on the control), runs the clear and show/hide-password buttons, and stops the browser submit. Form values live in the DOM; `{{ form.* }}` tags read them, and elements that use them redraw through the fragment endpoint, which gets the values of declared fields only (password values are never sent). Inputs take validators as props (required, min/max length and value, regex, match another field, custom messages); the built-in check follows the input type (email, url, number).
- Input panel (owner request 2026-11-16): the General settings are grouped under headings (Field, Content, Validation, Messages, Behavior; `ControlDef.group`), the Type select shows an icon per option (`ControlDef.options[].icon`, mapped in `right-panel/option-icons.tsx`), and the six messages start filled with defaults (`DEFAULT_MESSAGES` in `packages/schema/src/forms.ts`). A message may use `{type}`, `{length}` and `{range}`, which become the words for the failed check ("a valid email address", "at least 3", "5 or more"); an empty message falls back to the default.
- Input icons (owner request 2026-11-16): General > Icons holds the field icon (library, icon, position left or right) and the icons of the clear button and of the show/hide button (show and hide faces). The library props (`library`, `clearLibrary`, `showLibrary`, `hideLibrary`) are fixed keys; the names (`icon`, `clearIcon`, `showIcon`, `hideIcon`) take dynamic data. Without an icon the buttons keep their text (×, Show, Hide). Icons draw through the same lookup as the Icon element (`iconLibrariesOf` in `packages/schema/src/forms.ts` feeds the server lookup and the "library in use" check). Inputs also have `helpText` and `successMessage`; the runtime sets `data-valid` on a filled field that passes and shows the success text.
- **Form Input design** (owner request 2026-11-16): Design > Form Input is the first Design group of an Input. Its sub-groups are the parts: Field, Label, Required marker, Input box, Input text, Placeholder, Field icon, Clear button, Show/hide button, Help text, Error message, Success message (table in `packages/schema/src/input-design.ts`, the single list of what can be set). Parts with states (Hover, Focus, Error, Success, Disabled) have a state row; the open part and state are pinned on the editor canvas (a copy, never saved) with the message text shown. A setting is stored in the ordinary style map as `--nxt-ip-<part>-<property>[-<state>]`, always at the default pseudo state, per breakpoint, on an element or a class (a Form or Section may carry them to style every input below). The renderer turns each key into a plain declaration on the part's selector (`inputPartCss`); a key that is not set at a breakpoint or state emits nothing, so the built-in look (`INPUT_BASE_CSS`, all `:where()`) stays. Keys the table does not list, and values that could break out of a rule, are dropped. Hidden parts (error, success, clear) are only styled while shown. Position: every part has an `order`; the Field's `flex-direction` puts the label above or beside the box.
- Form actions (Set, Reset, Clear, Validate Form) name a form by its name. Validate Form answers true or false so a Condition can branch. A form in a header, footer or popup counts as present. Action Blocks keep these actions enabled (they have no owning page); a block that names a form the running page lacks fails with a readable message.
- Form values: every named field of an active form shows in the dynamic data modal under Form > (form name) as `{{ form.<formName>.<fieldName> }}`; the Form group only appears while the page has an active form. Field names are unique inside their form.
- **Field value shapes** (7b-2, owner decisions 2026-11-18): every field holds its value as text, and `data-nxt-kind` tells the runtime how the controls make it (`packages/runtime/src/form/field-values.ts`): `text` (Input, Range, Date and time), `check` (Checkbox: "true" or "false"), `one` (Radio: the chosen option's value), `many` (Checkbox group, Choice chips: a JSON list kept as text, the way list variables are kept, so an option value may hold any character) and `pin` (PIN cells joined). A `many` field shows in dynamic data as a real list (`types["form.<form>.<field>"]`, `typedForms`). Validation reads `kind` and, for lists, `minSelected` and `maxSelected` (`validateValue`; the `selection` message, "Choose at least 2."). A required Checkbox must be checked.
- **Options come from child elements** (owner decision 2026-11-18): Radio, Checkbox group and Choice chips take their options from child option elements, so the ordinary query loop repeats them and an option can use dynamic data in every prop. Select and Dropdown (static options, or options from a query, custom list box as well as native) are on hold until the owner describes them. Date and time use native browser pickers, styled through the part design.
- **Checkbox** (7b-2 step 1): props name, label, subtext, checked (start state), required (must be checked), helpText, successMessage, requiredMessage, disabled. Parts: `[data-nxt-choice]` row, `[data-nxt-mark]` box drawn from the real (visually hidden, focusable) input, `[data-nxt-text]`, `[data-nxt-sub]`; the built-in look is `CHOICE_BASE_CSS` (all `:where()`). Its action triggers stay off until field events are wired (same as Input).
- Password fields are excluded from state persistence, previews, and logs.

### Query

- Filter (highly customizable, drives a query's parameters), Search (local or query search, sub-text search), Pagination (state in URL), plus Select/Checkbox/Checkbox group/Radio/Dropdown usable as query controls.

## Build order for Phase 7

1. Icon and SVG (7a, built 2026-11-14: Icon element, icon picker, SVG element)
2. Forms group (needs validation and form actions)
3. General: accordion, tabs, dropdown, off-canvas, list, icon list, divider, progress, rating, switch, counter
4. Rich text, code, HTML, video, audio
5. Slider, chart, map, captcha
6. Query group elements (after the data layer is stable)

## Built-site look

Built-in element default designs ship as classes in the Nextomic CSS framework with a modern shadcn-like look (accessible, token-driven, plain CSS variables). Users restyle them with classes and themes. The framework never depends on the builder's HeroUI/Tailwind.

## Tests

Per element: schema validation, editor render, output render (Next and Astro), a11y check, responsive snapshot, binding with sample data, and every `bindable` prop accepts a dynamic token and resolves it.
