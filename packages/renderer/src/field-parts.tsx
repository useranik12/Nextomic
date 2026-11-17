import { DEFAULT_MESSAGES } from "@nextomic/schema";
import { createElement, type ReactNode } from "react";
import { z } from "zod";
import type { ControlDef, RenderContext } from "./registry";

// Pieces every form field element shares (elements.md "Forms"): the settings groups, switch and
// number reading, and the help, error and success paragraphs the runtime fills in.

export const FORM_NAME_REASON =
  "Form and field names are identifiers the Form tags and actions refer to; they must be known when the page is saved.";

/** Static text, a number or a switch; dynamic text is checked by the shared prop value schema. */
export const looseValue = z.union([z.string(), z.number(), z.boolean()]).optional();

export const numberOrNull = (value: string): number | null => {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** A switch prop is on when its text, after dynamic data resolves, is `true`. */
export const on = (ctx: RenderContext, key: string): boolean => ctx.text(key) === "true";

export const flag = (value: boolean): "true" | undefined => (value ? "true" : undefined);

export const GROUP = {
  field: "Field",
  content: "Content",
  options: "Options",
  validation: "Validation",
  icons: "Icons",
  messages: "Messages",
  behavior: "Behavior"
} as const;

/** The controls for the messages a field may show; `keys` picks which of them it has. */
export const messageControlsFor = (
  keys: readonly { key: string; label: string; message: keyof typeof DEFAULT_MESSAGES }[]
): ControlDef[] =>
  keys.map(({ key, label, message }) => ({
    key,
    label,
    kind: "text",
    group: GROUP.messages,
    placeholder: DEFAULT_MESSAGES[message]
  }));

/** The message an error preview shows: the first one the author wrote, else the required text. */
export const errorSample = (ctx: RenderContext): string =>
  ctx.text("requiredMessage") || DEFAULT_MESSAGES.required;

/**
 * The help, error and success paragraphs below a field. The error paragraph is empty until the
 * runtime fills it; the editor canvas can pin a field in one state (`data-nxt-force`) to style it.
 */
export function fieldNotes(
  ctx: RenderContext,
  ids: { help: string; error: string }
): { describedBy: string; nodes: ReactNode[] } {
  const help = ctx.text("helpText");
  const success = ctx.text("successMessage");
  const force = ctx.attrs["data-nxt-force"];
  const sample = force === "error" ? errorSample(ctx) : "";
  return {
    describedBy: `${ids.help} ${ids.error}`,
    nodes: [
      help ? createElement("p", { key: "help", id: ids.help, "data-nxt-help": "" }, help) : null,
      createElement(
        "p",
        {
          key: "error",
          id: ids.error,
          role: "alert",
          hidden: sample === "" || undefined,
          "data-nxt-error": ""
        },
        sample
      ),
      createElement(
        "p",
        {
          key: "success",
          role: "status",
          hidden: force === "success" && success ? undefined : true,
          "data-nxt-success": ""
        },
        success
      )
    ]
  };
}
