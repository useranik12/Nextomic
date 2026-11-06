# Fonts and Icons Spec

Lets users add text fonts and icon libraries to a project and use them everywhere in a built site: Design tab font controls, variables, themes, the Icon element, buttons, form fields, and lists.

This is for BUILT SITES. The builder's own UI icons are separate (see `ui-reference.md`, Icons) and are never affected by a project's libraries.

## 1. Where it lives

- Design System page, tab **Fonts & Icons** (primary home, with sub-tabs Fonts and Icons).
- Shortcuts: App Settings > App Assets links to it; the Design tab font-family control has "Add font..."; the icon picker has "Manage libraries...".
- No visual design was supplied. Use the Media page pattern (library list on the left, content grid and details on the right) in Nextomic styling and get owner approval of the first build.

## 2. Text fonts

### 2.1 Sources

| Source       | Notes                                                                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Fonts | Browse and search the catalog (family, category, language/subset, variable only filter).                                                       |
| Fontsource   | Self-hostable open-source font packages on npm (includes Google Fonts and others). Preferred way to fetch files without calling Google at all. |
| Upload       | woff2, woff, ttf, otf. Validate by magic bytes and parse the font tables for family, weight, style, and axes. Convert to woff2 when possible.  |
| System fonts | Named system stacks (for example `system-ui`), no files.                                                                                       |

Adobe Fonts and other paid or licensed-per-domain services are out of scope for now.

### 2.2 Import behavior

- **Self-host by default.** On import the builder downloads the font files server-side into the project's storage (`fonts/`). Built sites load fonts from their own origin and make no runtime requests to Google or any font CDN. This avoids privacy and consent problems and is faster. A "Link to CDN" option may exist but is off and shows a warning.
- User picks weights, styles, and subsets (for example latin, latin-ext, devanagari). Variable fonts import as a single file with a weight range and any extra axes (width, optical size, italic). Only the chosen subsets are shipped, with `unicode-range` so browsers fetch only what a page needs.
- Generated CSS: `@font-face` per file with `font-display: swap`, plus a size-adjusted fallback face to reduce layout shift. Critical fonts (marked "Preload") get `<link rel="preload" as="font" type="font/woff2" crossorigin>`.
- Each font has roles that map to variables: Heading, Body, Mono (`--nxt-font-heading`, `--nxt-font-body`, `--nxt-font-mono`), or any custom font-family variable (see `design-system.md`). Themes choose fonts per theme (see `templates-and-themes.md`).
- The font picker in the Design tab shows only project fonts and system stacks, with live preview and weight range. "Add font..." opens the importer.
- A page-weight estimate shows the font bytes a page will load. Warn when a project exceeds a soft limit (default 6 font files or about 300 KB on first view).
- **Licenses:** each font shows its license (for example OFL, Apache 2.0) and the license text is saved with the files and included in exports. Uploaded fonts require a checkbox: "I have the right to use and distribute this font on websites." Do not allow upload without it.
- Removing a font that is used by a variable, theme, class, or element is blocked until it is replaced; show the usage list and a "Replace with..." option.

### 2.3 Data

**As built:** font metadata is stored as JSON in `ProjectSettings.fonts` (`packages/schema/src/fonts.ts`), not in a `project_fonts` table, so it saves, versions and publishes with the rest of the project (the published snapshot keeps its own list). Each font: id, family, source (`google|upload`), sourceNote, category, license, active, preload, display, files (file, format, weight, weightMax for variable, style, subset, unicodeRange, bytes, sha256). Files are stored through the storage adapter under `fonts/<projectId>/<fontId>/<file>` and served by the app at `/fonts/<projectId>/<fontId>/<file>` (public, immutable cache, CORS `*` for the sandboxed canvas). Google Fonts are listed and downloaded through the Fontsource API and jsDelivr (`api.fontsource.org`, `cdn.jsdelivr.net` only, https, no redirects, 2 MB per file, 60 files per font); only the active fonts are written as `@font-face`. A variable font uses the Fontsource `wght` axis file. Uploads take weight and style from the user (guessed from the file name); the format comes from the file bytes. Removed fonts keep their files in storage because the published site may still use them.

## 3. Icon libraries

### 3.1 Two kinds, same picker

- **SVG icon sets** (for example Lucide, Tabler, Phosphor, Heroicons, Fluent, Streamline free, Lineicons, Iconoir, Carbon, Remix, Bootstrap Icons): icon data comes as SVG.
- **Icon fonts** (for example Font Awesome Free, Material Icons/Symbols, Bootstrap Icons font, Remix Icon font, Boxicons, Lineicons font, IcoMoon and Fontello exports): glyph font files plus CSS classes.
  Both appear in one icon picker (tabs per library plus "All", search, size and color preview, favorites, recent).

### 3.2 Catalog ("popular free libraries")

A curated catalog of popular free libraries, each with name, source package, version, icon count, style (outline, solid, duotone), license, and whether attribution is required. Candidates to verify before shipping each: Font Awesome Free, Material Symbols/Icons, Bootstrap Icons, Remix Icon, Phosphor, Lucide, Tabler Icons, Feather, Heroicons, Ionicons, Boxicons, Lineicons (free), Fluent UI System Icons, Streamline (free sets), Iconoir, Carbon, Eva, Unicons, Simple Icons (brand logos; trademarks apply). Icon data for SVG sets comes from Iconify's per-set data packages; font libraries come from their own npm packages.

