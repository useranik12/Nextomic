/**
 * Places a field's popover under its box, or above it when there is no room below, and right-aligned
 * when it would pass the window's edge (the date picker and the Select share this). The popover is
 * measured as drawn under the field, so call this after it is shown.
 */
export function placePopover(popover: HTMLElement, field: Element): void {
  popover.removeAttribute("data-placement");
  popover.removeAttribute("data-align");
  const box = field.querySelector("[data-nxt-box]") ?? field;
  const at = popover.getBoundingClientRect();
  if (at.right > window.innerWidth) popover.setAttribute("data-align", "end");
  const anchor = box.getBoundingClientRect();
  const room = { below: window.innerHeight - anchor.bottom, above: anchor.top };
  if (at.bottom > window.innerHeight && room.above > room.below)
    popover.setAttribute("data-placement", "top");
}
