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

- Every element has 3 tabs: **Element** (content, properties, data binding, conditional visibility, loop), **Design** (CSS), **Action** (event flows). Layout of the panel is in `ui-reference.md` (4.7). In code and schema the first tab may be called `content`; the user-facing label is "Element".
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
- SVG (inline, sanitized)

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
- Form wrapper: Submit action flow, field `name`s, validation summary, and **auth form presets** (login, sign up, forgot password, reset password, verify OTP, magic link, social buttons) described in `app-auth.md`. Presets are ordinary elements.
- Password fields are excluded from state persistence, previews, and logs.

### Query

- Filter (highly customizable, drives a query's parameters), Search (local or query search, sub-text search), Pagination (state in URL), plus Select/Checkbox/Checkbox group/Radio/Dropdown usable as query controls.

## Build order for Phase 7

1. Forms group (needs validation and form actions)
2. General: accordion, tabs, dropdown, off-canvas, list, icon list, divider, progress, rating, switch, counter
3. Rich text, code, HTML, SVG, video, audio
4. Slider, chart, map, captcha
5. Query group elements (after the data layer is stable)

## Built-site look

Built-in element default designs ship as classes in the Nextomic CSS framework with a modern shadcn-like look (accessible, token-driven, plain CSS variables). Users restyle them with classes and themes. The framework never depends on the builder's HeroUI/Tailwind.

## Tests

Per element: schema validation, editor render, output render (Next and Astro), a11y check, responsive snapshot, binding with sample data, and every `bindable` prop accepts a dynamic token and resolves it.
