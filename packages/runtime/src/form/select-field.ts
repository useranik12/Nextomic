import { countText, matchesSearch, maxChipsOf, selectDisplayOf } from "@nextomic/schema";
import { placePopover } from "./popover-place";

// The Select of a built page (elements.md "Select"). The page draws the closed field, the panel and
// every option as a row of a listbox, each with its hidden real input; the value is read from those
// inputs like any choice field (`field-values.ts`). This module opens and closes the panel, filters
// the rows by what the visitor types, moves the active row (focus stays on the field or its search
// box, so `aria-activedescendant` and `data-active` mark the row), toggles the inputs and repaints
// the closed field (chips, text or a count). It follows the select-only combobox pattern; with a
// search box the field is a button and the search box is the combobox.

export const SELECT_FIELD = '[data-nxt-field][data-nxt-variant="select"]';

const ROWS = "[data-nxt-popover] [data-nxt-choice]";

let openField: Element | null = null;

const trigger = (field: Element) => field.querySelector<HTMLElement>("[data-nxt-trigger]");
const popover = (field: Element) => field.querySelector<HTMLElement>("[data-nxt-popover]");
const search = (field: Element) => field.querySelector<HTMLInputElement>("[data-nxt-search]");
const rowsOf = (field: Element) => [...field.querySelectorAll<HTMLElement>(ROWS)];
const inputOf = (row: Element) => row.querySelector<HTMLInputElement>("[data-nxt-control]");
const isMultiple = (field: Element) => field.hasAttribute("data-nxt-multiple");
const isOpen = (field: Element) => popover(field)?.hasAttribute("hidden") === false;
const labelOf = (row: Element) => row.querySelector("[data-nxt-name]")?.textContent?.trim() ?? "";
const searchTextOf = (row: Element) =>
  `${labelOf(row)} ${row.querySelector("[data-nxt-sub]")?.textContent ?? ""}`;
const usable = (row: HTMLElement) => !row.hidden && row.getAttribute("aria-disabled") !== "true";
const fieldOf = (target: EventTarget | null): Element | null =>
  target instanceof Element ? target.closest(SELECT_FIELD) : null;

