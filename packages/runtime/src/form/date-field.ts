import {
  addDays,
  addMonths,
  clampValue,
  dateModeOf,
  dateOfParts,
  datePartOf,
  dayInLimits,
  dayName,
  monthGrid,
  monthTitle,
  normalizeDate,
  parseDate,
  parseValue,
  showValue,
  snapTime,
  timeOfParts,
  valueInLimits,
  weekdayNames,
  weekdayOf,
  type DateMode,
  type DateStyle,
  type HM,
  type YMD
} from "@nextomic/schema";

// The Date and time field of a built page (elements.md "Date and time"). The page draws every part
// (42 day cells, the time lists); this module only changes their text and attributes, opens and closes
// the popover, and keeps the value (`YYYY-MM-DD`, `HH:mm` or `YYYY-MM-DDTHH:mm`, local wall time) in
// the hidden control. It follows the date picker dialog pattern: the day grid has one tab stop,
// arrows move by a day or a week, Page Up and Page Down by a month (with Shift a year), Home and End
// to the start and end of the week, Escape closes and gives focus back to the field.

export const DATE_FIELD = '[data-nxt-field][data-nxt-kind="date"]';

interface Config {
  mode: DateMode;
  min: string;
  max: string;
  minDay: string;
  maxDay: string;
  weekStart: number;
  clock: "12" | "24";
  step: number;
  style: DateStyle;
  locale: string;
}

const attr = (field: Element, name: string) => field.getAttribute(name) ?? "";

function configOf(field: Element): Config {
  const mode = dateModeOf(attr(field, "data-nxt-mode"));
  const min = normalizeDate(mode, attr(field, "data-nxt-min"));
  const max = normalizeDate(mode, attr(field, "data-nxt-max"));
  const style = attr(field, "data-nxt-style");
  const step = Number(attr(field, "data-nxt-minute-step"));
  return {
    mode,
    min,
    max,
    minDay: datePartOf(mode, min),
    maxDay: datePartOf(mode, max),
    weekStart: Number(attr(field, "data-nxt-week-start")) % 7 || 0,
    clock: attr(field, "data-nxt-clock") === "24" ? "24" : "12",
    step: step >= 1 && step <= 30 ? step : 5,
    style: style === "short" || style === "long" ? style : "medium",
    locale:
      attr(field, "data-nxt-locale") ||
      document.documentElement.lang ||
      (typeof navigator === "undefined" ? "" : navigator.language) ||
      "en-US"
  };
}

const controlOf = (field: Element) => field.querySelector<HTMLInputElement>("[data-nxt-control]");
const triggerOf = (field: Element) => field.querySelector<HTMLElement>("[data-nxt-trigger]");
const popoverOf = (field: Element) => field.querySelector<HTMLElement>("[data-nxt-popover]");

const todayOf = (): YMD => {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
};

const nowTime = (step: number): HM => {
  const now = new Date();
  return snapTime({ h: now.getHours(), min: now.getMinutes() }, step);
};

/** Today, moved to the nearest day the limits allow. */
function allowedToday(c: Config): YMD {
  const today = dateOfParts(todayOf());
  if (c.minDay !== "" && today < c.minDay) return parseDate(c.minDay) ?? todayOf();
  if (c.maxDay !== "" && today > c.maxDay) return parseDate(c.maxDay) ?? todayOf();
  return todayOf();
}

const views = new WeakMap<Element, { y: number; m: number }>();
let openField: Element | null = null;
/** The field a press outside the picker just closed (a label press forwards a click to the trigger). */
let closedByPress: { field: Element; at: number } | null = null;

function viewFor(field: Element, c: Config, value: string): { y: number; m: number } {
  const known = views.get(field);
  if (known) return known;
  const day = parseValue(c.mode, value)?.date ?? allowedToday(c);
  return { y: day.y, m: day.m };
}

