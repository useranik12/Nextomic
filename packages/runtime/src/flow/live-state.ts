import {
  expressionScope,
  RESULT_LIMIT,
  RESULT_MAX,
  type DynamicContext,
  type QueryState
} from "@nextomic/schema";
import { FlowError } from "./engine";
import { writePersisted, type PersistEnv } from "../persisted-state";
import type { FragmentRequest, RuntimePayload } from "./payload";
import { applyStateOp } from "./state-ops";

// The page's live app and page state, as text like the dynamic context stores it. Changes are
// reported by name ("app.cart") so the runtime redraws only the elements that read them.

export type StateGroup = "app" | "state";

export interface StateUpdate {
  variable: string;
  operation: string;
  value: unknown;
}

export class LiveState {
  readonly app: Record<string, string>;
  readonly state: Record<string, string>;
  /** Action results kept on the page, by name, as JSON text. Never saved anywhere. */
  readonly results: Record<string, string>;
  /** What each query loop runs with now (`queries.<loop>.*`): the server's answer, kept after each redraw. */
  private queries: Record<string, QueryState>;
  /** For results too large to send: the read-only action and values that made each. */
  private readonly sources = new Map<string, { node: string; values: string[] }>();
  private readonly initial: { app: Record<string, string>; state: Record<string, string> };
  private scopeCache: Record<string, unknown> | null = null;
  /** Reads the visitor's form values (set by the page runtime once the forms exist). */
  formValues: () => Record<string, Record<string, string>> = () => ({});

  constructor(
    private readonly payload: RuntimePayload,
    restoredApp: Record<string, string>,
    private readonly persist: PersistEnv | null,
    private readonly onChange: (names: string[]) => void
  ) {
    this.app = { ...payload.dynamic.app, ...restoredApp };
    this.state = { ...payload.dynamic.state };
    this.results = { ...payload.dynamic.results };
    this.queries = { ...payload.dynamic.queries };
    this.initial = { app: { ...payload.dynamic.app }, state: { ...payload.dynamic.state } };
  }

  /** The dynamic context with the current values (what fragments are rendered with). */
  context(): DynamicContext {
    return {
      ...this.payload.dynamic,
      app: { ...this.app },
      state: { ...this.state },
      results: { ...this.results },
      queries: { ...this.queries },
      forms: this.formValues()
    };
  }

  /** Takes the loop states a redraw answered with. */
  setQueries(next: Readonly<Record<string, QueryState>>): void {
    if (Object.keys(next).length === 0) return;
    this.queries = { ...this.queries, ...next };
    this.scopeCache = null;
  }

  /** Drops the cached scope after something outside app and page state changed (form values). */
  invalidate(): void {
    this.scopeCache = null;
  }

  /** The names expressions see, rebuilt only after a change. */
  scope(): Record<string, unknown> {
    this.scopeCache ??= expressionScope(this.context());
    return this.scopeCache;
  }

  /** Applies updates in order; unknown variables fail the action. */
  update(group: StateGroup, updates: readonly StateUpdate[]): void {
    const values = group === "app" ? this.app : this.state;
    const changed: string[] = [];
    for (const u of updates) {
      if (!(u.variable in values)) {
        throw new Error(`There is no ${group === "app" ? "app" : "page"} state "${u.variable}".`);
      }
      const spec = this.payload.dynamic.types[`${group}.${u.variable}`];
      const next = applyStateOp(
        u.operation,
        values[u.variable] ?? "",
        this.initial[group][u.variable] ?? "",
        u.value,
        spec
      );
      if (next === values[u.variable]) continue;
      values[u.variable] = next;
      changed.push(`${group}.${u.variable}`);
      if (group === "app") this.save(u.variable, next);
    }
    if (changed.length === 0) return;
    this.scopeCache = null;
    this.onChange(changed);
  }

  /** Keeps what an action answered under `results.<name>`; the elements that read it redraw. */
  setResult(name: string, value: unknown, source?: { node: string; values: string[] }): void {
    const text = value === undefined ? "" : (JSON.stringify(value) ?? "");
    const big = text.length > RESULT_LIMIT;
    // A large result of a read-only action stays here; redraws carry a reference to it instead.
    const fits =
      !big || (this.payload.rereadable.includes(name) && source && text.length <= RESULT_MAX);
    if (!fits)
      throw new FlowError(
        "result-too-large",
        `The result "${name}" is too large to keep on the page. Ask for fewer rows or columns${
          big && !this.payload.rereadable.includes(name)
            ? " (only a read-only action's result can be larger than 100,000 characters)"
            : ""
        }.`
      );
    if (big && source) this.sources.set(name, source);
    else this.sources.delete(name);
    if (this.results[name] === text) return;
    this.results[name] = text;
    this.scopeCache = null;
    this.onChange([`results.${name}`]);
  }

  /** The kept results something on the page reads: what a redraw sends (text, or a reference when too large). */
  resultRequest(): Pick<FragmentRequest, "results" | "resultRefs"> {
    const results: Record<string, string> = {};
    const resultRefs: Record<string, { node: string; values: string[] }> = {};
    for (const ref of this.payload.resultReads) {
      const name = ref.slice("results.".length);
      if (!(name in this.results)) continue;
      const source = this.sources.get(name);
      if (source) resultRefs[name] = source;
      else results[name] = this.results[name] ?? "";
    }
    return { results, resultRefs };
  }

  private save(name: string, value: string): void {
    const def = this.payload.appState.find((v) => v.name === name);
    if (def?.persist && this.persist) writePersisted(def, value, this.persist);
  }
}
