// Where a setting has a value, for the change dots of the Design panel (docs/ui-reference.md
// "Change dots"). Yellow is the element's own styles, blue is the classes applied to it. Bright
// means set at the breakpoint and state being edited, faded means set somewhere else only.

import { parseFormDesignKey } from "./choice-design";
import type { EditState } from "./edit-state";
import type { StyleMap } from "./style";

export type MarkLevel = "here" | "elsewhere" | "none";

export interface Marks {
  /** The element's own styles. */
  element: MarkLevel;
  /** The classes applied to the element (bright: the active class sets it here). */
  classes: MarkLevel;
}

interface Entry {
  breakpoint: string;
  state: string;
}

type Table = Map<string, Entry[]>;

/** The setting a style key stands for and the state it is stored under. */
function normalize(key: string, mapState: string): { identity: string; state: string } {
  const part = parseFormDesignKey(key);
  if (!part) return { identity: key, state: mapState };
  return { identity: `--nxt-ip-${part.part.id}-${part.prop}`, state: part.state };
}

function tableOf(styles: StyleMap | undefined): Table {
  const table: Table = new Map();
  for (const [breakpoint, byState] of Object.entries(styles?.breakpoints ?? {})) {
    for (const [mapState, declarations] of Object.entries(byState ?? {})) {
      for (const key of Object.keys(declarations ?? {})) {
        const { identity, state } = normalize(key, mapState);
        const list = table.get(identity);
        if (list) list.push({ breakpoint, state });
        else table.set(identity, [{ breakpoint, state }]);
      }
    }
  }
  return table;
}

export interface StyleMarkIndex {
  /** The dots of one setting (or the OR of several, for a group header). */
  marks: (keys: readonly string[], breakpoint: string, state: EditState) => Marks;
  /** The select's own dot: bright when the chosen state has values here, faded when only others do. */
  stateMarks: (breakpoint: string, state: EditState) => Marks;
  /** The dot of one state in the select's list: bright here, faded when only another breakpoint has it. */
  optionMarks: (breakpoint: string, state: EditState) => Marks;
}

const NONE: Marks = { element: "none", classes: "none" };

const stronger = (a: MarkLevel, b: MarkLevel): MarkLevel =>
  a === "here" || b === "here"
    ? "here"
    : a === "elsewhere" || b === "elsewhere"
      ? "elsewhere"
      : "none";

/** Bright when an entry sits at this breakpoint and state, faded when there are only others. */
function levelOf(entries: readonly Entry[], breakpoint: string, state: string): MarkLevel {
  if (entries.length === 0) return "none";
  return entries.some((e) => e.breakpoint === breakpoint && e.state === state)
    ? "here"
    : "elsewhere";
}

const allEntries = (table: Table | null): Entry[] => [...(table?.values() ?? [])].flat();

/**
 * Builds the lookup from the element's styles, the styles of every applied class and the active
 * class (the class being edited, one of the applied ones). Build it once per selection or edit.
 */
export function styleMarkIndex(
  element: StyleMap | undefined,
  applied: readonly (StyleMap | undefined)[],
  active: StyleMap | undefined
): StyleMarkIndex {
  const own = tableOf(element);
  const appliedTables = applied.map(tableOf);
  const activeTable = active ? tableOf(active) : null;
  const appliedEntries = appliedTables.flatMap(allEntries);

  // Blue: bright only for the class being edited, faded for any applied class.
  const classLevel = (
    entries: readonly Entry[],
    activeEntries: readonly Entry[],
    b: string,
    s: string
  ) =>
    levelOf(activeEntries, b, s) === "here"
      ? "here"
      : entries.length > 0 || activeEntries.length > 0
        ? "elsewhere"
        : "none";

  return {
    marks: (keys, breakpoint, state) => {
      let result: Marks = NONE;
      for (const key of keys) {
        const { identity } = normalize(key, state);
        const mine = own.get(identity) ?? [];
        const active = activeTable?.get(identity) ?? [];
        const classes = appliedTables.flatMap((table) => table.get(identity) ?? []);
        result = {
          element: stronger(result.element, levelOf(mine, breakpoint, state)),
          classes: stronger(
            result.classes,
            classLevel(classes, active, breakpoint, state) as MarkLevel
          )
        };
      }
      return result;
    },
    stateMarks: (breakpoint, state) => ({
      element: levelOf(allEntries(own), breakpoint, state),
      classes: classLevel(appliedEntries, allEntries(activeTable), breakpoint, state) as MarkLevel
    }),
    optionMarks: (breakpoint, state) => {
      const sameState = (entries: Entry[]) => entries.filter((e) => e.state === state);
      return {
        element: levelOf(sameState(allEntries(own)), breakpoint, state),
        classes: classLevel(
          sameState(appliedEntries),
          sameState(allEntries(activeTable)),
          breakpoint,
          state
        ) as MarkLevel
      };
    }
  };
}