- Licenses differ: some need attribution (for example CC BY), some limit use (brand logos), and some have free and paid tiers. The catalog stores license and a `requiresAttribution` flag. Attribution-required libraries add an automatic credits file to the export and show a notice in the UI. A library whose license cannot be confirmed is not offered.
- Fetch rules: download the library's published tarball from the package registry and verify the integrity hash. Never run install scripts or any package code in the builder. Extract only allowlisted file types (woff2, woff, ttf, otf, svg, json, css, license files). Pin versions; "Update" bumps the version after showing the changelog and affected icons.
- Network: the registry and font hosts must be on the outbound allowlist; if blocked, show a clear message. The SSRF protections in `integrations.md` apply.

### 3.3 Output mode (per library)

- **Inline SVG (default and recommended):** only icons actually used are shipped, deduplicated per page into a sprite or inline, colored with `currentColor`, sized with `em`, accessible (`aria-hidden` for decorative icons, labels for meaningful ones), and independent of any font loading.
- **Icon font:** CSS plus woff2. For libraries that ship a font, use it (optionally a subset containing only used glyphs, generated in an isolated worker). For SVG-only libraries, a font can be generated from the icons actually used. Classes use the library prefix (for example `nxt-ph-house`). Show a warning that fonts load all glyphs, cannot be multi-colored, and can break with blocked fonts.
  The icon reference in page JSON is `{ library, name }`, never raw SVG, so switching a library's mode or version applies everywhere on the next build.

### 3.4 Custom libraries (import)

- **IcoMoon export:** upload the zip or the files (`selection.json`, font files, `style.css`). Read glyph names and codepoints from `selection.json`.
- **Fontello export:** read `config.json` and the font files.
- **Generic icon font:** upload font files plus the CSS file. Parse the class-to-codepoint mapping (`.prefix-name:before { content: "\e900" }`). The uploaded CSS is parsed and discarded; the builder regenerates its own CSS from the mapping and never serves uploaded CSS as is.
- **SVG upload:** single files or a zip of SVGs form a custom set. Names come from file names (slugified, deduplicated). Sanitize every SVG (remove scripts, event handlers, external references, `foreignObject`), normalize the `viewBox`, and choose "recolor with currentColor" or "keep original colors".
- **Iconify JSON:** paste or upload an Iconify icon set JSON.
- Rules: size caps (per file and per library), magic-byte validation, no executable content, and a rights confirmation checkbox for every custom import. Each custom library gets a unique prefix.

### 3.5 Library management

List of installed libraries: name, source, version, icon count, license, mode (SVG or font), size, enabled toggle, update, remove. Remove is blocked while icons are used; show usage and offer "Replace with an icon from another library". Search across all enabled libraries. Disabled libraries stay in the project but are hidden from the picker.

### 3.5.1 Data

`project_icon_libraries`: id, project_id, key (prefix), name, source (`iconify|npm-font|upload-font|upload-svg|icomoon|fontello|iconify-json`), source_version, license, requires_attribution, mode (`svg|font`), files jsonb, icon_count, enabled, created_by, created_at. SVG set data is stored as a JSON file in storage (`icons/<projectId>/<key>.json`), not in the database.

## 4. Use in the editor and output

- Icon element, Icon List, Button (icon left or right), form fields (clear, show/hide password, select options), accordion and tab indicators, and anything with an icon prop use the same picker and the `{ library, name }` reference. Icon props accept dynamic data (for example a query field holding an icon name), resolved against enabled libraries; an unknown name shows a configurable fallback icon.
- Because dynamic names cannot be tree-shaken at build time, libraries used with dynamic names in SVG mode ship as a lazy-loaded set; show a size warning in the UI.
- The canvas loads fonts and icons from the project's storage URLs. Export bundles font files, icon assets, CSS, and license and attribution files.
- Fonts and icon assets are covered by backups and by the `.nextomic.zip` package.

## 5. Phase placement

- Phase 2: Fonts sub-tab (Google, Fontsource, upload, self-hosting, variable fonts, roles to variables, licenses) because typography, variables, and themes need it. Built, see `phases.md` for what is still open.
- Phase 6: Icons sub-tab (catalog, import, custom libraries, picker, output modes) together with the Media manager.
- Phase 7: Icon, Icon List, and other elements consume the picker.
- Phase 11: export includes fonts, icons, and credits.

## 6. Tests

Font import (Google and Fontsource sources mocked, upload validation, woff2 conversion, subset and unicode-range output, preload tags, size-adjusted fallback), variable font weight range, license gating, usage-blocked removal, no runtime requests to font CDNs in built output, icon catalog fetch with integrity check and no script execution, SVG sanitization (script, handler, external reference removed), IcoMoon and Fontello parsing, generic CSS mapping parse without serving uploaded CSS, SVG mode tree-shaking (only used icons shipped), font mode output, dynamic icon name fallback, attribution file generation.
