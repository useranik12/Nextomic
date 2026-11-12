import { toText } from "@nextomic/schema";
import { FlowError, type ActionHandler } from "./engine";

// Date/Time Picker and Color Picker (docs/dynamic-data-and-actions.md section 8.10). Both open the
// browser's own picker on a hidden input. A browser only opens it right after a click, so the
// action should run first in a click flow (or after quick steps).

export type PickerType = "date" | "time" | "datetime-local" | "color";

export interface PickRequest {
  type: PickerType;
  /** Start value, already in the input's own format; empty for none. */
  value: string;
  min?: string;
  max?: string;
}

/** How long a picker may stay open without an answer before the action gives up (as cancelled). */
const GIVE_UP_MS = 10 * 60 * 1000;
let openPicker: (() => void) | null = null;

/** Opens the browser picker; resolves the chosen value, or null when it was dismissed. */
export function pickValue(request: PickRequest): Promise<string | null> {
  openPicker?.();
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = request.type;
    if (request.value) input.value = request.value;
    if (request.min) input.min = request.min;
    if (request.max) input.max = request.max;
    input.tabIndex = -1;
    input.setAttribute("aria-hidden", "true");
    input.style.cssText =
      "position:fixed;left:50%;top:50%;width:1px;height:1px;opacity:0;pointer-events:none";
    let done = false;
    let timer = 0;
    const finish = (value: string | null) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      if (openPicker === cancel) openPicker = null;
      input.remove();
      resolve(value);
    };
    const cancel = () => finish(null);
    openPicker = cancel;
    input.addEventListener("change", () => finish(input.value || null));
    input.addEventListener("cancel", cancel);
    // Date and time pickers lose focus when they close without a choice.
    if (request.type !== "color")
      input.addEventListener("blur", () => window.setTimeout(() => !done && cancel(), 250));
    timer = window.setTimeout(cancel, GIVE_UP_MS);
    document.body.append(input);
    try {
      input.focus({ preventScroll: true });
      input.showPicker();
    } catch {
      done = true;
      window.clearTimeout(timer);
      input.remove();
      reject(
        new FlowError(
          "picker-blocked",
          "The browser only opens a picker right after a click. Put this action first in a click flow."
        )
      );
    }
  });
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A date, time or date-time text as the matching input wants it ("" when it cannot be read). */
export function pickerInputValue(mode: string, text: string): string {
  const t = text.trim();
  if (t === "") return "";
  if (mode === "time") {
    const m = /^(\d{1,2}):(\d{2})/.exec(t);
    return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? `${pad(Number(m[1]))}:${m[2]}` : "";
  }
  const d = /^\d{4}-\d{2}-\d{2}$/.test(t) ? new Date(`${t}T00:00`) : new Date(t);
  if (Number.isNaN(d.getTime())) return "";
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return mode === "date" ? date : `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The action's answer: a date as `YYYY-MM-DD`, a time as `HH:MM`, a date and time as an ISO timestamp. */
export function pickerAnswer(mode: string, raw: string): string {
  if (mode !== "datetime") return raw;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw : d.toISOString();
}

const COLOR = /^#[0-9a-f]{6}$/i;

export function pickerHandlers(deps: { pick: typeof pickValue }): Record<string, ActionHandler> {
  return {
    "picker.date": async (p) => {
      const mode = toText(p.mode) || "date";
      if (mode !== "date" && mode !== "time" && mode !== "datetime")
        throw new FlowError("bad-mode", "Choose date, time or date and time.");
      const min = pickerInputValue(mode, toText(p.min));
      const max = pickerInputValue(mode, toText(p.max));
      const raw = await deps.pick({
        type: mode === "datetime" ? "datetime-local" : mode,
        value: pickerInputValue(mode, toText(p.initial)),
        ...(min ? { min } : {}),
        ...(max ? { max } : {})
      });
      return raw === null ? null : pickerAnswer(mode, raw);
    },
    "picker.color": async (p) => {
      const initial = toText(p.initial).trim();
      const raw = await deps.pick({
        type: "color",
        value: COLOR.test(initial) ? initial : "#000000"
      });
      return raw === null ? null : raw.toLowerCase();
    }
  };
}