function paintMonth(field: Element, c: Config, value: string, focusIso: string | null): void {
  const view = viewFor(field, c, value);
  const picked = parseValue(c.mode, value)?.date;
  const pickedIso = picked ? dateOfParts(picked) : "";
  const todayIso = dateOfParts(todayOf());
  const grid = monthGrid(view.y, view.m, c.weekStart);
  const inMonth = grid.filter((cell) => cell.inMonth);
  const stop =
    focusIso ??
    ([pickedIso, todayIso].find((iso) => inMonth.some((cell) => cell.iso === iso)) ||
      inMonth[0]?.iso ||
      "");
  field.querySelectorAll<HTMLElement>("[data-nxt-day]").forEach((el, i) => {
    const cell = grid[i];
    if (!cell) return;
    el.textContent = String(cell.d);
    el.setAttribute("data-date", cell.iso);
    el.toggleAttribute("data-outside", !cell.inMonth);
    el.toggleAttribute("data-today", cell.iso === todayIso);
    el.setAttribute("aria-selected", cell.iso === pickedIso ? "true" : "false");
    if (dayInLimits(cell.iso, c.minDay, c.maxDay)) el.removeAttribute("aria-disabled");
    else el.setAttribute("aria-disabled", "true");
    el.setAttribute("aria-label", dayName(cell, c.locale));
    el.tabIndex = cell.iso === stop ? 0 : -1;
  });
  const title = monthTitle(view.y, view.m, c.locale);
  const heading = field.querySelector("[data-nxt-title]");
  if (heading) heading.textContent = title;
  field.querySelector('[role="grid"]')?.setAttribute("aria-label", title);
  const names = weekdayNames(c.locale, c.weekStart);
  field.querySelectorAll<HTMLElement>("[data-nxt-weekday]").forEach((el, i) => {
    el.textContent = names[i]?.short ?? "";
    el.setAttribute("aria-label", names[i]?.long ?? "");
  });
  const before = dateOfParts(addDays({ y: view.y, m: view.m, d: 1 }, -1));
  const after = dateOfParts(addMonths({ y: view.y, m: view.m, d: 1 }, 1));
  field.querySelectorAll<HTMLButtonElement>("[data-nxt-nav]").forEach((button) => {
    const back = Number(button.getAttribute("data-nxt-nav")) < 0;
    button.disabled = back
      ? c.minDay !== "" && before < c.minDay
      : c.maxDay !== "" && after > c.maxDay;
  });
}

/** The time a time choice gives when it is applied on top of the current value. */
function withOption(c: Config, base: HM, el: Element): HM | null {
  const kind = el.getAttribute("data-nxt-time");
  const v = Number(el.getAttribute("data-v"));
  if (!Number.isFinite(v)) return null;
  if (kind === "minute") return { h: base.h, min: v };
  if (kind === "meridiem") return { h: (base.h % 12) + (v === 1 ? 12 : 0), min: base.min };
  if (kind === "hour") {
    return c.clock === "12"
      ? { h: (v % 12) + (base.h >= 12 ? 12 : 0), min: base.min }
      : { h: v, min: base.min };
  }
  return null;
}

/** The whole value with a time put on it: a date-time takes the chosen day, else the nearest to today. */
function valueWithTime(c: Config, value: string, time: HM): string {
  if (c.mode === "time") return timeOfParts(time);
  const day = parseValue(c.mode, value)?.date ?? allowedToday(c);
  return `${dateOfParts(day)}T${timeOfParts(time)}`;
}

function paintTimes(field: Element, c: Config, value: string): void {
  const parsed = parseValue(c.mode, value);
  const base = parsed?.time ?? nowTime(c.step);
  field.querySelectorAll<HTMLElement>("[data-nxt-timecol]").forEach((column) => {
    const options = [...column.querySelectorAll<HTMLButtonElement>("[data-nxt-time]")];
    let stop: HTMLButtonElement | undefined;
    for (const el of options) {
      const candidate = withOption(c, base, el);
      const selected = parsed?.time ? isSelected(c, parsed.time, el) : false;
      el.setAttribute("aria-selected", selected ? "true" : "false");
      el.disabled = candidate
        ? !valueInLimits(valueWithTime(c, value, candidate), c.min, c.max)
        : false;
      if (selected) stop = el;
    }
    stop ??= options.find((el) => !el.disabled) ?? options[0];
    for (const el of options) el.tabIndex = el === stop ? 0 : -1;
  });
}

