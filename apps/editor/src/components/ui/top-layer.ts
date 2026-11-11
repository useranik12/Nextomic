// HeroUI v3 popovers render in a portal outside any HeroUI v2 modal, and v2 runs its own copy of
// react-aria. Until the sweep moves every v2 overlay to v3, v2 must know these popovers float above
// it. An element marked `data-react-aria-top-layer` stays inside a v2 modal's focus trap, is not
// hidden from assistive tech by the modal, and a press in it is not an "outside" click. Without the
// mark, a v3 Select in a v2 modal closes the modal or refuses to open a second time.
// Spread onto every v3 popover and tooltip. Remove with the `@heroui-v2/react` alias.
export const TOP_LAYER = { "data-react-aria-top-layer": "true" } as const;