function make(tag: string, attrs: Record<string, string>, ...kids: (Node | string)[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  el.append(...kids);
  return el;
}

interface Choice {
  value: string;
  label: string;
}

const chosenOf = (field: Element): Choice[] =>
  rowsOf(field).flatMap((row) => {
    const input = inputOf(row);
    return input?.checked ? [{ value: input.value, label: labelOf(row) || input.value }] : [];
  });

/** The closed field's content for what is chosen: the same markup the page draws at the start. */
function closedContent(field: Element, chosen: Choice[]): HTMLElement[] {
  if (chosen.length === 0)
    return [
      make(
        "span",
        { "data-nxt-placeholder": "" },
        trigger(field)?.getAttribute("data-placeholder") ?? ""
      )
    ];
  const first = chosen[0];
  if (!isMultiple(field) && first) return [make("span", { "data-nxt-value": "" }, first.label)];
  const display = selectDisplayOf(field.getAttribute("data-nxt-display") ?? "");
  if (display === "text")
    return [make("span", { "data-nxt-value": "" }, chosen.map((c) => c.label).join(", "))];
  if (display === "count")
    return [
      make(
        "span",
        { "data-nxt-value": "" },
        countText(field.getAttribute("data-nxt-count-text") ?? "", chosen.length)
      )
    ];
  const max = maxChipsOf(field.getAttribute("data-nxt-max-chips") ?? "");
  const shown = chosen.slice(0, max);
  const rest = chosen.length - shown.length;
  const chips = shown.map((c) =>
    make(
      "span",
      { "data-nxt-chip": "", "data-v": c.value },
      make("span", { "data-nxt-chip-label": "" }, c.label),
      make("span", { "data-nxt-chip-x": "", "aria-hidden": "true" }, "×")
    )
  );
  if (rest > 0) chips.push(make("span", { "data-nxt-more": "" }, `+${rest}`));
  return [make("span", { "data-nxt-values": "" }, ...chips)];
}

/** Makes the rows and the closed field agree with the inputs (the value is only ever in the inputs). */
export function paintSelect(field: Element): void {
  const list = field.querySelector("[data-nxt-listbox]");
  rowsOf(field).forEach((row, i) => {
    // Rows of a query loop are copies of one option, so their element ids repeat: give each its own.
    if (list?.id) row.id = `${list.id}-o${i}`;
    row.setAttribute("aria-selected", inputOf(row)?.checked ? "true" : "false");
  });
  const box = trigger(field);
  if (!box) return;
  // The placeholder is read once, from the page, so a repaint never loses it.
  if (!box.hasAttribute("data-placeholder"))
    box.setAttribute(
      "data-placeholder",
      box.querySelector("[data-nxt-placeholder]")?.textContent ?? ""
    );
  const chosen = chosenOf(field);
  box.replaceChildren(...closedContent(field, chosen));
  box.toggleAttribute("data-empty", chosen.length === 0);
}

export function syncSelects(root: ParentNode): void {
  root.querySelectorAll(SELECT_FIELD).forEach(paintSelect);
}

function setActive(field: Element, row: HTMLElement | null): void {
  for (const other of field.querySelectorAll("[data-active]")) other.removeAttribute("data-active");
  const holder = search(field) && isOpen(field) ? search(field) : trigger(field);
  if (row) {
    row.setAttribute("data-active", "");
    holder?.setAttribute("aria-activedescendant", row.id);
    row.scrollIntoView({ block: "nearest" });
  } else holder?.removeAttribute("aria-activedescendant");
}

/** Hides the rows the typed words do not match, and shows the "no results" line when none is left. */
function filter(field: Element, query: string): void {
  let shown = 0;
  for (const row of rowsOf(field)) {
    const match = matchesSearch(searchTextOf(row), query);
    row.toggleAttribute("hidden", !match);
    if (match) shown += 1;
  }
  field.querySelector("[data-nxt-empty]")?.toggleAttribute("hidden", shown > 0);
  const rows = rowsOf(field).filter(usable);
  setActive(field, rows.find((row) => inputOf(row)?.checked && query === "") ?? rows[0] ?? null);
}

function close(field: Element, giveFocusBack: boolean): void {
  const panel = popover(field);
  if (!panel || panel.hasAttribute("hidden")) return;
  panel.setAttribute("hidden", "");
  setActive(field, null);
  trigger(field)?.setAttribute("aria-expanded", "false");
  if (openField === field) openField = null;
  if (giveFocusBack) trigger(field)?.focus();
}

function open(field: Element): void {
  const panel = popover(field);
  const box = trigger(field);
  if (!panel || !box || box.getAttribute("aria-disabled") === "true") return;
  if (openField && openField !== field) close(openField, false);
  panel.removeAttribute("hidden");
  box.setAttribute("aria-expanded", "true");
  openField = field;
  placePopover(panel, field);
  const input = search(field);
  if (input) input.value = "";
  filter(field, "");
  (input ?? box).focus({ preventScroll: true });
}

/** Tells the form (validation, tags, redraws) that the visitor changed the value. */
function changed(field: Element, input: HTMLInputElement): void {
  paintSelect(field);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function choose(field: Element, row: HTMLElement): void {
  const input = inputOf(row);
  if (!input || input.disabled || !usable(row)) return;
  const before = input.checked;
  input.checked = isMultiple(field) ? !before : true;
  if (input.checked !== before) changed(field, input);
  if (!isMultiple(field) || !field.hasAttribute("data-nxt-keep-open")) close(field, true);
  else setActive(field, row);
}

function removeLast(field: Element): void {
  const last = rowsOf(field)
    .map(inputOf)
    .filter((input): input is HTMLInputElement => Boolean(input?.checked))
    .pop();
  if (!last) return;
  last.checked = false;
  changed(field, last);
}

function removeChoice(field: Element, value: string): void {
  const input = rowsOf(field)
    .map(inputOf)
    .find((item) => item?.checked && item.value === value);
  if (!input) return;
  input.checked = false;
  changed(field, input);
}

function move(field: Element, to: "next" | "previous" | "first" | "last"): void {
  const rows = rowsOf(field).filter(usable);
  if (rows.length === 0) return;
  const at = rows.findIndex((row) => row.hasAttribute("data-active"));
  const index =
    to === "first"
      ? 0
      : to === "last"
        ? rows.length - 1
        : Math.min(Math.max(at + (to === "next" ? 1 : -1), 0), rows.length - 1);
  setActive(field, rows[index] ?? null);
}

let typed = { text: "", at: 0 };

/** A letter typed on the closed-style field jumps to the first option that starts with it. */
function typeahead(field: Element, key: string): void {
  const now = performance.now();
  typed = { text: now - typed.at > 700 ? key : typed.text + key, at: now };
  const hit = rowsOf(field)
    .filter(usable)
    .find((row) => labelOf(row).toLocaleLowerCase().startsWith(typed.text.toLocaleLowerCase()));
  if (hit) setActive(field, hit);
}

export function startSelects(root: Document): () => void {
  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    const field = fieldOf(target);
    if (!target || !field) return;
    if (target.closest("[data-nxt-clear]")) {
      // The form runtime empties the inputs; the panel only has to get out of the way.
      close(field, false);
      return;
    }
    const chip = target.closest<HTMLElement>("[data-nxt-chip-x]");
    if (chip) {
      removeChoice(field, chip.closest<HTMLElement>("[data-nxt-chip]")?.dataset.v ?? "");
      return;
    }
    const row = target.closest<HTMLElement>(ROWS);
    if (row) {
      choose(field, row);
      return;
    }
    if (target.closest("[data-nxt-box]")) {
      if (isOpen(field)) close(field, false);
      else open(field);
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && openField) {
      // The panel takes the key first, so a modal around the field stays open.
      event.preventDefault();
      event.stopPropagation();
      close(openField, true);
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    const field = fieldOf(target);
    if (!target || !field || event.ctrlKey || event.metaKey || event.altKey) return;
    const onSearch = target.matches("[data-nxt-search]");
    if (!onSearch && !target.closest("[data-nxt-trigger]")) return;
    const key = event.key;
    if (!isOpen(field)) {
      if (key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === " ") {
        event.preventDefault();
        open(field);
      } else if (key === "Backspace" && isMultiple(field)) removeLast(field);
      return;
    }
    const moves: Record<string, "next" | "previous" | "first" | "last"> = {
      ArrowDown: "next",
      ArrowUp: "previous",
      ...(onSearch ? {} : { Home: "first" as const, End: "last" as const })
    };
    const step = moves[key];
    if (step) {
      event.preventDefault();
      move(field, step);
    } else if (key === "Enter" || (key === " " && !onSearch)) {
      event.preventDefault();
      const row = field.querySelector<HTMLElement>(`${ROWS}[data-active]`);
      if (row) choose(field, row);
    } else if (key === "Tab") close(field, false);
    else if (key === "Backspace" && onSearch && search(field)?.value === "" && isMultiple(field))
      removeLast(field);
    else if (!onSearch && key.length === 1) typeahead(field, key);
  };

  const onInput = (event: Event) => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const field = fieldOf(input);
    if (input?.matches("[data-nxt-search]") && field) filter(field, input.value);
  };

  // Rows never take focus: pressing one must not move it off the field or the search box.
  const onMouseDown = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(`${ROWS},[data-nxt-chip-x],[data-nxt-empty]`) && fieldOf(target))
      event.preventDefault();
  };

  const onMouseOver = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    const row = target?.closest<HTMLElement>(ROWS);
    const field = fieldOf(row ?? null);
    if (row && field && usable(row) && !row.hasAttribute("data-active")) setActive(field, row);
  };

  const onPointerDown = (event: Event) => {
    if (!openField) return;
    const picker = openField.querySelector("[data-nxt-picker]");
    if (event.target instanceof Node && picker?.contains(event.target)) return;
    close(openField, false);
  };

  // Leaving the field (focus gone elsewhere) closes the panel and counts as leaving its control, so
  // "validate on blur" works although the visible parts are not the inputs.
  const onFocusOut = (event: FocusEvent) => {
    const field = fieldOf(event.target);
    // The event sent below comes back here; only focus that really left a visible part counts.
    if (!field || (event.target instanceof Element && event.target.matches("[data-nxt-control]")))
      return;
    if (event.relatedTarget instanceof Node && field.contains(event.relatedTarget)) return;
    if (isOpen(field)) close(field, false);
    field
      .querySelector("[data-nxt-control]")
      ?.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  };

  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKeyDown, true);
  root.addEventListener("input", onInput);
  root.addEventListener("mousedown", onMouseDown);
  root.addEventListener("mouseover", onMouseOver);
  root.addEventListener("pointerdown", onPointerDown, true);
  root.addEventListener("focusout", onFocusOut);
  syncSelects(root);
  return () => {
    root.removeEventListener("click", onClick);
    root.removeEventListener("keydown", onKeyDown, true);
    root.removeEventListener("input", onInput);
    root.removeEventListener("mousedown", onMouseDown);
    root.removeEventListener("mouseover", onMouseOver);
    root.removeEventListener("pointerdown", onPointerDown, true);
    root.removeEventListener("focusout", onFocusOut);
  };
}
