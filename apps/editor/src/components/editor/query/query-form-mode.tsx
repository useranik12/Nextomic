"use client";

import type { BindKey } from "@nextomic/schema";
import { createContext, useContext } from "react";

// How the query settings forms behave. On a loop (the default) the settings are filled on the
// server, so the bolt offers raw tokens. In a Refresh Query action the forms edit a copy of the
// loop's settings: values are filled when the action runs, each label's tip says what the loop
// itself uses, and settings a refresh cannot change are shown locked.

/** The bound settings of a Refresh Query: rows, skip and sort take a {{ tag }} filled when the action runs. */
export interface BindControls {
  /** The saved text of a bound setting ("" when it is fixed). */
  get: (key: BindKey) => string;
  set: (key: BindKey, text: string) => void;
}

export interface QueryFormMode {
  /** Values are filled on the server (a loop's own settings). */
  serverRun: boolean;
  /** Edited in a Refresh Query action. */
  refresh: boolean;
  /** The query feeds the options of a field: a plain list, so single row, infinite scroll and realtime are not offered. */
  field: boolean;
  /** Present in a Refresh Query action only. */
  bind?: BindControls | null;
  /** The info tip of a field, by key (see refresh-tips.ts); undefined shows none. */
  tip: (key: string) => string | undefined;
}

const LOOP_MODE: QueryFormMode = {
  serverRun: true,
  refresh: false,
  field: false,
  tip: () => undefined
};

const QueryFormContext = createContext<QueryFormMode>(LOOP_MODE);

export const QueryFormModeProvider = QueryFormContext.Provider;

export const useQueryFormMode = (): QueryFormMode => useContext(QueryFormContext);
