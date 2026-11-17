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