function isSelected(c: Config, time: HM, el: Element): boolean {
  const kind = el.getAttribute("data-nxt-time");
  const v = Number(el.getAttribute("data-v"));
  if (kind === "minute") return time.min === v;
  if (kind === "meridiem") return (time.h >= 12 ? 1 : 0) === v;
  if (kind === "hour") return c.clock === "12" ? time.h % 12 === v % 12 : time.h === v;
  return false;
}

/** Brings everything the visitor sees in line with the value of one Date and time field. */
export function syncDateField(field: Element): void {
  const control = controlOf(field);
  if (!control) return;
  const c = configOf(field);
  const value = normalizeDate(c.mode, control.value);
  const trigger = triggerOf(field);
  if (trigger) {
    const shown = value
      ? showValue(c.mode, value, { locale: c.locale, style: c.style, hour12: c.clock === "12" })
      : "";
    trigger.textContent = shown || (trigger.getAttribute("data-placeholder") ?? "");
    trigger.toggleAttribute("data-empty", shown === "");
  }
  field.querySelector("[data-nxt-clear]")?.toggleAttribute("hidden", value === "");
  if (c.mode !== "time") paintMonth(field, c, value, null);
  if (c.mode !== "date") paintTimes(field, c, value);
}

/** Writes a value into a field (an action or a reset): a text of the wrong shape empties it. */
export function writeDate(field: Element, text: string): void {
  const control = controlOf(field);
  if (!control) return;
  const c = configOf(field);
  control.value = normalizeDate(c.mode, text);
  views.delete(field);
  syncDateField(field);
}

export function syncDates(root: ParentNode): void {
  root.querySelectorAll(DATE_FIELD).forEach(syncDateField);
}

/** Sets the value as the visitor's choice and tells listeners (validation, form tags) about it. */
function commit(field: Element, c: Config, text: string): void {
  const control = controlOf(field);
  if (!control) return;
  const next = clampValue(normalizeDate(c.mode, text), c.min, c.max);
  const changed = control.value !== next;
  control.value = next;
  views.delete(field);
  syncDateField(field);
  if (changed) control.dispatchEvent(new Event("input", { bubbles: true }));
}

