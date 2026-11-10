import { expressionScope, type DynamicContext } from "@nextomic/schema";
import { writePersisted, type PersistEnv } from "../persisted-state";
import type { RuntimePayload } from "./payload";
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
  private readonly initial: { app: Record<string, string>; state: Record<string, string> };
  private scopeCache: Record<string, unknown> | null = null;

  constructor(
    private readonly payload: RuntimePayload,
    restoredApp: Record<string, string>,
    private readonly persist: PersistEnv | null,
    private readonly onChange: (names: string[]) => void
  ) {
    this.app = { ...payload.dynamic.app, ...restoredApp };
    this.state = { ...payload.dynamic.state };
    this.initial = { app: { ...payload.dynamic.app }, state: { ...payload.dynamic.state } };
  }

  /** The dynamic context with the current values (what fragments are rendered with). */
  context(): DynamicContext {
    return { ...this.payload.dynamic, app: { ...this.app }, state: { ...this.state } };
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

  private save(name: string, value: string): void {
    const def = this.payload.appState.find((v) => v.name === name);
    if (def?.persist && this.persist) writePersisted(def, value, this.persist);
  }
}
