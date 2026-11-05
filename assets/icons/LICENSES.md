# Icon set licenses (builder UI)

Builder UI icons are bundled locally at build time from Iconify data packages — no runtime calls
to Iconify's API (see `docs/ui-reference.md` section 3). Every set used must be recorded here
before shipping. Icons marked `fallback: true` in
`apps/editor/src/lib/icons/registry.ts` are Google Material Symbols used only because no
preferred set had a match — review these periodically and prefer swapping in a match from one
of the preferred sets (Streamline, Lineicons, Phosphor, Fluent) when one appears.

| Set            | Package            | License | Attribution required | Source                    |
| -------------- | ------------------ | ------- | -------------------- | ------------------------- |
| Phosphor Icons | `@iconify-json/ph` | MIT     | No                   | https://phosphoricons.com |

No Google Material Symbols fallback is in use yet (Phase 0 icon set is fully covered by
Phosphor). Update this table any time a new set is added.