function place(popover: HTMLElement, field: Element): void {
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

function close(field: Element, giveFocusBack: boolean): void {
  const popover = popoverOf(field);
  if (!popover || popover.hasAttribute("hidden")) return;
  popover.setAttribute("hidden", "");
  triggerOf(field)?.setAttribute("aria-expanded", "false");
  if (openField === field) openField = null;
  if (giveFocusBack) triggerOf(field)?.focus();
}

function open(field: Element): void {
  const popover = popoverOf(field);
  const trigger = triggerOf(field);
  const control = controlOf(field);
  if (!popover || !trigger || !control || trigger.hasAttribute("disabled")) return;
  if (openField && openField !== field) close(openField, false);
  views.delete(field);
  syncDateField(field);
  popover.removeAttribute("hidden");
  trigger.setAttribute("aria-expanded", "true");
  openField = field;
  place(popover, field);
  // A long list (the hours) starts with the chosen time in view, without moving the page.
  for (const column of popover.querySelectorAll<HTMLElement>("[data-nxt-timecol]")) {
    const chosen = column.querySelector<HTMLElement>('[aria-selected="true"]');
    if (chosen)
      column.scrollTop = chosen.offsetTop - (column.clientHeight - chosen.offsetHeight) / 2;
  }
  const first =
    popover.querySelector<HTMLElement>('[data-nxt-day][tabindex="0"]') ??
    popover.querySelector<HTMLElement>('[data-nxt-time][tabindex="0"]') ??
    popover.querySelector<HTMLElement>("button");
  first?.focus();
}

/** Shows another month, keeping the focus on a day of it. */
function showMonth(field: Element, c: Config, day: YMD): void {
  const control = controlOf(field);
  views.set(field, { y: day.y, m: day.m });
  paintMonth(field, c, control?.value ?? "", dateOfParts(day));
}

function focusDay(field: Element, c: Config, day: YMD): void {
  const iso = dateOfParts(day);
  const shown = field.querySelector<HTMLElement>(
    `[data-nxt-day][data-date="${iso}"]:not([data-outside])`
  );
  if (!shown) showMonth(field, c, day);
  else paintMonth(field, c, controlOf(field)?.value ?? "", iso);
  field
    .querySelector<HTMLElement>(`[data-nxt-day][data-date="${iso}"]:not([data-outside])`)
    ?.focus();
}

function pickDay(field: Element, c: Config, iso: string): void {
  const value = normalizeDate(c.mode, controlOf(field)?.value ?? "");
  if (c.mode === "date") {
    commit(field, c, iso);
    close(field, true);
    return;
  }
  const time = parseValue(c.mode, value)?.time ?? nowTime(c.step);
  commit(field, c, `${iso}T${timeOfParts(time)}`);
}

function pickTime(field: Element, c: Config, el: Element): void {
  const value = normalizeDate(c.mode, controlOf(field)?.value ?? "");
  const base = parseValue(c.mode, value)?.time ?? nowTime(c.step);
  const time = withOption(c, base, el);
  if (time) commit(field, c, valueWithTime(c, value, time));
}

function pickToday(field: Element, c: Config): void {
  const day = dateOfParts(allowedToday(c));
  const time = timeOfParts(nowTime(c.step));
  commit(field, c, c.mode === "date" ? day : c.mode === "time" ? time : `${day}T${time}`);
  if (c.mode === "date") close(field, true);
}

const visible = (el: HTMLElement) => el.getClientRects().length > 0;

function trapTab(popover: HTMLElement, event: KeyboardEvent): void {
  const stops = [...popover.querySelectorAll<HTMLButtonElement>("button")].filter(
    (b) => !b.disabled && b.tabIndex >= 0 && visible(b)
  );
  if (stops.length === 0) return;
  const at = stops.findIndex((b) => b === document.activeElement);
  const next = (at + (event.shiftKey ? -1 : 1) + stops.length) % stops.length;
  event.preventDefault();
  stops[at < 0 ? 0 : next]?.focus();
}

function dayKey(field: Element, c: Config, el: Element, event: KeyboardEvent): void {
  const day = parseDate(el.getAttribute("data-date") ?? "");
  if (!day) return;
  const lead = (weekdayOf(day) - c.weekStart + 7) % 7;
  const moves: Record<string, YMD> = {
    ArrowLeft: addDays(day, -1),
    ArrowRight: addDays(day, 1),
    ArrowUp: addDays(day, -7),
    ArrowDown: addDays(day, 7),
    PageUp: addMonths(day, event.shiftKey ? -12 : -1),
    PageDown: addMonths(day, event.shiftKey ? 12 : 1),
    Home: addDays(day, -lead),
    End: addDays(day, 6 - lead)
  };
  const next = moves[event.key];
  if (!next) return;
  event.preventDefault();
  focusDay(field, c, next);
}

function timeKey(el: Element, event: KeyboardEvent): void {
  const column = el.closest("[data-nxt-timecol]");
  if (!column) return;
  const options = [...column.querySelectorAll<HTMLButtonElement>("[data-nxt-time]")].filter(
    (o) => !o.disabled
  );
  const at = options.indexOf(el as HTMLButtonElement);
  const moves: Record<string, number> = {
    ArrowUp: at - 1,
    ArrowDown: at + 1,
    Home: 0,
    End: options.length - 1
  };
  const to = moves[event.key];
  if (to === undefined || at < 0) return;
  event.preventDefault();
  const next = options[Math.min(Math.max(to, 0), options.length - 1)];
  if (!next) return;
  for (const o of column.querySelectorAll<HTMLElement>("[data-nxt-time]")) o.tabIndex = -1;
  next.tabIndex = 0;
  next.focus();
}

const fieldOf = (target: EventTarget | null): Element | null =>
  target instanceof Element ? target.closest(DATE_FIELD) : null;

export function startDateFields(root: Document): () => void {
  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    const field = fieldOf(target);
    if (!target || !field) return;
    const c = configOf(field);
    if (target.closest("[data-nxt-trigger]")) {
      const popover = popoverOf(field);
      const forwarded =
        closedByPress?.field === field && performance.now() - closedByPress.at < 500;
      closedByPress = null;
      if (forwarded) return;
      if (popover?.hasAttribute("hidden")) open(field);
      else close(field, false);
      return;
    }
    if (target.closest("[data-nxt-clear]")) {
      close(field, false);
      return;
    }
    const nav = target.closest("[data-nxt-nav]");
    if (nav) {
      const view = viewFor(field, c, controlOf(field)?.value ?? "");
      const moved = addMonths({ ...view, d: 1 }, Number(nav.getAttribute("data-nxt-nav")));
      showMonth(field, c, moved);
      return;
    }
    const day = target.closest("[data-nxt-day]");
    if (day) {
      if (day.getAttribute("aria-disabled") !== "true")
        pickDay(field, c, day.getAttribute("data-date") ?? "");
      return;
    }
    const option = target.closest("[data-nxt-time]");
    if (option) {
      pickTime(field, c, option);
      return;
    }
    if (target.closest("[data-nxt-today-btn]")) pickToday(field, c);
    else if (target.closest("[data-nxt-done]")) close(field, true);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && openField) {
      // The picker takes the key first, so a modal around the field stays open.
      event.preventDefault();
      event.stopPropagation();
      close(openField, true);
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    const field = fieldOf(target);
    if (!target || !field || event.ctrlKey || event.metaKey) return;
    const popover = popoverOf(field);
    if (target.closest("[data-nxt-trigger]")) {
      if (event.key === "ArrowDown" && popover?.hasAttribute("hidden")) {
        event.preventDefault();
        open(field);
      }
      return;
    }
    if (!popover || popover.hasAttribute("hidden") || !popover.contains(target)) return;
    if (event.key === "Tab") {
      trapTab(popover, event);
      return;
    }
    const c = configOf(field);
    const day = target.closest("[data-nxt-day]");
    if (day) dayKey(field, c, day, event);
    else if (target.closest("[data-nxt-time]"))
      timeKey(target.closest("[data-nxt-time]") as Element, event);
  };

  const onPointerDown = (event: Event) => {
    if (!openField) return;
    const picker = openField.querySelector("[data-nxt-picker]");
    if (event.target instanceof Node && picker?.contains(event.target)) return;
    closedByPress = { field: openField, at: performance.now() };
    close(openField, false);
  };

  // Leaving the field (the popover closed, focus gone elsewhere) counts as leaving its control, so
  // "validate on blur" works although the visible parts are buttons and the control is hidden.
  const onFocusOut = (event: FocusEvent) => {
    const field = fieldOf(event.target);
    if (!field) return;
    if (event.relatedTarget instanceof Node && field.contains(event.relatedTarget)) return;
    if (openField === field && popoverOf(field)?.contains(event.target as Node)) return;
    controlOf(field)?.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  };

  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKeyDown, true);
  root.addEventListener("pointerdown", onPointerDown, true);
  root.addEventListener("focusout", onFocusOut);
  syncDates(root);
  return () => {
    root.removeEventListener("click", onClick);
    root.removeEventListener("keydown", onKeyDown, true);
    root.removeEventListener("pointerdown", onPointerDown, true);
    root.removeEventListener("focusout", onFocusOut);
  };
}
