# Builder UI (apps/editor)

## Design sources (`blueprint/`)

- `blueprint/pages/` the structure to follow: dashboard, projects, editor shell, Supabase, API Data. The editor top bar, left rail (Supabase and API Data are separate items, no "Data Management" group), and right panel are specified in `docs/ui-reference.md` section 4.3, which wins where the mock differs.
- `blueprint/components/` the builder's own UI components (HeroUI kit). NOT elements for generated sites.
- `blueprint/inspiration/` behavior to replicate with OUR design system: Bricks element panel, FlutterFlow action flow editor, FlutterFlow App Settings, Instatic media manager.
- `blueprint/design-system/design-system-sheet.png` plus `blueprint/tokens.json` (use the tokens, not the image, for values). Very large images: crop with `blueprint/tools/crop.py` before reading.
- `assets/brandings/` logos, mascot, favicon (svg, png, webp). Dark variant = for dark backgrounds.
  Follow the page designs' structure. Upgrade the design only where a modern SaaS app would clearly do better, within the limits in `ui-reference.md`. Screens that are not designed are listed in `ui-reference.md`; ask before building them.

## Builder design rules (locked)

Every builder screen follows `docs/ui-reference.md` section 3 "Builder design rules": HeroUI v3 components, colors only through the semantic tokens (`builder-tokens.ts` from `blueprint/tokens.json`), the four text roles, and the shared primitives in `src/components/ui/` (`ActionButton`, `FormInput`, `SelectField`, `SearchSelect`, `Toggle`, `CheckField`, `Dialog`, `InfoTip`).

## UI control rules (owner decisions)

- Inputs and buttons come from `src/components/ui/controls.tsx` (`FormInput`, `PasswordInput`, `ActionButton`), never raw HeroUI `Input`/`Button`. Every new input and button is small by default: `FormInput compact` (32px) and `ActionButton size="sm"`, unless the owner asks for big. Pick `tone` by meaning: `primary`, `danger`, `ghost`, `danger-ghost` (red for destructive actions, never white). Hover is a colour change with a 300ms transition, no transform or grow. Button groups sit left-aligned below their inputs with about a 20px gap.
- Checks, selects, chips and tooltips are the HeroUI components wrapped in `components/ui` (`CheckField`, `Toggle`, `SelectField`, `Chip`, `Hint`). ESLint blocks raw checkbox, radio and select outside `components/ui`.
- Every modal fits its content and never exceeds the screen minus 1.5rem; content scrolls inside, never the modal. Sizes are the shared `MODAL_*` constants in `components/ui/modal.tsx`. Never hand-size one dialog; change the shared constants and run `e2e/builder-ui.spec.ts`.
- Tooltips, popovers, dropdowns and context menus flip and clamp inside the viewport. Use `lib/place-floating.ts` (`placeFloating`) for custom floating boxes; check new floating UI at the screen edges.
- Every new icon name must be registered in `lib/icons/registry.ts`, otherwise it draws empty. `bun run icons:lint` checks the registry.
- Every field that accepts dynamic data gets the bolt. Use `SelectField` for all dropdowns, never a native select.

## Editor behavior rules (owner decisions)

- Publish is one joined control: the left part publishes, the arrow part opens Save and Unpublish. Only published pages are public (`/site/<id>`); drafts are visible only to signed-in members (`/preview/<id>`). Saving is explicit (Ctrl+S, no autosave). The publish dot is red when unsaved, orange when saved as draft, green when published.
- Left side keeps one single panel. Selecting an element folds the section rail to icons. The Elements popup closes as soon as something is added.
- Breakpoints order themselves by width. The breakpoint switcher stays centered in the top bar. Clickable things show the pointer cursor.
- App-wide switches (like automatic element IDs) live in App Settings, never per element.
- Element identity is one input for classes (plain text) and ID (`#`) with Apply/Enter and chips below: classes light blue, ID amber or violet, state chips green. Double-click a class chip to activate or release it. The ID chip is active whenever no class is, and is not removable while automatic IDs are on.
- Right-click on an element (canvas or Navigator) opens the element menu. Design rows follow the Bricks panel layout. Code fields use VS Code / GitHub syntax colors.
- The header logo is the mascot (`mascot-light` on dark mode, `mascot-dark` on light mode). Inter must be loaded through `next/font/google` or medium weight does not render.
