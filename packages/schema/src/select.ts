import type { ElementNode } from "./element";

// Select (docs/elements.md "Select"): a field that opens a list of options in a popover. The
// options are the same child Option elements Radio, Checkbox group and Choice chips use, so the
// value shapes, the value data type and the query-driven options work the same way. This file
// holds what the renderer, the runtime and the save checks share.

export const SELECT_TYPE = "select";

/** How the chosen options show in the closed field when several can be chosen. */
export const SELECT_DISPLAYS = ["chips", "text", "count"] as const;
export type SelectDisplay = (typeof SELECT_DISPLAYS)[number];

export const selectDisplayOf = (value: string): SelectDisplay =>
  SELECT_DISPLAYS.find((item) => item === value) ?? "chips";

/** The chips shown before the rest fold into "+N" (a field is one row, not a wall of chips). */
export const SELECT_MAX_CHIPS = 3;

export const maxChipsOf = (value: string): number => {
  const n = Number(value);
  return value.trim() !== "" && Number.isInteger(n) && n >= 1 && n <= 20 ? n : SELECT_MAX_CHIPS;
};

/** The text shown for a count of chosen options: `{count}` becomes the number. */
export const DEFAULT_COUNT_TEXT = "{count} selected";
export const countText = (template: string, count: number): string =>
  (template || DEFAULT_COUNT_TEXT).replace(/{count}/g, String(count));

/**
 * The text a search compares: lower case, accents removed (so "cafe" finds "Café"), spaces
 * collapsed. The runtime applies the same function to the options and to what the visitor typed.
 */
export const searchKey = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Whether every word of the query appears somewhere in the text (an empty query matches all). */
export function matchesSearch(text: string, query: string): boolean {
  const words = searchKey(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const hay = searchKey(text);
  return words.every((word) => hay.includes(word));
}

const plain = (node: ElementNode, key: string): string | null => {
  const v = node.props[key];
  if (v === undefined) return "";
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : null;
};

/** One option chosen when the page starts: its value and the words shown for it. */
export interface StartChoice {
  value: string;
  label: string;
}

/**
 * The options a Select starts with chosen, for drawing the closed field before any script runs.
 * Plain text only: a label or an option list that comes from dynamic data is drawn by the runtime.
 */
export function startChoices(node: ElementNode): StartChoice[] {
  const out: StartChoice[] = [];
  for (const child of node.children) {
    if (
      child.type !== "option" ||
      !(child.props.selected === true || child.props.selected === "true")
    )
      continue;
    const label = plain(child, "label");
    const value = plain(child, "value");
    if (label === null || value === null) continue;
    out.push({ value: value || label, label: label || value });
  }
  return out;
}

/**
 * Problems of one Select that make it unusable: an option with no label (an icon-only option) and no
 * value has no value to hold and nothing for a screen reader to say. Text from dynamic data is only
 * known when the option is drawn, so only plain text is checked here.
 */
export function selectProblems(node: ElementNode): string[] {
  if (node.type !== SELECT_TYPE) return [];
  const problems: string[] = [];
  const name = plain(node, "name") ?? "";
  for (const child of node.children) {
    if (child.type !== "option") continue;
    if (plain(child, "label") === "" && plain(child, "value") === "")
      problems.push(
        `An option of "${name}" has no label and no value. An icon-only option needs a value, and a label for screen readers.`
      );
  }
  return problems;
}
